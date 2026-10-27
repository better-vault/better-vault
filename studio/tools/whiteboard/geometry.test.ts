import { describe, expect, it } from "vitest";
import { arrow, ellipse, rect } from "./fixtures";
import { boundsOf, elementAt, hitTest, insideMarquee } from "./geometry";

describe("hitTest", () => {
  it("hits an empty rectangle only near its outline, and a filled one anywhere inside", () => {
    const empty = rect("a", 0, 0, 100, 60, { edges: "sharp" });
    expect(hitTest(empty, [0, 30], 1)).toBe(true);
    expect(hitTest(empty, [50, 30], 1)).toBe(false);
    const filled = rect("b", 0, 0, 100, 60, { fill: "blue", edges: "sharp" });
    expect(hitTest(filled, [50, 30], 1)).toBe(true);
    expect(hitTest(filled, [150, 30], 1)).toBe(false);
  });

  it("follows rounded corners", () => {
    const round = rect("a", 0, 0, 100, 100, { roughness: 0 });
    // The corner point itself is outside the rounded outline.
    expect(hitTest(round, [0, 0], 1)).toBe(false);
    expect(hitTest(round, [0, 50], 1)).toBe(true);
  });

  it("works on a turned rectangle", () => {
    const turned = rect("a", 0, 0, 100, 20, {
      angle: Math.PI / 2,
      fill: "red",
      roughness: 0,
      edges: "sharp",
    });
    // Turned a quarter around its centre (50, 10): it now runs from y -40 to 60 at x 40 to 60.
    expect(hitTest(turned, [50, -30], 1)).toBe(true);
    expect(hitTest(turned, [90, 10], 1)).toBe(false);
  });

  it("hits an ellipse's outline and, when filled, its inside", () => {
    const shape = ellipse("a", 0, 0, 100, 50, { roughness: 0 });
    expect(hitTest(shape, [100, 25], 1)).toBe(true);
    expect(hitTest(shape, [50, 25], 1)).toBe(false);
    expect(hitTest({ ...shape, fill: "green" }, [50, 25], 1)).toBe(true);
  });

  it("is more forgiving on lines when zoomed out", () => {
    const line = arrow("a", 0, 0, [
      [0, 0],
      [100, 0],
    ]);
    const roughless = { ...line, roughness: 0 };
    expect(hitTest(roughless, [50, 6], 1)).toBe(true);
    expect(hitTest(roughless, [50, 20], 1)).toBe(false);
    expect(hitTest(roughless, [50, 20], 0.25)).toBe(true);
  });
});

describe("elementAt", () => {
  it("finds the topmost element, and skips locked ones", () => {
    const below = rect("below", 0, 0, 100, 100, { fill: "red" });
    const above = rect("above", 20, 20, 100, 100, { fill: "blue" });
    expect(elementAt([below, above], [50, 50], 1)?.id).toBe("above");
    expect(elementAt([below, { ...above, locked: true }], [50, 50], 1)?.id).toBe("below");
  });
});

describe("selection boxes", () => {
  it("bounds a turned element by its turned corners", () => {
    const box = boundsOf(rect("a", 0, 0, 100, 20, { angle: Math.PI / 2 }));
    expect(box.minY).toBeCloseTo(-40);
    expect(box.maxY).toBeCloseTo(60);
  });

  it("selects what lies wholly inside a marquee", () => {
    const inside = rect("in", 10, 10, 20, 20);
    const across = rect("across", 90, 10, 40, 20);
    expect(
      insideMarquee([inside, across], { minX: 0, minY: 0, maxX: 100, maxY: 100 }).map((e) => e.id),
    ).toEqual(["in"]);
  });
});
