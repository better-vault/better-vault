import { approximateTokens, llmsFull } from "@/lib/site/llms";

/** The whole documentation in one file, for language models. */

export async function GET(): Promise<Response> {
  const text = await llmsFull();
  return new Response(text, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Markdown-Tokens": String(approximateTokens(text)),
    },
  });
}
