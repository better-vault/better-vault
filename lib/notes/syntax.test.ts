import { describe, expect, it } from "vitest";
import {
  analyse,
  blockOf,
  extractHeadings,
  extractLinks,
  extractTags,
  parseLinkInner,
  readFrontmatter,
  renameLinks,
  sectionOf,
} from "./syntax";

describe("notes syntax", () => {
  it("reads every kind of wikilink", () => {
    expect(parseLinkInner("Note")).toEqual({ kind: "note", target: "Note", embed: false });
    expect(parseLinkInner("Note|shown")).toMatchObject({ target: "Note", alias: "shown" });
    expect(parseLinkInner("Note#Part two")).toMatchObject({ target: "Note", heading: "Part two" });
    expect(parseLinkInner("Note#^abc123")).toMatchObject({ target: "Note", block: "abc123" });
    expect(parseLinkInner("nb: Biology")).toMatchObject({ kind: "notebook", target: "Biology" });
    expect(parseLinkInner("src:Paper.pdf|the paper")).toMatchObject({
      kind: "source",
      target: "Paper.pdf",
      alias: "the paper",
    });
    expect(parseLinkInner("Work/Plan")).toMatchObject({ target: "Work/Plan" });
    expect(parseLinkInner("#Heading here")).toMatchObject({ target: "", heading: "Heading here" });
  });

  it("finds links and embeds outside code and comments", () => {
    const text = [
      "See [[A]] and ![[B#Intro]].",
      "`[[not inline]]`",
      "```",
      "[[not fenced]]",
      "```",
      "%% [[not a comment]] %%",
      "Last [[C|c]]",
    ].join("\n");
    expect(extractLinks(text).map((link) => [link.target, link.embed])).toEqual([
      ["A", false],
      ["B", true],
      ["C", false],
    ]);
  });

  it("collects tags from the body and the frontmatter", () => {
    const text =
      "---\ntags: [project, Draft]\naliases:\n  - Plan B\n---\n# Title\nA #idea and #area/work, not #123 or a#b.";
    expect(extractTags(text)).toEqual(["area/work", "Draft", "idea", "project"]);
    expect(analyse(text).aliases).toEqual(["Plan B"]);
    expect(readFrontmatter(text).content.startsWith("# Title")).toBe(true);
  });

  it("does not take headings for tags", () => {
    expect(extractTags("# Heading\n## Another\ntext #real")).toEqual(["real"]);
    expect(extractHeadings("# One\ntext\n## Two ##").map((h) => [h.level, h.text])).toEqual([
      [1, "One"],
      [2, "Two"],
    ]);
  });

  it("rewrites links to a renamed note, keeping headings and shown text", () => {
    const text = "[[Old]] [[old#Part|see]] ![[Vault/Old]] [[Older]] `[[Old]]`";
    expect(renameLinks(text, "Old", "New")).toBe(
      "[[New]] [[New#Part|see]] ![[Vault/New]] [[Older]] `[[Old]]`",
    );
    expect(renameLinks("nothing here", "Old", "New")).toBe("nothing here");
  });

  it("finds a heading's section and a block", () => {
    const text = "# A\none\n## B\ntwo\n# C\nthree ^x1";
    expect(sectionOf(text, "B")).toBe("## B\ntwo");
    expect(sectionOf(text, "A")).toBe("# A\none\n## B\ntwo");
    expect(blockOf(text, "x1")).toBe("three");
  });
});
