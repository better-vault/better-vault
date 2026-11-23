import { createElevenLabs } from "@ai-sdk/elevenlabs";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText, transcribe } from "ai";
import { z } from "zod";
import { describeError } from "@/lib/ai/errors";

const MAX_AUDIO = 12 * 1024 * 1024;

const bodySchema = z.object({
  provider: z.enum(["openai", "elevenlabs", "google"]),
  /** The recording's type, such as audio/webm. */
  mediaType: z.string().max(60).default("audio/webm"),
  apiKey: z.string().min(1).max(500),
  /** The recording, base64. */
  audio: z
    .string()
    .min(1)
    .max(Math.ceil((MAX_AUDIO * 4) / 3)),
});

/**
 * Turns a short recording into text, for voice input. OpenAI, ElevenLabs or Gemini,
 * with the user's own key, through the AI SDK. Nothing is stored.
 */
export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request." }, { status: 400 });
  const { provider, apiKey, audio, mediaType } = parsed.data;
  try {
    if (provider === "google") {
      // Gemini listens to the recording and writes down what was said.
      const result = await generateText({
        model: createGoogleGenerativeAI({ apiKey })("gemini-2.5-flash"),
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Write down exactly what is said in this recording, in its own language. Reply with the words only.",
              },
              { type: "file", data: audio, mediaType: mediaType.split(";")[0] },
            ],
          },
        ],
        abortSignal: request.signal,
      });
      return Response.json({ text: result.text.trim() });
    }
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
