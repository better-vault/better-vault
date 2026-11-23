import { Output, streamText } from "ai";
import { z } from "zod";
import { describeError } from "@/lib/ai/errors";
import { createLanguageModel } from "@/lib/ai/providers";
import { credentialsSchema, effortSchema, modelRefSchema } from "@/lib/ai/request";
import { boardItem, whiteboardPrompt } from "@/studio/tools/whiteboard/ai/schema";

const bodySchema = z.object({
  question: z.string().min(1).max(4000),
  /** What is on the board already, as text, so the answer can build on it. */
  board: z.string().max(8000).default(""),
  model: modelRefSchema,
  credentials: credentialsSchema,
  effort: effortSchema,
});

/**
 * "Ask AI" on the whiteboard: streams a board's items, one JSON line each as
 * soon as it is complete, so the page can start writing before the model is
 * done. Nothing is stored.
 */
export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request." }, { status: 400 });
  const { question, board, model, credentials, effort } = parsed.data;

  let languageModel;
  try {
    languageModel = await createLanguageModel(model, credentials, effort);
  } catch (error) {
    return Response.json({ error: describeError(error) }, { status: 400 });
  }

  const result = streamText({
    model: languageModel,
    system: whiteboardPrompt,
    prompt: board.trim()
      ? `On the board already:\n${board}\n\nQuestion: ${question}`
      : `Question: ${question}`,
    output: Output.array({ element: boardItem }),
    abortSignal: request.signal,
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const item of result.elementStream) {
          controller.enqueue(encoder.encode(`${JSON.stringify({ item })}\n`));
        }
      } catch (error) {
        controller.enqueue(encoder.encode(`${JSON.stringify({ error: describeError(error) })}\n`));
      }
      controller.close();
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}
