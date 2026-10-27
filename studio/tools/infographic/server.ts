import { generateImage, generateText, NoImageGeneratedError, Output } from "ai";
import { z } from "zod";
import type { ModelRef } from "@/lib/ai/catalog";
import { stripCitations, toPassageRefs } from "@/lib/grounding/passages";
import { clean, studioSystem, type Generator } from "@/studio/server/shared";
import type {
  Brief,
  InfographicData,
  InfographicDetail,
  InfographicOptions,
  InfographicStyle,
  Orientation,
} from "./definition";

// The model-facing brief: flat and every field required, for strict structured outputs.
const modelBrief = z.object({
  title: z.string().describe("The infographic's title, 3 to 8 words, without citations"),
  subtitle: z.string().describe("One short line under the title, without citations"),
  sections: z.array(
    z.object({
      heading: z.string().describe("2 to 5 words, without citations"),
      points: z.array(
        z.object({
          text: z.string().describe("The point in full, citing passages like [2]"),
          short: z
            .string()
            .describe(
              "The same point in 8 words or fewer, without citations: what the picture shows",
            ),
        }),
      ),
      visual: z.string().describe("A simple picture or icon for the section, in a few words"),
    }),
  ),
  numbers: z
    .array(
      z.object({
        value: z.string().describe("A number from the passages, e.g. 40% or 3"),
        label: z.string().describe("What it counts, in a few words, citing its passage like [2]"),
      }),
    )
    .describe("Only numbers that appear in the passages; empty if there are none"),
  takeaway: z
    .string()
    .describe("The one thing to remember, in one short sentence, without citations"),
  layout: z
    .string()
    .describe("How to lay the sections out, e.g. a timeline, a cycle, columns or a comparison"),
});

const COUNTS: Record<InfographicDetail, { sections: string; points: string; numbers: number }> = {
  concise: { sections: "3", points: "1 or 2", numbers: 2 },
  standard: { sections: "4 or 5", points: "2 or 3", numbers: 3 },
  detailed: { sections: "6", points: "3", numbers: 4 },
};

const STYLES: Record<InfographicStyle, string> = {
  auto: "a clean, modern infographic style that suits the subject",
  professional:
    "a polished corporate style: flat vector shapes, a restrained palette, generous white space",
  editorial:
    "a magazine editorial style: strong typography, bold section headings, elegant illustrations",
  "sketch-note":
    "a hand-drawn sketch-note style: marker lettering, doodled icons, arrows and frames",
  playful: "a bright, playful style: rounded shapes, friendly characters, cheerful colours",
  scientific: "a precise scientific poster style: diagrams, labelled figures, a neutral palette",
  minimal: "a minimal style: a few colours, simple line icons, lots of space",
};

const ORIENTATIONS: Record<Orientation, string> = {
  landscape: "landscape (wider than tall)",
  portrait: "portrait (taller than wide)",
  square: "square",
};

export function briefTask({ detail }: InfographicOptions): string {
  const counts = COUNTS[detail];
  return `Plan a one-page infographic that sums up the sources. An image model will draw it from your plan, so keep every text that appears in the picture short.

- ${counts.sections} sections, each with ${counts.points} points. Each point has the full sentence with its citation, and a short version (8 words or fewer, no citations) that the picture shows.
- Up to ${counts.numbers} key numbers, only ones that appear in the passages.
- A title, a subtitle, a takeaway, and a layout that fits the content (a timeline for steps, a comparison for two sides, a cycle for loops, columns otherwise).`;
}

const short = (point: { text: string; short: string }) => {
  const value = clean(point.short) || clean(stripCitations(point.text));
  const words = value.split(" ");
  return words.length > 10 ? `${words.slice(0, 10).join(" ")}…` : value;
};

/** The brief cleaned: no citations in what is drawn, empty parts dropped. */
export function normalizeBrief(raw: z.infer<typeof modelBrief>, detail: InfographicDetail): Brief {
  const sections = raw.sections
    .map((section) => ({
      heading: clean(stripCitations(section.heading)),
      points: section.points
        .map((point) => ({ text: point.text.trim(), short: short(point) }))
        .filter((point) => point.text || point.short)
        .slice(0, 4),
      visual: clean(section.visual),
    }))
    .filter((section) => section.heading || section.points.length > 0)
    .slice(0, 6);
  if (sections.length === 0) throw new Error("The model planned no sections.");
  return {
    title: clean(stripCitations(raw.title)) || "Infographic",
    subtitle: clean(stripCitations(raw.subtitle)),
    sections,
    numbers: raw.numbers
      .map((number) => ({ value: clean(number.value), label: number.label.trim() }))
      .filter((number) => number.value)
      .slice(0, COUNTS[detail].numbers),
    takeaway: clean(stripCitations(raw.takeaway)),
    layout: clean(raw.layout),
  };
}

const quote = (text: string) => `"${text.replace(/"/g, "'")}"`;

