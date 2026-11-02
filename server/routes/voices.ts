import { z } from "zod";
import { describeError } from "@/lib/ai/errors";
import { listVoices } from "@/lib/ai/voices";

const bodySchema = z.object({ apiKey: z.string().min(1).max(500) });

/** Lists the ElevenLabs voices this key can use. Nothing is stored. */
export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request." }, { status: 400 });
  try {
    return Response.json({ voices: await listVoices(parsed.data.apiKey) });
  } catch (error) {
    return Response.json({ error: describeError(error) }, { status: 502 });
  }
}
