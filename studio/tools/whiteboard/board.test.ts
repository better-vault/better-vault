import { describe, expect, it } from "vitest";
import { boardSvg } from "./export";
import { arrow, ellipse, rect, text } from "./fixtures";
import type { ResolvedPalette } from "./palette";
import { boardData, emptyBoard } from "./schema";
import { describeShape } from "./shapes";
import { fitView, gridGap, toScreen, toWorld, zoomAt } from "./viewport";

const palette: ResolvedPalette = {
  stroke: {
    ink: "#111111",
    grey: "#777777",
    red: "#e5484d",
    green: "#30a46c",
    blue: "#3e63dd",
    amber: "#f59e0b",
    violet: "#8b5cf6",
  },
  fill: {
    ink: "#dddddd",
    grey: "#eeeeee",
    red: "#fcd3d4",
    green: "#cdeedc",
    blue: "#d3defa",
    amber: "#fde7c0",
    violet: "#e3dafd",
  },
  background: "#ffffff",
};

describe("boardData", () => {
  it("drops elements that don't read as one, and fills in defaults", () => {
    const parsed = boardData.parse({
      elements: [
        rect("a", 0, 0, 1, 1),
        { type: "rocket" },
        { ...ellipse("e", 0, 0, 1, 1), fill: "plaid" },
      ],
    });
    expect(parsed.elements.map((e) => e.id)).toEqual(["a", "e"]);
    expect(parsed.elements[1].fill).toBe("none");
    expect(parsed.background).toBe("dots");
  });

  it("only keeps raster pictures in data URLs", () => {
    const parsed = boardData.parse({
      ...emptyBoard(),
      files: {
        bad: {
          dataUrl: "data:image/svg+xml;base64,PHN2Zz4=",
          mimeType: "image/svg+xml",
          width: 1,
          height: 1,
        },
      },
    });
    expect(parsed.files).toEqual({});
  });
});

describe("describeShape", () => {
  it("draws the same shape for the same seed, and reuses it when only the place changes", () => {
    const shape = rect("r", 0, 0, 100, 60, { fill: "blue" });
    const first = describeShape(shape);
    expect(first.paths.some((path) => path.role === "stroke")).toBe(true);
    expect(first.paths.some((path) => path.role === "hachure")).toBe(true);
    expect(describeShape({ ...shape, x: 500, stroke: "red" })).toBe(first);
    expect(describeShape({ ...shape, width: 120 })).not.toBe(first);
  });

  it("adds arrowheads", () => {
    const description = describeShape(
      arrow("a", 0, 0, [
        [0, 0],
        [100, 0],
      ]),
    );
    expect(description.paths.length).toBeGreaterThan(1);
  });
});

describe("boardSvg", () => {
  it("writes plain colours and escapes text", () => {
    const { svg, width } = boardSvg(
      {
        ...emptyBoard(),
        elements: [rect("r", 0, 0, 100, 50, { stroke: "red" }), text("t", 0, 80, "a < b & c")],
      },
      palette,
    );
    expect(svg).toContain("#e5484d");
    expect(svg).toContain("a &lt; b &amp; c");
    expect(svg).not.toContain("var(");
    expect(width).toBeGreaterThan(100);
  });
});

describe("viewport", () => {
  it("converts between screen and world, and zooms around a point", () => {
    const view = { x: 100, y: 50, zoom: 2 };
    expect(toWorld(toScreen([10, 20], view), view)).toEqual([10, 20]);
    const zoomed = zoomAt(view, 2, [300, 250]);
    expect(toWorld([300, 250], zoomed)).toEqual(toWorld([300, 250], view));
  });

  it("fits content and keeps grid marks apart", () => {
    const view = fitView({ minX: 0, minY: 0, maxX: 1000, maxY: 500 }, 600, 400, 50);
    expect(view.zoom).toBeCloseTo(0.5);
    expect(gridGap(1)).toBe(20);
    expect(gridGap(0.2)).toBe(80);
  });
});