/** What the image model is asked to draw: only the short texts, quoted, and how to draw them. */
export function buildImagePrompt(
  brief: Brief,
  { orientation, style }: Pick<InfographicOptions, "orientation" | "style">,
): string {
  const lines = [
    `Design a ${ORIENTATIONS[orientation]} infographic poster in ${STYLES[style]}.`,
    "",
    `Title at the top: ${quote(brief.title)}`,
    brief.subtitle ? `Subtitle: ${quote(brief.subtitle)}` : "",
    "",
    `Layout: ${brief.layout || "clear sections in reading order"}.`,
    "",
    "Sections:",
    ...brief.sections.map(
      (section, at) =>
        `${at + 1}. Heading ${quote(section.heading)}; points: ${section.points.map((point) => quote(point.short)).join(", ")}${
          section.visual ? `; picture: ${section.visual}` : ""
        }.`,
    ),
    brief.numbers.length > 0
      ? `\nKey numbers, shown large: ${brief.numbers.map((number) => `${quote(number.value)} with ${quote(clean(stripCitations(number.label)))}`).join("; ")}.`
      : "",
    brief.takeaway ? `\nAt the bottom: ${quote(brief.takeaway)}` : "",
    "",
    "Draw every quoted text exactly as written, spelled correctly, large and legible. Add no other text: no citation numbers, no watermark, no logos, no lorem ipsum. Give each section an icon or a small illustration, keep a clear visual hierarchy, and use colours with good contrast.",
  ];
  return lines
    .filter((line, at, all) => line !== "" || all[at - 1] !== "")
    .join("\n")
    .trim();
}

type ImageCallSettings = Pick<
  Parameters<typeof generateImage>[0],
  "size" | "aspectRatio" | "providerOptions"
>;

/** Size and output settings per provider: OpenAI takes a size, Google an aspect ratio. */
export function imageCallSettings(ref: ModelRef, orientation: Orientation): ImageCallSettings {
  if (ref.provider === "google") {
    return {
      aspectRatio: ({ landscape: "3:2", portrait: "2:3", square: "1:1" } as const)[orientation],
      providerOptions: {
        google: {
          imageConfig: {
            // 2K only where the model offers it; JPEG keeps the file small.
            ...(ref.modelId.includes("pro") ? { imageSize: "2K" as const } : {}),
            imageOutputOptions: { mimeType: "image/jpeg" as const, compressionQuality: 85 },
          },
        },
      },
    };
  }
  return {
    size: ({ landscape: "1536x1024", portrait: "1024x1536", square: "1024x1024" } as const)[
      orientation
    ],
    providerOptions: { openai: { quality: "high", outputFormat: "webp", outputCompression: 85 } },
  };
}

const FALLBACK: Record<Orientation, { width: number; height: number }> = {
  landscape: { width: 1536, height: 1024 },
  portrait: { width: 1024, height: 1536 },
  square: { width: 1024, height: 1024 },
};

/** Reads the width and height of a PNG, JPEG or WebP file from its header. */
export function imageDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const ascii = (at: number, length: number) =>
    String.fromCharCode(...bytes.subarray(at, at + length));
  if (bytes.length >= 24 && ascii(1, 3) === "PNG")
    return { width: view.getUint32(16), height: view.getUint32(20) };
  if (bytes.length >= 30 && ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") {
    const chunk = ascii(12, 4);
    if (chunk === "VP8 ")
      return {
        width: view.getUint16(26, true) & 0x3fff,
        height: view.getUint16(28, true) & 0x3fff,
      };
    if (chunk === "VP8L") {
      const bits = view.getUint32(21, true);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
    if (chunk === "VP8X") {
      const width = 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16));
      const height = 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16));
      return { width, height };
    }
  }
  if (bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let at = 2;
    while (at + 9 < bytes.length) {
      if (bytes[at] !== 0xff) return null;
      const marker = bytes[at + 1];
      const length = view.getUint16(at + 2);
      // Start-of-frame markers hold the size; 0xC4, 0xC8 and 0xCC are not frames.
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { width: view.getUint16(at + 7), height: view.getUint16(at + 5) };
      }
      at += 2 + length;
    }
  }
  return null;
}

/** Above this, the answer could pass the 4.5 MB limit of hosted functions. */
const MAX_BASE64 = 3_800_000;

export const generateInfographic: Generator<InfographicOptions, InfographicData> = async ({
  model,
  options,
  image: imageModel,
  abortSignal,
  ...args
}) => {
  if (!imageModel) throw new Error("Choose an image model.");
  const { output } = await generateText({
    model,
    output: Output.object({ schema: modelBrief }),
    system: studioSystem(briefTask(options), args),
    prompt: "Plan the infographic now.",
    abortSignal,
  });
  const brief = normalizeBrief(output, options.detail);
  const prompt = buildImagePrompt(brief, options);

  let picture;
  try {
    ({ image: picture } = await generateImage({
      model: imageModel.model,
      prompt,
      ...imageCallSettings(imageModel.ref, options.orientation),
      abortSignal,
    }));
  } catch (error) {
    if (NoImageGeneratedError.isInstance(error)) {
      throw new Error(
        "The image model returned no picture. It may have declined the request; try another style or model.",
      );
    }
    throw error;
  }
  if (picture.base64.length > MAX_BASE64) {
    throw new Error(
      "The picture is too large to send back. Try another image model or a square picture.",
    );
  }
  const size = imageDimensions(picture.uint8Array) ?? FALLBACK[options.orientation];
  return {
    title: brief.title,
    data: {
      version: 1,
      brief,
      image: {
        dataUrl: `data:${picture.mediaType};base64,${picture.base64}`,
        mediaType: picture.mediaType,
        ...size,
      },
      prompt,
      imageModel: imageModel.ref,
      orientation: options.orientation,
      passages: toPassageRefs(args.passages),
    },
  };
};
