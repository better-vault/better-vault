import { absoluteUrl, site } from "@/lib/site/config";

/*
 * robots.txt, written by hand because Next's helper can't emit Content-Signal.
 * better-vault is open source and wants to be found, searched and cited, so
 * search engines and AI crawlers are all welcome. The app (/app) holds no
 * content (notebooks live in each browser) and the API returns no pages.
 */

const BODY = `# ${site.name}: ${site.tagline}
# ${absoluteUrl("/llms.txt")} summarises the site for language models.

# What this content may be used for: https://contentsignals.org/
Content-Signal: ai-train=yes, search=yes, ai-input=yes

User-agent: *
Allow: /
Disallow: /api/
Disallow: /app/

# AI search and assistants: welcome to read and cite these pages.
User-agent: OAI-SearchBot
User-agent: ChatGPT-User
User-agent: GPTBot
User-agent: Claude-SearchBot
User-agent: Claude-User
User-agent: ClaudeBot
User-agent: PerplexityBot
User-agent: Perplexity-User
User-agent: Google-Extended
User-agent: Applebot-Extended
User-agent: CCBot
Allow: /
Disallow: /api/
Disallow: /app/

Sitemap: ${absoluteUrl("/sitemap.xml")}
`;

export function GET(): Response {
  return new Response(BODY, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
