import { z } from "zod";
import { speechModelRefSchema } from "@/lib/ai/request";
import { passageRefSchema } from "@/lib/grounding/passage-schema";
import { defineTool } from "@/studio/types";

/**
 * An Audio Overview: two hosts talk the sources through, as in NotebookLM.
 * The chat model writes the conversation; ElevenLabs speaks it with two
 * voices. The sound is kept as a file beside the output (lib/db/blobs.ts).
 */
export const audioLengths = ["short", "medium", "long"] as const;
export type AudioLength = (typeof audioLengths)[number];

export const audioFormats = ["deep-dive", "brief", "debate"] as const;
export type AudioFormat = (typeof audioFormats)[number];

/** Spoken words per minute, used for the estimate in the dialog and the script's budget. */
export const WORDS_PER_MINUTE = 150;

/** About how long each length runs, in minutes. */
export const LENGTH_MINUTES: Record<AudioLength, number> = { short: 3, medium: 7, long: 12 };

/** The ElevenLabs models that speak a two-voice dialogue (Text to Dialogue). */
export const dialogueModels = ["eleven_v3", "eleven_v4"] as const;

const host = z.object({ voiceId: z.string().min(1).max(100), name: z.string().max(60) });

export const audioOverviewOptions = z.object({
  length: z.enum(audioLengths),
  format: z.enum(audioFormats),
  /** The two voices; their names are the hosts' names. */
  hosts: z.tuple([host, host]).nullable(),
  speechModel: speechModelRefSchema.nullable(),
});

const text = z.string().catch("");

export const audioOverviewData = z.object({
  version: z.literal(1).catch(1),
  hosts: z.tuple([host, host]),
  turns: z.array(
    z.object({
      /** 0 or 1: which host speaks. */
      speaker: z.union([z.literal(0), z.literal(1)]),
      /** What is said, without citations. */
      text,
      /** The passages this turn draws on. */
      cites: z.array(z.number()).catch([]),
      /** Where the turn starts and ends in the recording, in seconds. */
      start: z.number(),
      end: z.number(),
    }),
  ),
  audio: z.object({ fileId: z.string(), mime: z.string(), duration: z.number() }),
  speechModel: z.object({ provider: z.string(), modelId: z.string() }),
  passages: z.array(passageRefSchema),
});

export type AudioOverviewOptions = z.infer<typeof audioOverviewOptions>;
export type AudioOverviewData = z.infer<typeof audioOverviewData>;

export const audioOverviewTool = defineTool({
  id: "audio-overview",
  options: audioOverviewOptions,
  defaults: {
    length: "medium",
    format: "deep-dive",
    hosts: null,
    speechModel: null,
  } satisfies AudioOverviewOptions,
  data: audioOverviewData,
  speechModel: (options) => options.speechModel,
  exports: [
    {
      format: "mp3",
      build: async (_title, data) => {
        const { loadBlob } = await import("@/lib/db/blobs");
        const blob = await loadBlob(data.audio.fileId);
        if (!blob) throw new Error("The recording is missing.");
        return blob;
      },
    },
    {
      format: "md",
      build: async (title, data) => {
        const { textBlob } = await import("@/studio/types");
        const lines = data.turns.map(
          (turn) => `**${data.hosts[turn.speaker].name}:** ${turn.text}`,
        );
        return textBlob(`# ${title}\n\n${lines.join("\n\n")}\n`, "text/markdown");
      },
    },
  ],
});
