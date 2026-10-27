import { getStroke } from "perfect-freehand";
import rough from "roughjs";
import { cornerRadius, type Point } from "./geometry";
import type { Arrowhead, BoardElement, LinearElement } from "./schema";

/**
 * What an element looks like, as paths in its own frame (0, 0 at its box's
 * corner). The board and the SVG export draw the same description; colours
 * are applied by whoever draws it.
 */
export interface ShapePath {
  d: string;
  /** "stroke": the outline colour; "fill": a solid fill; "hachure": fill lines in the fill colour; "ink": filled with the outline colour (pen strokes, arrowheads). */
  role: "stroke" | "fill" | "hachure" | "ink";
  /** A thinner line for hachure fills. */
  width?: number;
}

export interface ShapeDescription {
  paths: ShapePath[];
  /** For dashed and dotted outlines. */
  dash?: string;
}

const generator = rough.generator();
// Placeholders rough draws with, swapped for real colours when drawing.
const STROKE = "S";
const FILL = "F";

function roughOptions(element: BoardElement) {
  const dashed = element.strokeStyle !== "solid";
  return {
    seed: element.seed,
    roughness: [0, 1, 2.2][element.roughness] ?? 1,
    bowing: element.roughness === 0 ? 0 : 1,
    strokeWidth: element.strokeWidth,
    stroke: STROKE,
    fill: element.fill === "none" ? undefined : FILL,
    fillStyle:
      element.fillStyle === "cross-hatch"
        ? "cross-hatch"
        : element.fillStyle === "solid"
          ? "solid"
          : "hachure",
    fillWeight: element.strokeWidth / 2,
    hachureGap: element.strokeWidth * 4,
    // Dashes and clean lines look best drawn once.
    disableMultiStroke: dashed || element.roughness === 0,
    preserveVertices: element.roughness === 0,
  };
}

function toPaths(drawable: ReturnType<typeof generator.path>): ShapePath[] {
  return generator.toPaths(drawable).map((path): ShapePath => {
    if (path.fill === FILL && (!path.stroke || path.stroke === "none"))
      return { role: "fill", d: path.d };
    if (path.stroke === FILL) return { role: "hachure", d: path.d, width: path.strokeWidth };
    return { role: "stroke", d: path.d };
  });
}

function roundedRect(width: number, height: number): string {
  const r = cornerRadius(width, height);
  return `M ${r} 0 L ${width - r} 0 Q ${width} 0 ${width} ${r} L ${width} ${height - r} Q ${width} ${height} ${width - r} ${height} L ${r} ${height} Q 0 ${height} 0 ${height - r} L 0 ${r} Q 0 0 ${r} 0 Z`;
}

function roundedDiamond(width: number, height: number): string {
  const top: Point = [width / 2, 0];
  const right: Point = [width, height / 2];
  const bottom: Point = [width / 2, height];
  const left: Point = [0, height / 2];
  const corners = [top, right, bottom, left];
  const cut = 0.12;
  const toward = (from: Point, to: Point, share: number): Point => [
    from[0] + (to[0] - from[0]) * share,
    from[1] + (to[1] - from[1]) * share,
  ];
  const parts: string[] = [];
  corners.forEach((corner, at) => {
    const previous = corners[(at + 3) % 4];
    const next = corners[(at + 1) % 4];
    const a = toward(corner, previous, cut);
    const b = toward(corner, next, cut);
    parts.push(
      `${at === 0 ? "M" : "L"} ${a[0]} ${a[1]} Q ${corner[0]} ${corner[1]} ${b[0]} ${b[1]}`,
    );
  });
  return `${parts.join(" ")} Z`;
}

/** The arrowhead at the end of a segment that runs from `from` to `tip`. */
function arrowhead(
  kind: Arrowhead,
  from: Point,
  tip: Point,
  strokeWidth: number,
  segmentLength: number,
): ShapePath[] {
  const angle = Math.atan2(tip[1] - from[1], tip[0] - from[0]);
  const size = Math.min(Math.max(12, strokeWidth * 6), segmentLength * 0.4);
  const at = (length: number, turn: number): Point => [
    tip[0] - length * Math.cos(angle + turn),
    tip[1] - length * Math.sin(angle + turn),
  ];
  switch (kind) {
    case "arrow": {
      const left = at(size, Math.PI / 7);
      const right = at(size, -Math.PI / 7);
      return [
        {
          role: "stroke",
          d: `M ${left[0]} ${left[1]} L ${tip[0]} ${tip[1]} L ${right[0]} ${right[1]}`,
        },
      ];
    }
    case "triangle": {
      const left = at(size, Math.PI / 7);
      const right = at(size, -Math.PI / 7);
      return [
        {
          role: "ink",
          d: `M ${tip[0]} ${tip[1]} L ${left[0]} ${left[1]} L ${right[0]} ${right[1]} Z`,
        },
      ];
    }
    case "bar": {
      const half = size / 2;
      const a: Point = [tip[0] + half * Math.sin(angle), tip[1] - half * Math.cos(angle)];
      const b: Point = [tip[0] - half * Math.sin(angle), tip[1] + half * Math.cos(angle)];
      return [{ role: "stroke", d: `M ${a[0]} ${a[1]} L ${b[0]} ${b[1]}` }];
    }
    case "dot": {
      const r = Math.max(3, strokeWidth * 1.6);
      return [
        {
          role: "ink",
          d: `M ${tip[0] - r} ${tip[1]} a ${r} ${r} 0 1 0 ${2 * r} 0 a ${r} ${r} 0 1 0 ${-2 * r} 0`,
        },
      ];
    }
  }
}

