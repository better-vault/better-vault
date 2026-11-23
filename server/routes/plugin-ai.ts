import { generateText, jsonSchema, Output } from "ai";
import { z } from "zod";
import { describeError } from "@/lib/ai/errors";
import { createLanguageModel } from "@/lib/ai/providers";
import { credentialsSchema, effortSchema, modelRefSchema } from "@/lib/ai/request";

const bodySchema = z.object({
  prompt: z.string().min(1).max(50_000),
  system: z.string().max(10_000).optional(),
  /** A JSON Schema for a structured answer; plain text without one. */
  schema: z.record(z.string(), z.unknown()).optional(),
  model: modelRefSchema,
  credentials: credentialsSchema,
  effort: effortSchema,
});

/**
 * A plugin's `ai.generate` call: the page sends it with the user's chosen
 * model and key (the plugin never sees either). Nothing is stored.
 */
export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request." }, { status: 400 });
  const { prompt, system, schema, model, credentials, effort } = parsed.data;
  try {
    const languageModel = await createLanguageModel(model, credentials, effort);
    const result = await generateText({
      model: languageModel,
      ...(system ? { system } : {}),
      prompt,
      ...(schema ? { output: Output.object({ schema: jsonSchema(schema) }) } : {}),
      abortSignal: request.signal,
    });
    return Response.json(schema ? { object: result.output } : { text: result.text });
  } catch (error) {
    return Response.json({ error: describeError(error) }, { status: 502 });
  }
}
