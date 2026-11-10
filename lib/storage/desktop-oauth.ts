import { BACKEND_URL } from "@/lib/account/config";
import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import path from "node:path";
import { dataDir } from "@/lib/chatgpt/store";
import { googleScopes, microsoftScopes, oauthApps, type OAuthService } from "./apps";

/**
 * Google and Microsoft sign-ins for the desktop app, run by its main process
 * (the API with `desktop: true`). The person signs in in their browser; the
 * service sends them back to a listener on 127.0.0.1, as both allow for
 * desktop apps. The refresh tokens stay in an owner-only file in the app's
 * data folder and never reach the page, which asks for a short-lived access
 * token when it needs one.
 */
export interface StorageAccount {
  name: string;
  email: string;
}

interface Saved {
  refreshToken: string;
  accessToken: string;
  /** Milliseconds since the epoch. */
  expiresAt: number;
  account: StorageAccount;
}

type AuthFile = Partial<Record<OAuthService, Saved>>;

const authFile = () => path.join(dataDir(), "storage-auth.json");

async function readAuth(): Promise<AuthFile> {
  try {
    return JSON.parse(await readFile(authFile(), "utf8")) as AuthFile;
  } catch {
    return {};
  }
}

async function writeAuth(auth: AuthFile) {
  await mkdir(dataDir(), { recursive: true, mode: 0o700 });
  const temporary = `${authFile()}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporary, JSON.stringify(auth, null, 2), { mode: 0o600 });
  await rename(temporary, authFile());
}

const base64url = (bytes: Buffer) => bytes.toString("base64url");

const endpoints = {
  google: {
    authorize: "https://accounts.google.com/o/oauth2/v2/auth",
    token: "https://oauth2.googleapis.com/token",
    scope: googleScopes.join(" "),
    host: "127.0.0.1",
  },
  microsoft: {
    authorize: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    token: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    scope: microsoftScopes.join(" "),
    // Microsoft matches desktop redirects against "http://localhost" with any port.
    host: "localhost",
  },
} as const;

function clientOf(service: OAuthService) {
  return service === "google"
    ? { id: oauthApps.google.desktopClientId }
    : { id: oauthApps.microsoft.clientId };
}

interface TokenAnswer {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  error?: string;
  error_description?: string;
}

async function tokenRequest(
  service: OAuthService,
  params: Record<string, string>,
): Promise<TokenAnswer> {
  const answer =
    service === "google" ? await googleTokenRequest(params) : await microsoftTokenRequest(params);
  if (!answer.access_token)
    throw new Error(answer.error_description ?? answer.error ?? "Sign-in failed.");
  return answer;
}

async function microsoftTokenRequest(params: Record<string, string>): Promise<TokenAnswer> {
  const body = new URLSearchParams({ client_id: clientOf("microsoft").id, ...params });
  body.set("scope", endpoints.microsoft.scope);
  const response = await fetch(endpoints.microsoft.token, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(15_000),
  });
  return (await response.json().catch(() => ({}))) as TokenAnswer;
}

/**
 * Google wants its desktop client's secret to exchange and refresh codes.
 * It no longer ships in the app: better-vault's backend adds it and passes
 * the answer back, storing nothing.
 */
async function googleTokenRequest(params: Record<string, string>): Promise<TokenAnswer> {
  const refreshing = params.grant_type === "refresh_token";
  const response = await fetch(
    `${BACKEND_URL}/v1/oauth/google/${refreshing ? "refresh" : "token"}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(
        refreshing
          ? { refreshToken: params.refresh_token }
          : {
              code: params.code,
              redirectUri: params.redirect_uri,
              codeVerifier: params.code_verifier,
            },
      ),
      signal: AbortSignal.timeout(15_000),
    },
  );
  return (await response.json().catch(() => ({}))) as TokenAnswer;
}

/** Who signed in, for Settings. */
export async function accountOf(
  service: OAuthService,
  accessToken: string,
): Promise<StorageAccount> {
  const headers = { authorization: `Bearer ${accessToken}` };
  if (service === "google") {
    const response = await fetch(
      "https://www.googleapis.com/drive/v3/about?fields=user(displayName,emailAddress)",
      {
        headers,
      },
    );
    const body = (await response.json().catch(() => ({}))) as {
      user?: { displayName?: string; emailAddress?: string };
    };
    return { name: body.user?.displayName ?? "", email: body.user?.emailAddress ?? "" };
  }
  const response = await fetch("https://graph.microsoft.com/v1.0/me", { headers });
  const body = (await response.json().catch(() => ({}))) as {
    displayName?: string;
    mail?: string;
    userPrincipalName?: string;
  };
  return { name: body.displayName ?? "", email: body.mail ?? body.userPrincipalName ?? "" };
}

export type SignInState =
  | { status: "waiting" }
  | { status: "done"; account: StorageAccount }
  | { status: "failed"; error: string };

interface Pending {
  id: string;
  service: OAuthService;
  state: SignInState;
  server: Server;
  timer: NodeJS.Timeout;
}

const pending = new Map<string, Pending>();
const TEN_MINUTES = 10 * 60_000;

function stop(id: string) {
  const entry = pending.get(id);
  if (!entry) return;
  clearTimeout(entry.timer);
  entry.server.close();
}

