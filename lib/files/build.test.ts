import { describe, expect, it } from "vitest";
import { buildFile, FileBuildError, fileNameFor } from "./build";

describe("create_file builders", () => {
  it("names files safely with their extension", () => {
    expect(fileNameFor({ name: "a/b: report.pdf", format: "pdf" })).toBe("a b report.pdf");
    expect(fileNameFor({ name: "   ", format: "md" })).toBe("Untitled.md");
  });

  it("writes text formats", async () => {
    const md = await buildFile({
      format: "md",
      name: "Notes",
      title: "Plants",
      markdown: "Roots **grow**.",
    });
    expect(await md.blob.text()).toBe("# Plants\n\nRoots **grow**.");
    const html = await buildFile({
      format: "html",
      name: "Page",
      markdown: "| a | b |\n| - | - |\n| 1 | <2> |",
    });
    expect(await html.blob.text()).toContain("<td>&lt;2&gt;</td>");
    const txt = await buildFile({ format: "txt", name: "T", markdown: "- one\n- two" });
    expect(await txt.blob.text()).toBe("- one\n- two");
  });

  it("writes CSV and JSON, and refuses what it can't", async () => {
    const csv = await buildFile({
      format: "csv",
      name: "Table",
      sheets: [
        {
          name: "S",
          rows: [
            ["a", "b, c"],
            [1, null],
          ],
        },
      ],
    });
    expect(await csv.blob.text()).toBe('a,"b, c"\r\n1,');
    const json = await buildFile({ format: "json", name: "J", json: '{"a":1}' });
    expect(JSON.parse(await json.blob.text())).toEqual({ a: 1 });
    await expect(buildFile({ format: "json", name: "J", json: "{" })).rejects.toBeInstanceOf(
      FileBuildError,
    );
    await expect(buildFile({ format: "pdf", name: "P" })).rejects.toBeInstanceOf(FileBuildError);
  });

  it("writes Word, Excel and PowerPoint files", async () => {
    for (const input of [
      { format: "docx" as const, name: "D", markdown: "# Title\n\nText" },
      { format: "xlsx" as const, name: "X", sheets: [{ name: "S", rows: [["a"], [1]] }] },
      { format: "pptx" as const, name: "P", slides: [{ title: "One", bullets: ["a"] }] },
    ]) {
      const { blob } = await buildFile(input);
      const head = new Uint8Array(await blob.slice(0, 2).arrayBuffer());
      expect([...head]).toEqual([0x50, 0x4b]); // A zip, as every Office file is.
    }
  });
});
