import { generateId, generateSpeech, generateText, Output, type SpeechModel } from "ai";
import { z } from "zod";
import { toPassageRefs } from "@/lib/grounding/passages";
import { clean, studioSystem, type Generator } from "@/studio/server/shared";
import {
  dialogueModels,
  LENGTH_MINUTES,
  WORDS_PER_MINUTE,
  type AudioFormat,
  type AudioOverviewData,
  type AudioOverviewOptions,
} from "./definition";

// The model-facing script: flat and every field required, for strict structured outputs.
const modelScript = z.object({
  title: z.string().describe("The episode's title, 3 to 8 words"),
  turns: z.array(
    z.object({
      speaker: z.enum(["A", "B"]).describe("Who speaks: A is the first host, B the second"),
      text: z
        .string()
        .describe(
          "What the host says, as spoken words: no citations, lists, markdown or stage directions",
        ),
      cites: z.array(z.number()).describe("The numbers of the passages this turn draws on"),
    }),
  ),
});

const FORMATS: Record<AudioFormat, string> = {
  "deep-dive":
    "a lively deep dive: two curious hosts unpack the sources together, from the big picture to the details that matter, with examples and the occasional surprise",
  brief:
    "a brief: two hosts run through the most important points quickly and clearly, like a short news segment",
  debate:
    "a friendly debate: the hosts take different sides of the questions the sources raise, argue each with evidence from the passages, and end on what they agree on",
};

/** A narrator's version of each format. A debate with one voice weighs both sides. */
const SOLO_FORMATS: Record<AudioFormat, string> = {
  "deep-dive":
    "a deep dive: one narrator unpacks the sources from the big picture to the details that matter, with examples, like a thoughtful podcast host on their own",
  brief:
    "a brief: one narrator runs through the most important points quickly and clearly, like a short news segment",
  debate:
    "a balanced argument: one narrator lays out the different sides of the questions the sources raise, with evidence for each, and ends on where they meet",
};

export function scriptTask(options: AudioOverviewOptions, names: string[]): string {
  const minutes = LENGTH_MINUTES[options.length];
  const words = minutes * WORDS_PER_MINUTE;
  if (names.length < 2)
    return `Write the script of a spoken monologue about the sources, for an audio overview: ${SOLO_FORMATS[options.format]}.

- The narrator is ${names[0]}. Every turn is spoken by A; split the script into paragraphs of two to five sentences, each a turn.
- About ${words} words in total (roughly ${minutes} minutes when spoken).
- Open by saying what the episode is about, and close with the main takeaway.
- Write for the ear: plain spoken sentences, numbers as they are said, no lists, headings, markdown, URLs or emojis.
- Never read citations aloud. Put the numbers of the passages each turn draws on in "cites".
- Stay faithful to the passages: explain and connect what they say, and say so when they don't settle something.`;
  return `Write the script of a spoken conversation about the sources, for an audio overview: ${FORMATS[options.format]}.

- The hosts are ${names[0]} (A) and ${names[1]} (B). They may call each other by name, but not in every turn.
- About ${words} words in total (roughly ${minutes} minutes when spoken), in turns of one to four sentences that go back and forth naturally.
- A opens by saying what the episode is about; B closes with the main takeaway.
- Write for the ear: plain spoken sentences, numbers as they are said, no lists, headings, markdown, URLs or emojis.
- Never read citations aloud. Put the numbers of the passages each turn draws on in "cites".
- Stay faithful to the passages: explain and connect what they say, and say so when they don't settle something.`;
}

/** At most this many characters go to one dialogue request. */
const BATCH_CHARS = 2_400;

/** The bitrate of an ElevenLabs MP3 format such as "mp3_44100_128", in bits per second. */
function bitrateOf(format: unknown): number | null {
  const match = typeof format === "string" ? /^mp3_\d+_(\d+)$/.exec(format) : null;
  return match ? Number(match[1]) * 1000 : null;
}

interface Spoken {
  bytes: Uint8Array;
  /** Seconds. */
  duration: number;
  /** Start and end of each input, in seconds from the start of this piece. */
  spans: { start: number; end: number }[];
}

/** Speaks one batch of turns as a dialogue (eleven_v3 and later). */
async function speakDialogue(
  model: SpeechModel,
  inputs: { text: string; voiceId: string }[],
  abortSignal?: AbortSignal,
): Promise<Spoken> {
  const result = await generateSpeech({
    model,
    text: "",
    providerOptions: { elevenlabs: { inputs, withTimestamps: true } },
    abortSignal,
  });
  const metadata = (result.providerMetadata?.elevenlabs ?? {}) as {
    outputFormat?: string;
    voiceSegments?: {
      dialogueInputIndex: number;
      startTimeSeconds: number;
      endTimeSeconds: number;
    }[];
  };
  const bytes = result.audio.uint8Array;
  const segments = metadata.voiceSegments ?? [];
  const bitrate = bitrateOf(metadata.outputFormat) ?? 128_000;
  const duration = Math.max(
    (bytes.length * 8) / bitrate,
    ...segments.map((segment) => segment.endTimeSeconds),
  );
  const spans = inputs.map((_, index) => {
    const own = segments.filter((segment) => segment.dialogueInputIndex === index);
    return own.length > 0
      ? {
          start: Math.min(...own.map((segment) => segment.startTimeSeconds)),
          end: Math.max(...own.map((segment) => segment.endTimeSeconds)),
        }
      : null;
  });
  return {
    bytes,
    duration,
    spans: fillSpans(
      spans,
      inputs.map((input) => input.text.length),
      duration,
    ),
  };
}