const page = (title: string, message: string) =>
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title}</title><style>body{font:16px/1.5 system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;color-scheme:light dark}main{max-width:28rem;text-align:center;padding:24px}h1{font-size:20px;margin:0 0 8px}p{margin:0;opacity:.7}</style></head><body><main><h1>${title}</h1><p>${message}</p></main></body></html>`;

/** Starts a sign-in; answers the page to open in the browser. */
export async function startSignIn(service: OAuthService): Promise<{ id: string; url: string }> {
  const client = clientOf(service);
  if (!client.id) throw new Error("This build of better-vault isn't set up for this service.");
  const verifier = base64url(randomBytes(32));
  const challenge = base64url(createHash("sha256").update(verifier).digest());
  const state = base64url(randomBytes(16));
  const id = base64url(randomBytes(12));

  const server = createServer();
  const port = await new Promise<number>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address && typeof address === "object") resolve(address.port);
      else reject(new Error("Could not start the sign-in listener."));
    });
  });
  const redirectUri = `http://${endpoints[service].host}:${port}/callback`;
  const entry: Pending = {
    id,
    service,
    state: { status: "waiting" },
    server,
    timer: setTimeout(() => {
      stop(id);
      pending.delete(id);
    }, TEN_MINUTES),
  };
  pending.set(id, entry);

  server.on("request", (request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    if (
      url.pathname !== "/callback" ||
      url.searchParams.get("state") !== state ||
      entry.state.status !== "waiting"
    ) {
      response.writeHead(404).end();
      return;
    }
    const send = (ok: boolean, message: string) =>
      response
        .writeHead(ok ? 200 : 400, { "content-type": "text/html; charset=utf-8" })
        .end(page(ok ? "You're signed in" : "Sign-in didn't work", message));
    const code = url.searchParams.get("code");
    if (!code) {
      const error =
        url.searchParams.get("error_description") ??
        url.searchParams.get("error") ??
        "No code was returned.";
      entry.state = { status: "failed", error };
      send(false, error);
      stop(id);
      return;
    }
    void (async () => {
      try {
        const tokens = await tokenRequest(service, {
          grant_type: "authorization_code",
          code,
          code_verifier: verifier,
          redirect_uri: redirectUri,
        });
        if (!tokens.refresh_token)
          throw new Error("The service didn't allow better-vault to stay signed in.");
        const account = await accountOf(service, tokens.access_token);
        const auth = await readAuth();
        auth[service] = {
          refreshToken: tokens.refresh_token,
          accessToken: tokens.access_token,
          expiresAt: Date.now() + tokens.expires_in * 1000,
          account,
        };
        await writeAuth(auth);
        entry.state = { status: "done", account };
        send(true, "You can close this tab and go back to better-vault.");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        entry.state = { status: "failed", error: message };
        send(false, message);
      } finally {
        setTimeout(() => stop(id), 1000);
      }
    })();
  });

  const params = new URLSearchParams({
    client_id: client.id,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: endpoints[service].scope,
    code_challenge: challenge,
    code_challenge_method: "S256",
    state,
  });
  if (service === "google") {
    params.set("access_type", "offline");
    params.set("prompt", "consent");
  } else {
    params.set("prompt", "select_account");
  }
  return { id, url: `${endpoints[service].authorize}?${params}` };
}

export function signInState(id: string): SignInState | { status: "idle" } {
  return pending.get(id)?.state ?? { status: "idle" };
}

export function cancelSignIn(id: string) {
  stop(id);
  pending.delete(id);
}

/** A fresh access token, refreshed when it is about to expire. */
export async function accessToken(
  service: OAuthService,
): Promise<{ accessToken: string; account: StorageAccount }> {
  const auth = await readAuth();
  const saved = auth[service];
  if (!saved) throw new Error("not-signed-in");
  if (saved.expiresAt - Date.now() > 60_000)
    return { accessToken: saved.accessToken, account: saved.account };
  const tokens = await tokenRequest(service, {
    grant_type: "refresh_token",
    refresh_token: saved.refreshToken,
  });
  auth[service] = {
    ...saved,
    accessToken: tokens.access_token,
    // Microsoft rotates refresh tokens; Google keeps the first one.
    refreshToken: tokens.refresh_token ?? saved.refreshToken,
    expiresAt: Date.now() + tokens.expires_in * 1000,
  };
  await writeAuth(auth);
  return { accessToken: tokens.access_token, account: saved.account };
}

export async function accounts(): Promise<Partial<Record<OAuthService, StorageAccount>>> {
  const auth = await readAuth();
  return Object.fromEntries(
    Object.entries(auth).map(([service, saved]) => [service, saved?.account]),
  );
}

/** Signs out: Google's token is revoked; both are forgotten. */
export async function signOut(service: OAuthService) {
  const auth = await readAuth();
  const saved = auth[service];
  if (saved && service === "google")
    await fetch(
      `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(saved.refreshToken)}`,
      {
        method: "POST",
      },
    ).catch(() => {});
  delete auth[service];
  if (Object.keys(auth).length === 0) await rm(authFile(), { force: true });
  else await writeAuth(auth);
}
