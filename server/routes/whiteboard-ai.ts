import { Output, stepCountIs, streamText, type ModelMessage } from "ai";
import { z } from "zod";
import { describeError } from "@/lib/ai/errors";
import { providers } from "@/lib/ai/catalog";
import { createLanguageModel, createWebSearchTools } from "@/lib/ai/providers";
import { credentialsSchema, effortSchema, modelRefSchema } from "@/lib/ai/request";
import { boardItem, webRules, whiteboardPrompt } from "@/studio/tools/whiteboard/ai/schema";

const bodySchema = z.object({
  question: z.string().min(1).max(4000),
  /** What is on the board already, as text, so the answer can build on it. */
  board: z.string().max(8000).default(""),
  /** What the user selected and asked about: its words, and a picture of it (PNG data URL). */
  selection: z
    .object({
      text: z.string().max(8000).default(""),
      image: z
        .string()
        .max(6_000_000)
        .regex(/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/)
        .optional(),
    })
    .optional(),
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
  const { question, board, selection, model, credentials, effort } = parsed.data;

  let languageModel;
  try {
    languageModel = await createLanguageModel(model, credentials, effort);
  } catch (error) {
    return Response.json({ error: describeError(error) }, { status: 400 });
  }

  // The provider's own web search, so answers can be checked against the web (none for local models).
  const tools = providers[model.provider].local
    ? undefined
    : createWebSearchTools(model, credentials);
  const context = [
    board.trim() ? `On the board already:\n${board}` : "",
    selection?.text.trim() ? `The user selected this on the board:\n${selection.text}` : "",
    selection?.image ? "A picture of what the user selected is attached." : "",
    `Question: ${question}`,
  ]
    .filter(Boolean)
    .join("\n\n");
  const messages: ModelMessage[] = [
    {
      role: "user",
      content: selection?.image
        ? [
            { type: "text", text: context },
            { type: "image", image: selection.image },
          ]
        : context,
    },
  ];

  const result = streamText({
    model: languageModel,
    system: tools ? `${whiteboardPrompt}\n\n${webRules}` : whiteboardPrompt,
    messages,
    ...(tools ? { tools, stopWhen: stepCountIs(6) } : {}),
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