/** Speaks one turn with one voice (models without dialogue). */
async function speakTurn(
  model: SpeechModel,
  text: string,
  voiceId: string,
  abortSignal?: AbortSignal,
): Promise<Spoken> {
  const result = await generateSpeech({ model, text, voice: voiceId, abortSignal });
  const metadata = (result.providerMetadata?.elevenlabs ?? {}) as { outputFormat?: string };
  const bytes = result.audio.uint8Array;
  const duration = (bytes.length * 8) / (bitrateOf(metadata.outputFormat) ?? 128_000);
  return { bytes, duration, spans: [{ start: 0, end: duration }] };
}

/** Turns without timings share the time left, in proportion to their length. */
export function fillSpans(
  spans: ({ start: number; end: number } | null)[],
  lengths: number[],
  duration: number,
): { start: number; end: number }[] {
  if (spans.every(Boolean)) return spans as { start: number; end: number }[];
  const total = lengths.reduce((sum, length) => sum + length, 0) || 1;
  let at = 0;
  return spans.map((span, index) => {
    const share = (lengths[index] / total) * duration;
    const filled = span ?? { start: at, end: at + share };
    at = filled.end;
    return filled;
  });
}

/** Groups turns into batches below the dialogue request's size. */
export function batchTurns<T extends { text: string }>(turns: T[], limit = BATCH_CHARS): T[][] {
  const batches: T[][] = [];
  let current: T[] = [];
  let size = 0;
  for (const turn of turns) {
    if (current.length > 0 && size + turn.text.length > limit) {
      batches.push(current);
      current = [];
      size = 0;
    }
    current.push(turn);
    size += turn.text.length;
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

export const generateAudioOverview: Generator<AudioOverviewOptions, AudioOverviewData> = async (
  args,
) => {
  const { options, speech } = args;
  if (!speech) throw new Error("Choose a voice service for the audio overview.");
  if (!options.hosts) throw new Error("Choose the voices.");
  const hosts = options.hosts;
  const solo = hosts.length < 2;
  /** The voice of a turn; a narrator speaks every turn. */
  const voiceOf = (speaker: 0 | 1) => (hosts[speaker] ?? hosts[0]).voiceId;

  const { output } = await generateText({
    model: args.model,
    output: Output.object({ schema: modelScript }),
    system: studioSystem(
      scriptTask(
        options,
        hosts.map((host, index) => host.name || `Host ${index === 0 ? "A" : "B"}`),
      ),
      args,
    ),
    prompt: solo ? "Write the monologue." : "Write the conversation.",
    abortSignal: args.abortSignal,
  });

  const known = new Set(args.passages.map((passage) => passage.n));
  const turns = output.turns
    .map((turn) => ({
      speaker: solo || turn.speaker === "A" ? (0 as const) : (1 as const),
      // Citations are never spoken; a stray one is removed with the space before it.
      text: clean(turn.text.replace(/\s*\[\d[\d,\s–-]*\]/g, "")),
      cites: [...new Set(turn.cites)].filter((n) => known.has(n)),
    }))
    .filter((turn) => turn.text.length > 0);
  if (turns.length === 0) throw new Error("The model wrote an empty conversation.");

  const dialogue = (dialogueModels as readonly string[]).includes(speech.ref.modelId);
  const pieces: Spoken[] = [];
  const timed: AudioOverviewData["turns"] = [];
  let offset = 0;
  // One request at a time, in order: each piece follows the last.
  if (dialogue) {
    for (const batch of batchTurns(turns)) {
      const piece = await speakDialogue(
        speech.model,
        batch.map((turn) => ({ text: turn.text, voiceId: voiceOf(turn.speaker) })),
        args.abortSignal,
      );
      batch.forEach((turn, index) =>
        timed.push({
          ...turn,
          start: offset + piece.spans[index].start,
          end: offset + piece.spans[index].end,
        }),
      );
      pieces.push(piece);
      offset += piece.duration;
    }
  } else {
    for (const turn of turns) {
      const piece = await speakTurn(
        speech.model,
        turn.text,
        voiceOf(turn.speaker),
        args.abortSignal,
      );
      timed.push({ ...turn, start: offset, end: offset + piece.duration });
      pieces.push(piece);
      offset += piece.duration;
    }
  }

  const fileId = generateId();
  const cited = new Set(turns.flatMap((turn) => turn.cites));
  return {
    title: clean(output.title) || "Audio Overview",
    data: {
      version: 1,
      hosts,
      turns: timed,
      audio: { fileId, mime: "audio/mpeg", duration: offset },
      speechModel: speech.ref,
      passages: toPassageRefs(args.passages.filter((passage) => cited.has(passage.n))),
    },
    files: [{ id: fileId, mime: "audio/mpeg", bytes: concat(pieces.map((piece) => piece.bytes)) }],
  };
};
