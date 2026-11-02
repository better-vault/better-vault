/**
 * The voices an ElevenLabs key can use, for the Audio Overview dialog.
 * Listing is the one direct call to ElevenLabs (like listing models); the
 * speech itself goes through the AI SDK.
 */
export interface Voice {
  id: string;
  name: string;
  /** "female", "male" or "neutral", when ElevenLabs says. */
  gender?: string;
  /** A short description, such as "warm, conversational". */
  description?: string;
  /** A short sample of the voice. */
  previewUrl?: string;
}

interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  labels?: Record<string, string>;
  description?: string | null;
  preview_url?: string | null;
}

export async function listVoices(apiKey: string): Promise<Voice[]> {
  if (!apiKey) throw new Error("An API key is needed.");
  let response: Response;
  try {
    response = await fetch("https://api.elevenlabs.io/v1/voices", {
      headers: { "xi-api-key": apiKey },
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new Error("Could not reach ElevenLabs.");
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      detail?: { message?: string } | string;
    };
    const reason = typeof body.detail === "string" ? body.detail : body.detail?.message;
    throw new Error(`${response.status} ${reason ?? response.statusText}`.trim());
  }
  const body = (await response.json()) as { voices?: ElevenLabsVoice[] };
  return (body.voices ?? [])
    .map((voice) => ({
      id: voice.voice_id,
      // ElevenLabs names often carry a description after a dash: "Rachel - calm".
      name: voice.name.split(/\s+[-–]\s+/)[0] || voice.name,
      gender: voice.labels?.gender,
      description:
        voice.labels?.descriptive ?? voice.labels?.description ?? voice.description ?? undefined,
      previewUrl: voice.preview_url ?? undefined,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
