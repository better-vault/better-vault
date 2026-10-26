import { z } from "zod";
import { describeError } from "@/lib/ai/errors";
import { createImageModel, createLanguageModel } from "@/lib/ai/providers";
import { credentialsSchema, modelRefSchema } from "@/lib/ai/request";
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
  /** The image model's credentials, for tools that draw pictures. */
  imageCredentials: credentialsSchema.optional(),
});

/** A brief and then a picture can take a few minutes. */
export const maxDuration = 300;

/** Generates one Studio output with the user's model. Nothing is stored here. */
export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request." }, { status: 400 });
  const { tool, language, focus, model, credentials } = parsed.data;

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

  try {
    const result = await generate({
      model: createLanguageModel(model, credentials),
      options: options.data,
      language,
      focus,
      passages: parsed.data.passages as Passage[],
      image: imageRef
        ? { ref: imageRef, model: createImageModel(imageRef, parsed.data.imageCredentials ?? {}) }
        : undefined,
      abortSignal: request.signal,
    });
    const data = definition.data.safeParse(result.data);
    if (!data.success) throw new Error("The model's answer did not have the expected shape.");
    return Response.json({ title: result.title, data: data.data });
  } catch (error) {
    return Response.json({ error: describeError(error) }, { status: 502 });
  }
}
