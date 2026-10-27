import { llmsIndex } from "@/lib/site/llms";

/** The same index as /llms.txt, as Markdown: what "/" negotiates to for agents. */

export function GET(): Response {
  return new Response(llmsIndex(), {
    headers: { "Content-Type": "text/markdown; charset=utf-8", Vary: "Accept" },
  });
}
