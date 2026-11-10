import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { ipcMain, shell, type WebFrameMain } from "electron";
import { BACKEND_URL } from "../../lib/account/config";

/**
 * Signing in to a better-vault account from the desktop app: the backend's
 * sign-in page opens in the system browser, and after the person allows it,
 * the backend sends the token to a one-time loopback address here.
 */
export function startAccount(isTrusted: (frame: WebFrameMain | null) => boolean) {
  let pending: (() => void) | null = null;

  ipcMain.handle("account:signIn", async (event, mode: unknown) => {
    if (!isTrusted(event.senderFrame)) throw new Error("Not allowed.");
    pending?.();
    const state = randomUUID();
    return new Promise<string>((resolve, reject) => {
      const server = createServer((request, response) => {
        const url = new URL(request.url ?? "/", "http://127.0.0.1");
        if (url.pathname !== "/callback") return void response.writeHead(404).end();
        const token = url.searchParams.get("token");
        const ok = !!token && url.searchParams.get("state") === state;
        response.writeHead(ok ? 200 : 400, { "content-type": "text/html; charset=utf-8" });
        response.end(
          `<!doctype html><meta charset="utf-8"><title>better-vault</title><body style="font:16px system-ui;display:grid;place-items:center;min-height:90vh"><p>${
            ok
              ? "You're signed in. You can go back to better-vault."
              : "Something went wrong. Try signing in again."
          }</p></body>`,
        );
        if (!ok) return;
        finish();
        resolve(token);
      });
      const timeout = setTimeout(() => {
        finish();
        reject(new Error("cancelled"));
      }, 10 * 60_000);
      const finish = () => {
        clearTimeout(timeout);
        server.close();
        pending = null;
      };
      pending = () => {
        finish();
        reject(new Error("cancelled"));
      };
      server.listen(0, "127.0.0.1", () => {
        const address = server.address();
        const port = typeof address === "object" && address ? address.port : 0;
        const login = new URL(`${BACKEND_URL}/v1/login`);
        login.searchParams.set("return", `http://127.0.0.1:${port}/callback`);
        login.searchParams.set("state", state);
        login.searchParams.set("mode", mode === "signup" ? "signup" : "signin");
        void shell.openExternal(login.toString());
      });
    });
  });
}
