import { googleScopes, microsoftScopes, oauthApps } from "./apps";
import type { StorageAccount } from "./desktop-oauth";
import { updateStorage, getStorageSettings } from "./settings";

/**
 * Sign-ins in the web app, all in the browser, so the server never holds
 * a token. Google: its Identity Services token client gives short-lived
 * access tokens for `drive.file` (asked again when one runs out). Microsoft:
 * the authorization code flow with PKCE in a popup; its rotating refresh
 * token is kept with the storage settings on this device.
 */

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load the sign-in script."));
    document.head.appendChild(script);
  });
}

/* ---------------------------------- Google --------------------------------- */

interface GoogleTokenClient {
  requestAccessToken(options?: { prompt?: string }): void;
}
interface GoogleAccounts {
  oauth2: {
    initTokenClient(config: {
      client_id: string;
      scope: string;
      callback: (answer: { access_token?: string; expires_in?: number; error?: string }) => void;
      error_callback?: (error: { type?: string; message?: string }) => void;
    }): GoogleTokenClient;
    revoke(token: string, done?: () => void): void;
  };
}
declare global {
  interface Window {
    google?: { accounts?: GoogleAccounts; picker?: unknown };
    gapi?: { load(name: string, done: () => void): void };
  }
}

let googleToken: { value: string; expiresAt: number } | null = null;

/** A Google access token; asks the person (a small popup) when there is none. */
export async function googleAccessToken(prompt: "" | "consent" = ""): Promise<string> {
  if (googleToken && googleToken.expiresAt - Date.now() > 60_000) return googleToken.value;
  await loadScript("https://accounts.google.com/gsi/client");
  const accounts = window.google?.accounts;
  if (!accounts) throw new Error("Google sign-in didn't load.");
  return new Promise((resolve, reject) => {
    const client = accounts.oauth2.initTokenClient({
      client_id: oauthApps.google.clientId,
      scope: googleScopes.join(" "),
      callback: (answer) => {
        if (!answer.access_token)
          return reject(new Error(answer.error ?? "Google sign-in was cancelled."));
        googleToken = {
          value: answer.access_token,
          expiresAt: Date.now() + (answer.expires_in ?? 3600) * 1000,
        };
        resolve(answer.access_token);
      },
      error_callback: (error) =>
        reject(new Error(error.message ?? "Google sign-in was cancelled.")),
    });
    client.requestAccessToken({ prompt });
  });
}

export function forgetGoogle() {
  if (googleToken) window.google?.accounts?.oauth2.revoke(googleToken.value);
  googleToken = null;
}

/* -------------------------------- Microsoft -------------------------------- */

const microsoftAuthorize = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";
const microsoftToken = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
/** The page Microsoft sends the popup back to (src/oauth-callback). */
export const oauthCallbackPath = "/oauth/callback";

const base64url = (bytes: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

let microsoftAccess: { value: string; expiresAt: number } | null = null;

async function microsoftTokens(params: Record<string, string>) {
  const response = await fetch(microsoftToken, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: oauthApps.microsoft.clientId,
      scope: microsoftScopes.join(" "),
      ...params,
    }),
  });
  const answer = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error_description?: string;
  };
  if (!response.ok || !answer.access_token)
    throw new Error(answer.error_description?.split("\n")[0] ?? "Microsoft sign-in failed.");
  microsoftAccess = {
    value: answer.access_token,
    expiresAt: Date.now() + (answer.expires_in ?? 3600) * 1000,
  };
  if (answer.refresh_token) await updateStorage("onedrive", { refreshToken: answer.refresh_token });
  return answer.access_token;
}

/** Signs in to Microsoft in a popup and answers a first access token. */
export async function microsoftSignIn(): Promise<string> {
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const challenge = base64url(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)),
  );
  const state = base64url(crypto.getRandomValues(new Uint8Array(16)));
  const redirectUri = `${location.origin}${oauthCallbackPath}`;
  const params = new URLSearchParams({
    client_id: oauthApps.microsoft.clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: microsoftScopes.join(" "),
    code_challenge: challenge,
    code_challenge_method: "S256",
    state,
    prompt: "select_account",
  });
  const popup = window.open(
    `${microsoftAuthorize}?${params}`,
    "better-vault-signin",
    "width=520,height=680",
  );
  if (!popup) throw new Error("Allow pop-ups for this page to sign in.");
  const code = await new Promise<string>((resolve, reject) => {
    const channel = new BroadcastChannel("better-vault-oauth");
    const timer = setInterval(() => {
      if (popup.closed) finish(() => reject(new Error("Microsoft sign-in was cancelled.")));
    }, 500);
    const finish = (then: () => void) => {
      clearInterval(timer);
      channel.close();
      then();
    };
    channel.onmessage = (
      event: MessageEvent<{ state?: string; code?: string; error?: string }>,
    ) => {
      if (event.data.state !== state) return;
      popup.close();
      finish(() =>
        event.data.code
          ? resolve(event.data.code)
          : reject(new Error(event.data.error ?? "Sign-in failed.")),
      );
    };
  });
  return microsoftTokens({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    code_verifier: verifier,
  });
}

/** A Microsoft access token, from the saved refresh token when the last one ran out. */
export async function microsoftAccessToken(): Promise<string> {
  if (microsoftAccess && microsoftAccess.expiresAt - Date.now() > 60_000)
    return microsoftAccess.value;
  const refresh = (await getStorageSettings()).onedrive.refreshToken;
  if (!refresh) return microsoftSignIn();
  try {
    return await microsoftTokens({ grant_type: "refresh_token", refresh_token: refresh });
  } catch {
    // A refresh token of a web page lasts a day; sign in again.
    return microsoftSignIn();
  }
}

export function forgetMicrosoft() {
  microsoftAccess = null;
}

/** Who signed in, for Settings. */
export async function webAccount(
  service: "google" | "microsoft",
  token: string,
): Promise<StorageAccount> {
  const headers = { authorization: `Bearer ${token}` };
  if (service === "google") {
    const body = (await (
      await fetch(
        "https://www.googleapis.com/drive/v3/about?fields=user(displayName,emailAddress)",
        { headers },
      )
    ).json()) as { user?: { displayName?: string; emailAddress?: string } };
    return { name: body.user?.displayName ?? "", email: body.user?.emailAddress ?? "" };
  }
  const body = (await (await fetch("https://graph.microsoft.com/v1.0/me", { headers })).json()) as {
    displayName?: string;
    mail?: string;
    userPrincipalName?: string;
  };
  return { name: body.displayName ?? "", email: body.mail ?? body.userPrincipalName ?? "" };
}
