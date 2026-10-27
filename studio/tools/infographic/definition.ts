import { z } from "zod";
import { imageModelRefSchema } from "@/lib/ai/request";
import { passageRefSchema } from "@/lib/grounding/passage-schema";
import { defineTool } from "@/studio/types";

export const orientations = ["landscape", "portrait", "square"] as const;
export const infographicStyles = [
  "auto",
  "professional",
  "editorial",
  "sketch-note",
  "playful",
  "scientific",
  "minimal",
] as const;
export const infographicDetails = ["concise", "standard", "detailed"] as const;

export type Orientation = (typeof orientations)[number];
export type InfographicStyle = (typeof infographicStyles)[number];
export type InfographicDetail = (typeof infographicDetails)[number];

export const infographicOptions = z.object({
  orientation: z.enum(orientations),
  style: z.enum(infographicStyles),
  detail: z.enum(infographicDetails),
  /** The image model that draws the picture; chosen in the dialog. */
  imageModel: imageModelRefSchema.nullable(),
});

const text = z.string().catch("");

/** Only raster images in data URLs: no SVG, no links. */
const RASTER_DATA_URL = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/;

export const briefSchema = z.object({
  title: z.string(),
  subtitle: text,
  sections: z
    .array(
      z.object({
        heading: text,
        points: z.array(z.object({ text, short: text })).catch([]),
        visual: text,
      }),
    )
    .catch([]),
  numbers: z.array(z.object({ value: text, label: text })).catch([]),
  takeaway: text,
  layout: text,
});

export const infographicData = z.object({
  version: z.literal(1).catch(1),
  /** What the picture says, with citations: the reliable text, as image models can misspell. */
  brief: briefSchema,
  image: z.object({
    dataUrl: z.string().regex(RASTER_DATA_URL),
    mediaType: z.string(),
    width: z.number(),
    height: z.number(),
  }),
  prompt: text,
  imageModel: z.object({ provider: z.string(), modelId: z.string() }),
  orientation: z.enum(orientations).catch("landscape"),
  passages: z.array(passageRefSchema),
});

export type InfographicOptions = z.infer<typeof infographicOptions>;
export type Brief = z.infer<typeof briefSchema>;
export type InfographicData = z.infer<typeof infographicData>;

const EXTENSIONS: Record<string, string> = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/png": "png",
};

export const infographicTool = defineTool({
  id: "infographic",
  options: infographicOptions,
  defaults: {
    orientation: "landscape",
    style: "auto",
    detail: "standard",
    imageModel: null,
  } satisfies InfographicOptions,
  data: infographicData,
  imageModel: (options) => options.imageModel,
  exports: [
    {
      format: "png",
      build: async (_title, data) => {
        const { rasterToPng } = await import("@/studio/exports/image");
        return rasterToPng(data.image.dataUrl);
      },
    },
    {
      format: "image",
      extension: (data) => EXTENSIONS[data.image.mediaType] ?? "png",
      build: async (_title, data) => (await fetch(data.image.dataUrl)).blob(),
    },
  ],
});
