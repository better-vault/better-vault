import { createServer, type Server } from "node:http";
import strings from "@/locales/en/settings.json";
import {
  authorizeUrl,
  createPkce,
  exchangeCode,
  planScope,
  randomValue,
  verifyIdToken,
  type Pkce,
} from "./oauth";
import type { ChatGPTAccount } from "./client";
import { tokensFrom } from "./session";
import { hostId, readAuth, writeAuth } from "./store";

/**
 * One sign-in at a time. The server listens on 127.0.0.1 for OpenAI's
 * redirect (OpenAI allows only a loopback address there), so the browser
 * that signs in must run on the same computer as better-vault's server.
 */
export type LoginState =
  | { status: "idle" }
  | { status: "waiting"; id: string }
  | { status: "done"; id: string; account: ChatGPTAccount }
  | { status: "failed"; id: string; error: string };

interface Pending {
  id: string;
  state: LoginState;
  server: Server;
  timer: NodeJS.Timeout;
}

const TEN_MINUTES = 10 * 60_000;
/** The port OpenAI's examples use; any free port is accepted when it is taken. */
const PREFERRED_PORT = 1455;

const globalState = globalThis as typeof globalThis & { __bvChatGPTLogin?: Pending };

export function loginState(id: string): LoginState {
  const pending = globalState.__bvChatGPTLogin;
  return pending && pending.id === id ? pending.state : { status: "idle" };
}

export function cancelLogin() {
  const pending = globalState.__bvChatGPTLogin;
  if (!pending) return;
  globalState.__bvChatGPTLogin = undefined;
  clearTimeout(pending.timer);
  pending.server.close();
}

function listen(server: Server, port: number): Promise<number> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      server.off("error", reject);
      const address = server.address();
      if (address && typeof address === "object") resolve(address.port);
      else reject(new Error("Could not start the sign-in listener."));
    });
  });
}

const escape = (text: string) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** The page the browser lands on after signing in. Plain, and says where to go next. */
function page(title: string, message: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)}</title><style>body{font:16px/1.5 system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;padding:24px;box-sizing:border-box;color-scheme:light dark}main{max-width:28rem;text-align:center}h1{font-size:20px;margin:0 0 8px}p{margin:0;opacity:.7}</style></head><body><main><h1>${escape(title)}</h1><p>${escape(message)}</p></main></body></html>`;
}

/**
 * Starts a sign-in and returns the page to open. `newAccount` registers a
 * different ChatGPT account instead of signing in to the saved one again.
 */
export async function startLogin(newAccount: boolean): Promise<{ id: string; url: string }> {
  cancelLogin();
  const { registration } = await readAuth();
  const saved = newAccount ? null : registration;
  const host = await hostId();
  const pkce: Pkce = createPkce();
  const state = randomValue();
  const nonce = randomValue();
  const id = randomValue();

  const server = createServer();
  let port: number;
  try {
    port = await listen(server, PREFERRED_PORT);
  } catch {
    port = await listen(server, 0);
  }
  const redirectUri = `http://127.0.0.1:${port}/auth/callback`;

  const pending: Pending = {
    id,
    state: { status: "waiting", id },
    server,
    timer: setTimeout(() => {
      if (globalState.__bvChatGPTLogin === pending) cancelLogin();
    }, TEN_MINUTES),
  };
  globalState.__bvChatGPTLogin = pending;

  const finish = (state: LoginState) => {
    pending.state = state;
    clearTimeout(pending.timer);
    // Close once the page has been sent; keep the state for the app to read.
    setTimeout(() => server.close(), 1000);
    pending.timer = setTimeout(() => {
      if (globalState.__bvChatGPTLogin === pending) globalState.__bvChatGPTLogin = undefined;
    }, TEN_MINUTES);
  };

  server.on("request", (request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    if (url.pathname !== "/auth/callback" || pending.state.status !== "waiting") {
      response.writeHead(404).end();
      return;
    }
    const fail = (error: string) => {
      response
        .writeHead(400, { "content-type": "text/html; charset=utf-8" })
        .end(page(strings.chatgpt.callbackFailedTitle, error));
      finish({ status: "failed", id, error });
    };
    if (url.searchParams.get("state") !== state) {
      // Not ours: leave the real sign-in waiting.
      response.writeHead(400).end();
      return;
    }
    const error = url.searchParams.get("error");
    if (error) {
      fail(
        error === "access_denied"
          ? strings.chatgpt.declined
          : (url.searchParams.get("error_description") ?? error),
      );
      return;
    }
    const code = url.searchParams.get("code");
    const clientId = saved?.clientId ?? url.searchParams.get("client_id");
    const returned = url.searchParams.get("client_id");
    if (!code || !clientId || (saved && returned && returned !== saved.clientId)) {
      fail(strings.chatgpt.invalidCallback);
      return;
    }

    void (async () => {
      try {
        const tokens = tokensFrom(
          await exchangeCode({ code, clientId, redirectUri, verifier: pkce.verifier }),
        );
        if (!tokens.idToken) throw new Error(strings.chatgpt.invalidCallback);
        const claims = await verifyIdToken(tokens.idToken, clientId, nonce);
        if (saved && saved.sub !== claims.sub) throw new Error(strings.chatgpt.otherAccount);
        await writeAuth({
          registration: {
            sub: claims.sub,
            email: claims.email ?? "",
            name: claims.name ?? "",
            clientId,
          },
          tokens,
        });
        const account: ChatGPTAccount = {
          email: claims.email ?? "",
          name: claims.name ?? "",
          planUsage: tokens.scopes.includes(planScope),
        };
        response
          .writeHead(200, { "content-type": "text/html; charset=utf-8" })
          .end(page(strings.chatgpt.callbackDoneTitle, strings.chatgpt.callbackDone));
        finish({ status: "done", id, account });
      } catch (cause) {
        fail(cause instanceof Error ? cause.message : String(cause));
      }
    })();
  });

  const url = authorizeUrl({
    redirectUri,
    pkce,
    state,
    nonce,
    hostId: host,
    clientId: saved?.clientId,
    loginHint: saved?.email || undefined,
  });
  return { id, url };
}
