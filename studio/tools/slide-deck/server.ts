import { generateText, Output } from "ai";
import { z } from "zod";
import { toPassageRefs } from "@/lib/grounding/passages";
import { clean, studioSystem, type Generator } from "@/studio/server/shared";
import {
  slideLayouts,
  type Slide,
  type SlideDeckData,
  type SlideDeckOptions,
  type SlideFormat,
} from "./definition";

// The model-facing schema is flat and every field is required: strict
// structured outputs (OpenAI, Gemini, Anthropic) take it as it is. Fields a
// layout doesn't use are empty.
const modelSlide = z.object({
  layout: z.enum(slideLayouts),
  title: z.string().describe("The slide's title, without citations"),
  subtitle: z
    .string()
    .describe(
      "A short line under the title for title, section and closing slides; empty otherwise",
    ),
  bullets: z
    .array(z.string())
    .describe("The slide's points, citing passages like [2]; empty for layouts without bullets"),
  columns: z
    .array(z.object({ heading: z.string(), bullets: z.array(z.string()) }))
    .describe("Exactly two for two-column and comparison slides; empty otherwise"),
  stats: z
    .array(z.object({ value: z.string(), label: z.string(), detail: z.string() }))
    .describe("2 to 4 numbers taken from the passages, for stats slides; empty otherwise"),
  quote: z
    .object({ text: z.string(), attribution: z.string() })
    .nullable()
    .describe("A quote copied word for word from a passage, for quote slides; null otherwise"),
  timeline: z
    .array(z.object({ when: z.string(), title: z.string(), detail: z.string() }))
    .describe("3 to 6 events in order, for timeline slides; empty otherwise"),
  notes: z.string().describe("What the presenter says, citing passages; empty for detailed decks"),
});

const modelDeck = z.object({
  title: z.string().describe("The deck's title"),
  subtitle: z.string().describe("One line about what the deck covers"),
  slides: z.array(modelSlide),
});

type ModelSlide = z.infer<typeof modelSlide>;

const COUNTS: Record<SlideFormat, Record<SlideDeckOptions["length"], string>> = {
  detailed: { short: "6 to 9", default: "12 to 18" },
  presenter: { short: "5 to 8", default: "10 to 15" },
};

/** Most bullets a slide keeps, by format. */
const MAX_BULLETS: Record<SlideFormat, number> = { detailed: 6, presenter: 4 };
const MAX_SLIDES = 25;

export function deckTask({ format, length }: SlideDeckOptions): string {
  const kind =
    format === "detailed"
      ? `a detailed deck that people read on their own, without a speaker: each slide has 3 to 6 bullets that are full sentences with the key facts, each citing its passage like [2]. Leave "notes" empty.`
      : `presenter slides that support a talk: each slide has at most 4 short bullets of 8 words or fewer (bold claims, key numbers), and "notes" holds what the presenter says, 60 to 120 words, citing passages like [2].`;
  return `Create a slide deck of ${COUNTS[format][length]} slides from the sources: ${kind}

Layouts:
- "title": the first slide only. The deck's title, and a subtitle.
- "section": a divider that opens a part of the deck (title and subtitle). Use them when there are more than 8 slides.
- "bullets": a title and its points.
- "two-column": two related groups side by side, as "columns" with a heading and bullets each.
- "comparison": two things contrasted, as two "columns".
- "stats": 2 to 4 numbers that appear in the passages, each with a short label and a detail.
- "quote": a quote copied word for word from a passage, with who said or wrote it.
- "timeline": 3 to 6 events or steps in order, each with when, a title and a detail.
- "closing": the last slide. The main takeaways as bullets.

Rules: start with "title" and end with "closing". Vary the layouts where the content suits them, but never invent numbers, quotes or dates. Titles have no citations.`;
}

const cleanList = (items: readonly string[], max: number) =>
  items.map(clean).filter(Boolean).slice(0, max);

