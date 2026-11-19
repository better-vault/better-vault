import { describe, expect, it } from "vitest";
import { formatOfFile, kindOfFormat, sourceFormatOf } from "./formats";

describe("formatOfFile", () => {
  it.each([
    ["data.csv", "", "csv"],
    ["Report.DOCX", "", "docx"],
    ["deck.pptx", "", "pptx"],
    ["book.epub", "", "epub"],
    ["sheet.xlsx", "", "xlsx"],
    ["config.yml", "", "yaml"],
    ["main.py", "", "code"],
    ["page.htm", "", "html"],
    ["notes.md", "", "markdown"],
    ["upload", "application/pdf", "pdf"],
    ["upload", "text/plain", "text"],
  ])("%s (%s) is %s", (name, mime, format) => expect(formatOfFile(name, mime)).toBe(format));

  it("refuses files it can't read", () => {
    expect(formatOfFile("movie.mp4", "video/mp4")).toBeNull();
    expect(formatOfFile("archive.zip")).toBeNull();
  });
});

describe("sourceFormatOf", () => {
  it("uses the saved format, then the kind and file name", () => {
    expect(sourceFormatOf({ kind: "text", format: "xlsx" })).toBe("xlsx");
    // Sources saved before formats existed: a CSV was a text source.
    expect(sourceFormatOf({ kind: "text", fileName: "people.csv" })).toBe("csv");
    expect(sourceFormatOf({ kind: "text" })).toBe("text");
    expect(sourceFormatOf({ kind: "url" })).toBe("web");
    expect(sourceFormatOf({ kind: "youtube" })).toBe("youtube");
    expect(sourceFormatOf({ kind: "pdf" })).toBe("pdf");
  });

  it("stores Markdown and PDF as their own kinds, everything else as text", () => {
    expect(kindOfFormat("markdown")).toBe("markdown");
    expect(kindOfFormat("pdf")).toBe("pdf");
    expect(kindOfFormat("csv")).toBe("text");
  });
});
