import { describe, expect, it } from "vitest";
import { normaliseText } from "./chunk";
import { cleanText } from "./clean";

describe("cleanText", () => {
  it("drops characters a PDF gave no text for", () => {
    expect(cleanText("Q What is Course Outcome 5 CO5?")).toBe("Q What is Course Outcome 5 CO5?");
    expect(cleanText(" Identify  Assets")).toBe(" Identify Assets");
  });

  it("drops control characters and invisible marks but keeps lines and tabs", () => {
    expect(cleanText("a\u0000b\u0007c​d﻿e­f�")).toBe("abcdef");
    expect(cleanText("one\ttwo\nthree")).toBe("one\ttwo\nthree");
  });

  it("keeps the joiners other scripts need", () => {
    expect(cleanText("می‌خواهم")).toBe("می‌خواهم");
    expect(cleanText("👩‍💻")).toBe("👩‍💻");
  });

  it("fixes quotes PDFs get wrong and expands ligatures", () => {
    expect(cleanText("“I Eat Riceˮ and itʼs")).toBe("“I Eat Rice” and it’s");
    expect(cleanText("ﬁnd the ﬂow")).toBe("find the flow");
  });

  it("composes accents", () => {
    expect(cleanText("café")).toBe("café");
  });

  it("runs as part of normaliseText", () => {
    expect(normaliseText("Step   one\r\n\r\n\r\nnext")).toBe("Step one\n\nnext");
  });
});
