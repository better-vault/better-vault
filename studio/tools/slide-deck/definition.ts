import { z } from "zod";
import { passageRefSchema } from "@/lib/grounding/passage-schema";
import { defineTool } from "@/studio/types";

export const slideFormats = ["detailed", "presenter"] as const;
export const slideLengths = ["short", "default"] as const;
export const slideLayouts = [
  "title",
  "section",
  "bullets",
  "two-column",
  "comparison",
  "stats",
  "quote",
  "timeline",
  "closing",
] as const;

export type SlideFormat = (typeof slideFormats)[number];
export type SlideLength = (typeof slideLengths)[number];
export type SlideLayout = (typeof slideLayouts)[number];

export const slideDeckOptions = z.object({
  format: z.enum(slideFormats),
  length: z.enum(slideLengths),
});

// Saved decks are read leniently: a field that is missing or broken gets its
// default, so an older or partial deck still opens.
const text = z.string().catch("");
const list = z.array(z.string()).catch([]);

export const slideSchema = z.object({
  layout: z.enum(slideLayouts).catch("bullets"),
  title: text,
  subtitle: text,
  bullets: list,
  columns: z.array(z.object({ heading: text, bullets: list })).catch([]),
  stats: z.array(z.object({ value: text, label: text, detail: text })).catch([]),
  quote: z.object({ text: z.string(), attribution: text }).nullable().catch(null),
  timeline: z.array(z.object({ when: text, title: text, detail: text })).catch([]),
  /** What the presenter says, with citations. */
  notes: text,
});

export const slideDeckData = z.object({
  version: z.literal(1).catch(1),
  format: z.enum(slideFormats).catch("detailed"),
  subtitle: text,
  slides: z.array(slideSchema).min(1),
  /** The passages the slides and notes may cite as [n]. */
  passages: z.array(passageRefSchema),
});

export type SlideDeckOptions = z.infer<typeof slideDeckOptions>;
export type Slide = z.infer<typeof slideSchema>;
export type SlideDeckData = z.infer<typeof slideDeckData>;

export const slideDeckTool = defineTool({
  id: "slide-deck",
  options: slideDeckOptions,
  defaults: { format: "detailed", length: "default" } satisfies SlideDeckOptions,
  data: slideDeckData,
  exports: [
    {
      format: "pptx",
      build: async (title, data, text) => {
        const [{ buildPptx }, { deckPalette }] = await Promise.all([
          import("./pptx"),
          import("./palette"),
        ]);
        return buildPptx(title, data, deckPalette(), text);
      },
    },
    {
      format: "pdf",
      print: (title) => {
        void import("./print").then(({ printDeck }) => printDeck(title));
      },
    },
  ],
});
