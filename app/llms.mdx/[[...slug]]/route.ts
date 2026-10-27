import { notFound } from "next/navigation";
import { approximateTokens } from "@/lib/site/llms";
import { source } from "@/lib/source";

/**
 * A docs page's raw Markdown: what "Copy page" copies, and what an agent gets
 * when it asks a docs URL for text/markdown (see proxy.ts).
 */
export async function GET(_request: Request, { params }: RouteContext<"/llms.mdx/[[...slug]]">) {
  const { slug } = await params;
  const page = source.getPage(slug);
  if (!page) notFound();

  const content = await page.data.getText("raw");
  return new Response(content, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "X-Markdown-Tokens": String(approximateTokens(content)),
      Vary: "Accept",
    },
  });
}

export function generateStaticParams() {
  return source.generateParams();
}
