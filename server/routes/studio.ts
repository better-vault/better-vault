import { z } from "zod";
import { describeError } from "@/lib/ai/errors";
import { createImageModel, createLanguageModel, createSpeechModel } from "@/lib/ai/providers";
import { credentialsSchema, effortSchema, modelRefSchema } from "@/lib/ai/request";
import type { Passage } from "@/lib/grounding/passages";
import { toolDefinitions } from "@/studio/definitions";
import { generators } from "@/studio/server/generators";
import { studioToolIds } from "@/studio/tools";

const passageSchema = z.object({
  n: z.number().int().positive(),
  chunkId: z.string(),
  sourceId: z.string(),
  title: z.string(),
  kind: z.enum(["text", "markdown", "pdf", "url"]),
  text: z.string(),
});

const bodySchema = z.object({
  tool: z.enum(studioToolIds),
  options: z.unknown(),
  language: z.string().min(1).max(20),
  focus: z.string().max(4000),
  passages: z.array(passageSchema).min(1).max(2000),
  model: modelRefSchema,
  credentials: credentialsSchema,
  effort: effortSchema,
  /** The image model's credentials, for tools that draw pictures. */
  imageCredentials: credentialsSchema.optional(),
  /** The speech model's credentials, for tools that speak. */
  speechCredentials: credentialsSchema.optional(),
});

/** Generates one Studio output with the user's model. Nothing is stored here. */
export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request." }, { status: 400 });
  const { tool, language, focus, model, credentials, effort } = parsed.data;

  const definition = toolDefinitions[tool];
  const generate = generators[tool];
  if (!definition || !generate || definition.local) {
    return Response.json({ error: "This tool is not available yet." }, { status: 400 });
  }

  const options = definition.options.safeParse(parsed.data.options);
  if (!options.success)
    return Response.json({ error: "Invalid options for this tool." }, { status: 400 });
  const imageRef = definition.imageModel?.(options.data) ?? null;
  if (definition.imageModel && !imageRef)
    return Response.json({ error: "Choose an image model." }, { status: 400 });
  const speechRef = definition.speechModel?.(options.data) ?? null;
  if (definition.speechModel && !speechRef)
    return Response.json({ error: "Choose a voice service." }, { status: 400 });

  try {
    const result = await generate({
      model: await createLanguageModel(model, credentials, effort),
      options: options.data,
      language,
      focus,
      passages: parsed.data.passages as Passage[],
      image: imageRef
        ? { ref: imageRef, model: createImageModel(imageRef, parsed.data.imageCredentials ?? {}) }
        : undefined,
      speech: speechRef
        ? {
            ref: speechRef,
            model: createSpeechModel(speechRef, parsed.data.speechCredentials ?? {}),
          }
        : undefined,
      abortSignal: request.signal,
    });
    const data = definition.data.safeParse(result.data);
    if (!data.success) throw new Error("The model's answer did not have the expected shape.");
    // Files travel as base64 in the JSON answer; the browser stores them as bytes.
    const files = result.files?.map((file) => ({
      id: file.id,
      mime: file.mime,
      base64: Buffer.from(file.bytes).toString("base64"),
    }));
    return Response.json({ title: result.title, data: data.data, files });
  } catch (error) {
    return Response.json({ error: describeError(error) }, { status: 502 });
  }
}
