import { llmsIndex } from "@/lib/site/llms";

/** The site's index for language models, as plain text. */

export function GET(): Response {
  return new Response(llmsIndex(), {
    headers: { "Content-Type": "text/plain; charset=utf-8", Vary: "Accept" },
  });
}
