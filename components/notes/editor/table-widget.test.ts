import { describe, expect, it } from "vitest";
import { parseTable, tableMarkdown } from "./table-widget";

describe("note tables", () => {
  it("reads a table's cells and alignments, and writes them back as Markdown", () => {
    const model = parseTable("| Name | Age |\n| :-- | --: |\n| Ada | 36 |\n| Linus |");
    expect(model.rows).toEqual([
      ["Name", "Age"],
      ["Ada", "36"],
      ["Linus", ""],
    ]);
    expect(model.aligns).toEqual(["left", "right"]);
    const markdown = tableMarkdown(model);
    expect(markdown.split("\n")).toEqual([
      "| Name  | Age |",
      "| ----- | --: |",
      "| Ada   | 36  |",
      "| Linus |     |",
    ]);
    expect(parseTable(markdown)).toEqual(model);
  });

  it("keeps pipes inside cells, and a centred column", () => {
    const model = {
      rows: [
        ["a|b", "c"],
        ["1", "2"],
      ],
      aligns: ["center", "left"] as const,
    };
    const markdown = tableMarkdown({ rows: model.rows, aligns: [...model.aligns] });
    expect(markdown).toContain("a\\|b");
    expect(markdown.split("\n")[1]).toMatch(/^\| :-+: \| -+ \|$/);
    expect(parseTable(markdown).rows[0][0]).toBe("a|b");
  });
});