function linear(element: LinearElement): ShapePath[] {
  const points = element.points as Point[];
  const options = { ...roughOptions(element), fill: undefined };
  const body =
    element.edges === "round" && points.length > 2
      ? generator.curve(points, options)
      : generator.linearPath(points, options);
  const out = toPaths(body);
  const last = points.length - 1;
  const length = (a: Point, b: Point) => Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (element.end && last > 0)
    out.push(
      ...arrowhead(
        element.end,
        points[last - 1],
        points[last],
        element.strokeWidth,
        length(points[last - 1], points[last]),
      ),
    );
  if (element.start && last > 0)
    out.push(
      ...arrowhead(
        element.start,
        points[1],
        points[0],
        element.strokeWidth,
        length(points[0], points[1]),
      ),
    );
  return out;
}

/** A pen stroke's outline as a smooth closed path. */
function freehand(element: Extract<BoardElement, { type: "freedraw" }>): ShapePath[] {
  const outline = getStroke(element.points, {
    size: element.strokeWidth * 4.25,
    thinning: 0.6,
    smoothing: 0.5,
    streamline: 0.5,
    simulatePressure: element.simulatePressure,
    last: true,
  });
  if (outline.length < 2) return [];
  const d = outline.reduce(
    (acc, [x0, y0], at, all) => {
      const [x1, y1] = all[(at + 1) % all.length];
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
      return acc;
    },
    ["M", outline[0][0], outline[0][1], "Q"] as (string | number)[],
  );
  return [
    {
      role: "ink",
      d: `${d.map((value) => (typeof value === "number" ? Math.round(value * 100) / 100 : value)).join(" ")} Z`,
    },
  ];
}

function build(element: BoardElement): ShapeDescription {
  const dash =
    element.strokeStyle === "dashed"
      ? `${element.strokeWidth * 4} ${element.strokeWidth * 3 + 4}`
      : element.strokeStyle === "dotted"
        ? `${element.strokeWidth * 0.5} ${element.strokeWidth * 2.5 + 3}`
        : undefined;
  const { width, height } = element;
  switch (element.type) {
    case "rectangle":
      return {
        dash,
        paths: toPaths(
          element.edges === "round"
            ? generator.path(roundedRect(width, height), roughOptions(element))
            : generator.rectangle(0, 0, width, height, roughOptions(element)),
        ),
      };
    case "diamond": {
      const points: Point[] = [
        [width / 2, 0],
        [width, height / 2],
        [width / 2, height],
        [0, height / 2],
      ];
      return {
        dash,
        paths: toPaths(
          element.edges === "round"
            ? generator.path(roundedDiamond(width, height), roughOptions(element))
            : generator.polygon(points, roughOptions(element)),
        ),
      };
    }
    case "ellipse":
      return {
        dash,
        paths: toPaths(
          generator.ellipse(width / 2, height / 2, width, height, roughOptions(element)),
        ),
      };
    case "line":
    case "arrow":
      return { dash, paths: linear(element) };
    case "freedraw":
      return { paths: freehand(element) };
    case "text":
    case "image":
      return { paths: [] };
  }
}

/** What changes an element's paths; its place, colours and opacity don't. */
function shapeKey(element: BoardElement): string {
  const points = "points" in element ? JSON.stringify(element.points) : "";
  const ends =
    element.type === "line" || element.type === "arrow" ? `${element.start}|${element.end}` : "";
  return [
    element.type,
    element.width,
    element.height,
    element.seed,
    element.roughness,
    element.strokeWidth,
    element.strokeStyle,
    element.fill === "none" ? "none" : "fill",
    element.fillStyle,
    element.edges,
    ends,
    points,
  ].join("|");
}

const cache = new Map<string, { key: string; description: ShapeDescription }>();

/** An element's paths, built once and reused while its shape stays the same. */
export function describeShape(element: BoardElement): ShapeDescription {
  const key = shapeKey(element);
  const cached = cache.get(element.id);
  if (cached && cached.key === key) return cached.description;
  const description = build(element);
  cache.set(element.id, { key, description });
  if (cache.size > 4000) cache.delete(cache.keys().next().value!);
  return description;
}
