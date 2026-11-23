import { createElevenLabs } from "@ai-sdk/elevenlabs";
import { createOpenAI } from "@ai-sdk/openai";
import { transcribe } from "ai";
import { z } from "zod";
import { describeError } from "@/lib/ai/errors";

const MAX_AUDIO = 12 * 1024 * 1024;

const bodySchema = z.object({
  provider: z.enum(["openai", "elevenlabs"]),
  apiKey: z.string().min(1).max(500),
  /** The recording, base64. */
  audio: z
    .string()
    .min(1)
    .max(Math.ceil((MAX_AUDIO * 4) / 3)),
});

/**
 * Turns a short recording into text, for voice input. OpenAI or ElevenLabs,
 * with the user's own key, through the AI SDK. Nothing is stored.
 */
export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request." }, { status: 400 });
  const { provider, apiKey, audio } = parsed.data;
  try {
    const model =
      provider === "openai"
        ? createOpenAI({ apiKey }).transcription("gpt-4o-mini-transcribe")
        : createElevenLabs({ apiKey }).transcription("scribe_v2");
    const result = await transcribe({ model, audio, abortSignal: request.signal });
    return Response.json({ text: result.text });
  } catch (error) {
    return Response.json({ error: describeError(error) }, { status: 502 });
  }
}
