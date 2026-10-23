import { describe, expect, it } from "vitest";
import { chunkText, normaliseText } from "./chunk";

describe("normaliseText", () => {
  it("collapses whitespace and blank lines", () => {
    expect(normaliseText("a  b\r\n\r\n\r\n\r\nc \n d")).toBe("a b\n\nc\nd");
  });
});

describe("chunkText", () => {
  it("returns nothing for empty text", () => {
    expect(chunkText("   \n\n ")).toEqual([]);
  });

  it("keeps short paragraphs together", () => {
    expect(chunkText("One.\n\nTwo.", 100)).toEqual(["One.\n\nTwo."]);
  });

  it("starts a new passage when the next paragraph does not fit", () => {
    const a = "a".repeat(60);
    const b = "b".repeat(60);
    expect(chunkText(`${a}\n\n${b}`, 100)).toEqual([a, b]);
  });

  it("splits long paragraphs at sentence ends", () => {
    const sentence = "This is a sentence of some length. ";
    const chunks = chunkText(sentence.repeat(20), 120);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(120);
      expect(chunk.endsWith(".")).toBe(true);
    }
  });

  it("hard-splits text without sentence ends", () => {
    const chunks = chunkText("x".repeat(250), 100);
    expect(chunks.map((c) => c.length)).toEqual([100, 100, 50]);
  });

  it("loses no words", () => {
    const words = Array.from({ length: 500 }, (_, i) => `word${i}`);
    const text = words.join(" ").replace(/word(\d*0) /g, "word$1. ");
    const joined = chunkText(text, 200).join(" ");
    for (const word of words) expect(joined).toContain(word);
  });
});
