import { describe, expect, it } from "vitest";
import { htmlToText, stripReferenceMarkers } from "./extract";

describe("stripReferenceMarkers", () => {
  it("removes footnote markers but keeps ordinary brackets", () => {
    expect(
      stripReferenceMarkers(
        "Growth[1][2] needs risk.[citation needed] See [note b] and [a] and [need quotation to verify].",
      ),
    ).toBe("Growth needs risk. See [note b] and  and .");
    expect(stripReferenceMarkers("arrays like [x, y] stay")).toBe("arrays like [x, y] stay");
  });
});

describe("htmlToText", () => {
  it("keeps the article and drops the page furniture", () => {
    const paragraph =
      "Entrepreneurs turn ideas into ventures by testing them with customers. ".repeat(12);
    const html = `<!doctype html><html><head><title>Startups 101</title></head><body>
      <nav>Home · About · Contact</nav>
      <article><h1>Startups 101</h1><p>${paragraph}</p><p>${paragraph}</p></article>
      <footer>© Example</footer></body></html>`;
    const { title, text } = htmlToText(html, "fallback");
    expect(title).toBe("Startups 101");
    expect(text).toContain("Entrepreneurs turn ideas");
    expect(text).not.toContain("Contact");
  });

  it("falls back to the body text for short pages", () => {
    const { title, text } = htmlToText(
      "<html><head><title>T</title></head><body><p>Hi</p><script>x()</script></body></html>",
      "f",
    );
    expect(title).toBe("T");
    expect(text.trim()).toBe("Hi");
  });
});
