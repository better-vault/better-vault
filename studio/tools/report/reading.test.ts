import { describe, expect, it } from "vitest";
import { activeHeading, readingProgress, scrollToShow } from "./reading";

describe("activeHeading", () => {
  const tops = [100, 600, 1200];

  it("is none before the first heading", () => {
    expect(activeHeading(tops, 40, false)).toBe(-1);
  });

  it("is the last heading the line has passed", () => {
    expect(activeHeading(tops, 100, false)).toBe(0);
    expect(activeHeading(tops, 900, false)).toBe(1);
    expect(activeHeading(tops, 5000, false)).toBe(2);
  });

  it("is the last heading at the end of the document", () => {
    expect(activeHeading(tops, 700, true)).toBe(2);
  });

  it("handles no headings", () => {
    expect(activeHeading([], 0, true)).toBe(-1);
  });
});

describe("readingProgress", () => {
  it("goes from 0 to 1 over the scroll range", () => {
    expect(readingProgress(0, 2000, 500)).toBe(0);
    expect(readingProgress(750, 2000, 500)).toBe(0.5);
    expect(readingProgress(1600, 2000, 500)).toBe(1);
  });

  it("is complete when nothing scrolls", () => {
    expect(readingProgress(0, 400, 500)).toBe(1);
  });
});

describe("scrollToShow", () => {
  it("leaves a visible row alone", () => {
    expect(scrollToShow(120, 30, 100, 300)).toBe(100);
  });

  it("scrolls up to a row above, and down to a row below", () => {
    expect(scrollToShow(40, 30, 100, 300)).toBe(28);
    expect(scrollToShow(500, 30, 100, 300)).toBe(242);
  });
});
