import { generateText, Output } from "ai";
import { z } from "zod";
import { describeError } from "@/lib/ai/errors";
import { createLanguageModel } from "@/lib/ai/providers";
import { credentialsSchema, modelRefSchema } from "@/lib/ai/request";
import type { Passage } from "@/lib/grounding/passages";
import { studioSystem } from "@/studio/server/shared";

const bodySchema = z.object({
  language: z.string().min(1).max(20),
  passages: z
    .array(
      z.object({
        n: z.number().int().positive(),
        chunkId: z.string(),
        sourceId: z.string(),
        title: z.string(),
        kind: z.enum(["text", "markdown", "pdf", "url"]),
        text: z.string(),
      }),
    )
    .min(1)
    .max(200),
  model: modelRefSchema,
  credentials: credentialsSchema,
});

const schema = z.object({
  suggestions: z.array(
    z.object({
      title: z.string().describe("2 to 5 words"),
      description: z.string().describe("One short sentence"),
      instructions: z.string().describe("How to write it: its purpose, structure and tone"),
    }),
  ),
});

/** Report formats suited to these particular sources, as NotebookLM suggests them. */
export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request." }, { status: 400 });
  try {
    const { output } = await generateText({
      model: createLanguageModel(parsed.data.model, parsed.data.credentials),
      output: Output.object({ schema }),
      system: studioSystem(
        "Suggest four kinds of written report that would be especially useful for these particular sources, beyond a generic summary: for example a comparison of two things they discuss, a timeline, a checklist, a case-study analysis or a guide for a specific reader. Each needs a short title, a one-sentence description and instructions for writing it.",
        { language: parsed.data.language, focus: "", passages: parsed.data.passages as Passage[] },
      ),
      prompt: "Suggest the four report formats now.",
      abortSignal: request.signal,
    });
    const suggestions = output.suggestions
      .filter((item) => item.title.trim() && item.instructions.trim())
      .slice(0, 4);
    return Response.json({ suggestions });
  } catch (error) {
    return Response.json({ error: describeError(error) }, { status: 502 });
  }
}