/** A slide with only what its layout uses, and a broken layout turned into plain bullets. */
function normalizeSlide(raw: ModelSlide, format: SlideFormat): Slide {
  const maxBullets = MAX_BULLETS[format];
  const bullets = cleanList(raw.bullets, maxBullets);
  const columns = raw.columns
    .map((column) => ({
      heading: clean(column.heading),
      bullets: cleanList(column.bullets, maxBullets),
    }))
    .filter((column) => column.heading || column.bullets.length > 0);
  const stats = raw.stats
    .map((stat) => ({
      value: clean(stat.value),
      label: clean(stat.label),
      detail: clean(stat.detail),
    }))
    .filter((stat) => stat.value)
    .slice(0, 4);
  const timeline = raw.timeline
    .map((event) => ({
      when: clean(event.when),
      title: clean(event.title),
      detail: clean(event.detail),
    }))
    .filter((event) => event.when || event.title)
    .slice(0, 6);
  const quote =
    raw.quote && clean(raw.quote.text)
      ? { text: clean(raw.quote.text), attribution: clean(raw.quote.attribution) }
      : null;
  const base: Slide = {
    layout: raw.layout,
    title: clean(raw.title),
    subtitle: "",
    bullets: [],
    columns: [],
    stats: [],
    quote: null,
    timeline: [],
    notes: format === "presenter" ? raw.notes.trim() : "",
  };
  // What a layout can't show becomes bullets, from whatever the slide has.
  const fallback = (): Slide => ({
    ...base,
    layout: "bullets",
    bullets: bullets.length
      ? bullets
      : [
          ...columns.flatMap((column) => column.bullets),
          ...stats.map((stat) => `${stat.value}: ${stat.label}`),
          ...timeline.map((event) => `${event.when} ${event.title}`.trim()),
          ...(quote ? [quote.text] : []),
        ].slice(0, maxBullets),
  });
  switch (raw.layout) {
    case "title":
    case "section":
      return { ...base, subtitle: clean(raw.subtitle) };
    case "closing":
      return { ...base, subtitle: clean(raw.subtitle), bullets };
    case "two-column":
    case "comparison":
      return columns.length === 2 ? { ...base, columns } : fallback();
    case "stats":
      return stats.length >= 2 ? { ...base, stats } : fallback();
    case "quote":
      return quote ? { ...base, quote } : fallback();
    case "timeline":
      return timeline.length >= 2 ? { ...base, timeline } : fallback();
    case "bullets":
      return { ...base, bullets };
  }
}

/** Cleans the model's deck: layouts that fit their content, a title slide first, at most 25 slides. */
export function normalizeDeck(
  raw: z.infer<typeof modelDeck>,
  format: SlideFormat,
): { title: string; subtitle: string; slides: Slide[] } {
  const title = clean(raw.title) || "Slides";
  const subtitle = clean(raw.subtitle);
  let slides = raw.slides
    .map((slide) => normalizeSlide(slide, format))
    .filter(
      (slide) =>
        slide.title ||
        slide.bullets.length > 0 ||
        slide.columns.length > 0 ||
        slide.stats.length > 0 ||
        slide.quote ||
        slide.timeline.length > 0,
    );
  if (slides.length === 0) throw new Error("The model returned no slides.");
  if (slides[0].layout !== "title") {
    slides = [
      {
        layout: "title",
        title,
        subtitle,
        bullets: [],
        columns: [],
        stats: [],
        quote: null,
        timeline: [],
        notes: "",
      },
      ...slides,
    ];
  }
  return { title, subtitle, slides: slides.slice(0, MAX_SLIDES) };
}

export const generateSlideDeck: Generator<SlideDeckOptions, SlideDeckData> = async ({
  model,
  options,
  abortSignal,
  ...args
}) => {
  const { output } = await generateText({
    model,
    output: Output.object({ schema: modelDeck }),
    system: studioSystem(deckTask(options), args),
    prompt: "Create the slides now.",
    abortSignal,
  });
  const deck = normalizeDeck(output, options.format);
  return {
    title: deck.title,
    data: {
      version: 1,
      format: options.format,
      subtitle: deck.subtitle,
      slides: deck.slides,
      passages: toPassageRefs(args.passages),
    },
  };
};
