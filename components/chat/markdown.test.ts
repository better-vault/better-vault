import { describe, expect, it } from "vitest";
import { headingsOf } from "./markdown";

describe("headingsOf", () => {
  it("lists ## and ### headings with line-based ids, cleaned of formatting", () => {
    const markdown = [
      "Intro [1].",
      "",
      "## Key **takeaways** [2]",
      "Text",
      "### A [link](https://x.y) inside",
      "```",
      "## not a heading",
      "```",
      "## Summary ##",
    ].join("\n");
    expect(headingsOf(markdown)).toEqual([
      { level: 2, text: "Key takeaways", id: "line-3" },
      { level: 3, text: "A link inside", id: "line-5" },
      { level: 2, text: "Summary", id: "line-9" },
    ]);
  });
});
