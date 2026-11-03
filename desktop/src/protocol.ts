import { net, protocol } from "electron";
import { statSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { readFileSync } from "node:fs";
import { inlineScriptHashes, securityHeaders } from "@/lib/security/csp";
import { createApi } from "@/server/app";

/**
 * The window loads `app://better-vault/…`. Pages and their files come from
 * the app's Vite build (out/renderer); `/api/…` is the app's own API, run
 * here in the main process. The origin never changes, so what the page keeps
 * in localStorage (theme, language) stays put.
 */
export const scheme = "app";
export const origin = `${scheme}://better-vault`;

/** Must run before the app is ready. */
export function registerScheme() {
  protocol.registerSchemesAsPrivileged([
    {
      scheme,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        stream: true,
        corsEnabled: true,
        codeCache: true,
      },
    },
  ]);
}

/**
 * @param renderer the folder of the built page, or, in development, the
 *   address of electron-vite's dev server.
 */
export function handleScheme(renderer: string) {
  const api = createApi({ desktop: true });
  // Built pages only: the dev server injects scripts of its own.
  const pageHeaders = /^https?:/.test(renderer)
    ? null
    : securityHeaders(inlineScriptHashes(readFileSync(path.join(renderer, "index.html"), "utf8")));
  const devServer = /^https?:/.test(renderer) ? renderer.replace(/\/$/, "") : undefined;

  protocol.handle(scheme, async (request) => {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      try {
        return await api.fetch(request);
      } catch (error) {
        console.error(`API request failed: ${request.method} ${url.pathname}`, error);
        return Response.json({ error: "Something went wrong." }, { status: 500 });
      }
    }
    if (devServer) return net.fetch(`${devServer}${url.pathname}${url.search}`);

    // A file of the build, or else the single-page app's index.
    const relative = path.normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, "");
    let file = path.join(renderer, relative);
    if (!file.startsWith(renderer) || !isFile(file)) file = path.join(renderer, "index.html");
    const response = await net.fetch(pathToFileURL(file).toString());
    // The pages get the same Content-Security-Policy as the web app's.
    const answer = new Headers(response.headers);
    for (const [name, value] of Object.entries(pageHeaders ?? {})) answer.set(name, value);
    return new Response(response.body, { status: response.status, headers: answer });
  });
}

function isFile(file: string) {
  try {
    return statSync(file).isFile();
  } catch {
    return false;
  }
}
