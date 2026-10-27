import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import type { SlideDeckData } from "./definition";
import { buildPptx, type DeckPalette } from "./pptx";

const palette: DeckPalette = {
  background: "FFFFFF",
  foreground: "111111",
  muted: "F4F4F5",
  mutedForeground: "71717A",
  primary: "18181B",
  primaryForeground: "FAFAFA",
  border: "E4E4E7",
  info: "3B82F6",
  accents: ["3B82F6", "10B981", "F59E0B", "8B5CF6"],
};
const text = {
  question: "Question",
  answer: "Answer",
  answerKey: "Answer key",
  sources: "Sources",
};
const empty = {
  subtitle: "",
  bullets: [],
  columns: [],
  stats: [],
  quote: null,
  timeline: [],
  notes: "",
};

const deck: SlideDeckData = {
  version: 1,
  format: "presenter",
  subtitle: "",
  slides: [
    { ...empty, layout: "title", title: "Ventures", subtitle: "How ideas grow" },
    {
      ...empty,
      layout: "bullets",
      title: "Test early",
      bullets: ["Ideas need tests [1]"],
      notes: "Explain why testing early matters [1].",
    },
    {
      ...empty,
      layout: "stats",
      title: "Numbers",
      stats: [
        { value: "40%", label: "Growth [1]", detail: "" },
        { value: "3", label: "Rounds", detail: "" },
      ],
    },
    {
      ...empty,
      layout: "timeline",
      title: "Steps",
      timeline: [
        { when: "Day 1", title: "Idea", detail: "" },
        { when: "Day 9", title: "Launch", detail: "" },
      ],
    },
  ],
  passages: [
    {
      n: 1,
      chunkId: "s:0",
      sourceId: "s",
      title: "Entrepreneurship notes",
      kind: "text",
      snippet: "Ideas need tests.",
    },
  ],
};

describe("buildPptx", () => {
  it("writes every slide, a Sources slide and the speaker notes, without citation marks", async () => {
    const blob = await buildPptx("Ventures", deck, palette, text);
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const slides = Object.keys(zip.files).filter((name) =>
      /^ppt\/slides\/slide\d+\.xml$/.test(name),
    );
    expect(slides).toHaveLength(deck.slides.length + 1);
    const notes = Object.keys(zip.files).filter((name) =>
      /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(name),
    );
    expect(notes.length).toBeGreaterThan(0);
    const xml = (await Promise.all(slides.map((name) => zip.file(name)!.async("string")))).join("");
    expect(xml).toContain("Test early");
    expect(xml).toContain("Entrepreneurship notes");
    expect(xml).not.toMatch(/\[1\]/);
  });
});
