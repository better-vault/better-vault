import { describe, expect, it } from "vitest";
import { reflow } from "./reflow";

describe("reflow", () => {
  it("joins lines a PDF wrapped mid-sentence", () => {
    const text = [
      "How to use this summary. Every answer below uses the exact wording from",
      "the slides (nothing rephrased).",
      "Only the yellow HOOK boxes are extra — they are memory tricks, not",
      "answers.",
    ].join("\n");
    expect(reflow(text).map((block) => block.text)).toEqual([
      "How to use this summary. Every answer below uses the exact wording from the slides (nothing rephrased).",
      "Only the yellow HOOK boxes are extra — they are memory tricks, not answers.",
    ]);
  });

  it("keeps short titles apart", () => {
    expect(
      reflow("Contents\nInternet of Things IoT\nQuantum computing").map((b) => b.text),
    ).toEqual(["Contents", "Internet of Things IoT", "Quantum computing"]);
  });

  it("joins a title that wraps after an ampersand", () => {
    expect(reflow("Quantum Cloud Edge &\nFog")[0].text).toBe("Quantum Cloud Edge & Fog");
  });

  it("keeps bullets as items and mends hyphenated words", () => {
    expect(
      reflow("• First point that is long enough to have been wrap-\nped by the page\n• Second"),
    ).toEqual([
      { kind: "item", text: "First point that is long enough to have been wrapped by the page" },
      { kind: "item", text: "Second" },
    ]);
  });

  it("starts a new paragraph after a blank line", () => {
    expect(
      reflow("One sentence here that goes on for a while and wraps\n\nNext one."),
    ).toHaveLength(2);
  });
});
