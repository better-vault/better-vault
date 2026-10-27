import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";
import { deckTask, generateSlideDeck, normalizeDeck } from "./server";

const empty = {
  subtitle: "",
  bullets: [],
  columns: [],
  stats: [],
  quote: null,
  timeline: [],
  notes: "",
};
const slide = (layout: string, extra: Record<string, unknown> = {}) =>
  ({ ...empty, layout, title: `${layout} slide`, ...extra }) as Parameters<
    typeof normalizeDeck
  >[0]["slides"][number];

describe("normalizeDeck", () => {
  it("adds a title slide when the deck has none", () => {
    const deck = normalizeDeck(
      { title: "Deck", subtitle: "About it", slides: [slide("bullets", { bullets: ["One [1]"] })] },
      "detailed",
    );
    expect(deck.slides.map((s) => s.layout)).toEqual(["title", "bullets"]);
    expect(deck.slides[0]).toMatchObject({ title: "Deck", subtitle: "About it" });
  });

  it("turns layouts without their content into bullets", () => {
    const deck = normalizeDeck(
      {
        title: "Deck",
        subtitle: "",
        slides: [
          slide("title"),
          slide("stats", { stats: [{ value: "40%", label: "Growth", detail: "" }] }),
          slide("comparison", { columns: [{ heading: "A", bullets: ["a1"] }] }),
          slide("quote", { quote: null, bullets: ["Said"] }),
        ],
      },
      "detailed",
    );
    expect(deck.slides.map((s) => s.layout)).toEqual(["title", "bullets", "bullets", "bullets"]);
    expect(deck.slides[1].bullets).toEqual(["40%: Growth"]);
    expect(deck.slides[2].bullets).toEqual(["a1"]);
  });

  it("keeps only what each layout uses, and caps lists by format", () => {
    const many = Array.from({ length: 9 }, (_, i) => `Point ${i}`);
    const deck = normalizeDeck(
      {
        title: "Deck",
        subtitle: "",
        slides: [
          slide("title", { bullets: many }),
          slide("bullets", { bullets: many, notes: "Say this" }),
        ],
      },
      "presenter",
    );
    expect(deck.slides[0].bullets).toEqual([]);
    expect(deck.slides[1].bullets).toHaveLength(4);
    expect(deck.slides[1].notes).toBe("Say this");
  });

  it("drops notes from detailed decks and caps the deck at 25 slides", () => {
    const slides = [
      slide("title"),
      ...Array.from({ length: 30 }, () => slide("bullets", { bullets: ["x"], notes: "n" })),
    ];
    const deck = normalizeDeck({ title: "Deck", subtitle: "", slides }, "detailed");
    expect(deck.slides).toHaveLength(25);
    expect(deck.slides[1].notes).toBe("");
  });

  it("refuses an empty deck", () => {
    expect(() =>
      normalizeDeck(
        { title: "", subtitle: "", slides: [slide("bullets", { title: "" })] },
        "detailed",
      ),
    ).toThrow();
  });
});

describe("deckTask", () => {
  it("asks for the slide count of the format and length", () => {
    expect(deckTask({ format: "detailed", length: "short" })).toContain("6 to 9 slides");
    expect(deckTask({ format: "presenter", length: "default" })).toContain("10 to 15 slides");
    expect(deckTask({ format: "presenter", length: "short" })).toContain("notes");
  });
});

describe("generateSlideDeck", () => {
  it("returns a normalised deck with its passages", async () => {
    const answer = {
      title: "Ventures",
      subtitle: "How ideas grow",
      slides: [
        slide("title", { title: "Ventures" }),
        slide("bullets", { bullets: ["Ideas need tests [1]"] }),
      ],
    };
    const model = new MockLanguageModelV4({
      doGenerate: async () => ({
        content: [{ type: "text", text: JSON.stringify(answer) }],
        finishReason: { unified: "stop", raw: undefined },
        usage: {
          inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
          outputTokens: { total: 1, text: 1, reasoning: undefined },
        },
        warnings: [],
      }),
    });
    const passages = [
      {
        n: 1,
        chunkId: "s:0",
        sourceId: "s",
        title: "Notes",
        kind: "text" as const,
        text: "Ideas need tests.",
      },
    ];
    const result = await generateSlideDeck({
      model,
      options: { format: "detailed", length: "short" },
      language: "auto",
      focus: "",
      passages,
    });
    expect(result.title).toBe("Ventures");
    expect(result.data.slides).toHaveLength(2);
    expect(result.data.passages[0].snippet).toBe("Ideas need tests.");
  });
});
