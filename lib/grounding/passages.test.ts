import { describe, expect, it } from "vitest";
import type { Chunk } from "@/lib/db/database";
import {
  citedNumbers,
  formatPassages,
  linkCitations,
  selectPassages,
  stripCitations,
  toPassageRefs,
} from "./passages";

const sources = [
  { id: "a", title: "Alpha", kind: "text" as const },
  { id: "b", title: "Beta", kind: "pdf" as const },
];

function chunks(sourceId: string, texts: string[]): Chunk[] {
  return texts.map((text, index) => ({
    id: `${sourceId}:${index}`,
    notebookId: "n",
    sourceId,
    index,
    text,
  }));
}

describe("selectPassages", () => {
  it("sends everything, numbered in reading order, when it fits", () => {
    const all = [...chunks("a", ["one", "two"]), ...chunks("b", ["three"])];
    const passages = selectPassages({ sources, chunks: all, budget: 1000 });
    expect(passages.map((p) => [p.n, p.chunkId, p.title])).toEqual([
      [1, "a:0", "Alpha"],
      [2, "a:1", "Alpha"],
      [3, "b:0", "Beta"],
    ]);
  });

  it("prefers passages that match the question when over budget", () => {
    const filler = Array.from(
      { length: 20 },
      (_, i) => `filler text number ${i} about nothing in particular`,
    );
    const all = [
      ...chunks("a", [...filler, "the feasibility analysis checks the market"]),
      ...chunks("b", filler),
    ];
    const passages = selectPassages({
      sources,
      chunks: all,
      budget: 200,
      query: "feasibility analysis",
    });
    expect(passages.some((p) => p.text.includes("feasibility"))).toBe(true);
    expect(passages.reduce((sum, p) => sum + p.text.length, 0)).toBeLessThanOrEqual(200);
  });

  it("spreads over every source without a question", () => {
    const all = [
      ...chunks("a", Array(30).fill("a".repeat(50))),
      ...chunks("b", Array(30).fill("b".repeat(50))),
    ];
    const passages = selectPassages({ sources, chunks: all, budget: 1000 });
    expect(new Set(passages.map((p) => p.sourceId))).toEqual(new Set(["a", "b"]));
    expect(passages.reduce((sum, p) => sum + p.text.length, 0)).toBeLessThanOrEqual(1000);
  });

  it("ignores chunks of unselected sources", () => {
    const passages = selectPassages({
      sources: [sources[0]],
      chunks: [...chunks("a", ["x"]), ...chunks("b", ["y"])],
      budget: 100,
    });
    expect(passages.map((p) => p.sourceId)).toEqual(["a"]);
  });
});

describe("citations", () => {
  it("finds cited numbers, including lists and ranges", () => {
    expect(citedNumbers("A [2]. B [1, 3]. C [4-5][2].")).toEqual([2, 1, 3, 4, 5]);
  });

  it("links known numbers and leaves the rest", () => {
    expect(linkCitations("Fact [1][9] and [2, 3].", new Set([1, 2, 3]))).toBe(
      "Fact [1](#cite-1)[9] and [2](#cite-2)[3](#cite-3).",
    );
  });

  it("leaves Markdown links alone", () => {
    expect(linkCitations("see [1](https://x.y)", new Set([1]))).toBe("see [1](https://x.y)");
  });

  it("strips citations from old answers", () => {
    expect(stripCitations("Growth matters [1][2]. Risk [3], too.")).toBe(
      "Growth matters. Risk, too.",
    );
  });

  it("formats passages and shortens snippets", () => {
    const passages = selectPassages({
      sources,
      chunks: chunks("a", ["x".repeat(400)]),
      budget: 1000,
    });
    expect(formatPassages(passages)).toContain('<passage n="1" source="Alpha">');
    expect(toPassageRefs(passages)[0].snippet.length).toBeLessThanOrEqual(278);
  });
});
