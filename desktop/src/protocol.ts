import { net, protocol } from "electron";

/**
 * The window loads `app://better-vault/…`, which is passed on to the local
 * server. The port changes on every launch, but this origin does not, so what
 * the page keeps in localStorage (theme, language) stays put.
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

export function handleScheme(target: string) {
  protocol.handle(scheme, async (request) => {
    const url = new URL(request.url);
    // The page and the server are one origin to the user. Forwarding the
    // page's Origin would make Chromium check CORS on the local server's
    // answer, which fails for font preloads.
    const headers = new Headers(request.headers);
    headers.delete("origin");
    let upstream: Response;
    try {
      upstream = await net.fetch(`${target}${url.pathname}${url.search}`, {
        method: request.method,
        headers,
        body: request.body,
        redirect: "manual",
        // Needed to stream a request body.
        duplex: "half",
      } as RequestInit);
    } catch (error) {
      console.error(`Request to the local server failed: ${request.method} ${url.pathname}`, error);
      return new Response("The local server did not answer.", { status: 502 });
    }
    // Redirects name the server's own address; keep them on this origin.
    const location = upstream.headers.get("location");
    if (!location?.startsWith(target)) return upstream;
    const answer = new Headers(upstream.headers);
    answer.set("location", origin + location.slice(target.length));
    return new Response(upstream.body, { status: upstream.status, headers: answer });
  });
}
