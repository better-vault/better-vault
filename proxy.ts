import { NextResponse, type NextRequest } from "next/server";

/*
 * Markdown for agents: a request to the home page or a docs page that prefers
 * text/markdown gets the Markdown version at the same URL (a rewrite, not a
 * redirect). Browsers, which ask for HTML or any type, get the page as usual.
 */

function prefersMarkdown(accept: string | null): boolean {
  if (!accept) return false;
  let markdown = -1;
  let html = -1;
  for (const part of accept.split(",")) {
    const [type = "", ...parameters] = part.trim().split(";");
    const q = parameters.map((p) => p.trim()).find((p) => p.startsWith("q="));
    const weight = q ? Number.parseFloat(q.slice(2)) : 1;
    if (Number.isNaN(weight) || weight <= 0) continue;
    const name = type.trim().toLowerCase();
    if (name === "text/markdown") markdown = Math.max(markdown, weight);
    else if (name === "text/html") html = Math.max(html, weight);
  }
  return markdown > 0 && markdown >= html;
}

export function proxy(request: NextRequest): NextResponse {
  if (!prefersMarkdown(request.headers.get("accept"))) {
    const response = NextResponse.next();
    response.headers.set("Vary", "Accept");
    return response;
  }
  const { pathname } = request.nextUrl;
  const url = request.nextUrl.clone();
  url.pathname = pathname === "/" ? "/llms.md" : `/llms.mdx${pathname.replace(/^\/docs/, "")}`;
  const response = NextResponse.rewrite(url);
  response.headers.set("Vary", "Accept");
  return response;
}

export const config = {
  matcher: ["/", "/docs/:path*"],
};
