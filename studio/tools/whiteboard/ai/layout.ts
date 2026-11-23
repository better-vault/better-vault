import { isRightToLeft } from "@/lib/text/direction";
import type { Point } from "../geometry";
import { newId, newSeed } from "../scene";
import type { BoardColor, ElementOf } from "../schema";
import { LINE_HEIGHT, measureText } from "../text";
import type { BoardItem, IconShape } from "./schema";

/**
 * Lays a board's items out as things a hand writes and draws: text in the
 * hand font and pen strokes, top to bottom in one column. Each item becomes a
 * few strokes, in the order a teacher would make them; the animator writes
 * them one by one.
 */

export type DrawOp =
  { kind: "text"; element: ElementOf<"text"> } | { kind: "stroke"; element: ElementOf<"freedraw"> };

const COLUMN = 720;
const GAP = 22;

const base = (color: BoardColor) => ({
  id: newId(),
  angle: 0,
  stroke: color,
  fill: "none" as const,
  fillStyle: "hachure" as const,
  strokeWidth: 2,
  strokeStyle: "solid" as const,
  roughness: 1,
  edges: "round" as const,
  opacity: 100,
  seed: newSeed(),
  groupIds: [] as string[],
  locked: false,
});

/** A little wobble, so lines look drawn by hand; the same for the same seed. */
function wobble(seed: number) {
  let state = seed % 2147483647 || 1;
  return (amount: number) => {
    state = (state * 16807) % 2147483647;
    return ((state / 2147483647) * 2 - 1) * amount;
  };
}

/** A pen stroke through world points, sampled finely so it can be drawn bit by bit. */
export function stroke(points: Point[], color: BoardColor, width = 0.9, jitter = 0.8): DrawOp {
  const noise = wobble(Math.floor(Math.random() * 1e9));
  const fine: Point[] = [];
  for (let at = 0; at < points.length - 1; at++) {
    const [ax, ay] = points[at];
    const [bx, by] = points[at + 1];
    const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 6));
    for (let step = 0; step < steps; step++) {
      const t = step / steps;
      fine.push([ax + (bx - ax) * t + noise(jitter), ay + (by - ay) * t + noise(jitter)]);
    }
  }
  fine.push(points[points.length - 1]);
  const minX = Math.min(...fine.map(([x]) => x));
  const minY = Math.min(...fine.map(([, y]) => y));
  const maxX = Math.max(...fine.map(([x]) => x));
  const maxY = Math.max(...fine.map(([, y]) => y));
  return {
    kind: "stroke",
    element: {
      ...base(color),
      type: "freedraw",
      strokeWidth: width,
      x: minX,
      y: minY,
      width: Math.max(1, maxX - minX),
      height: Math.max(1, maxY - minY),
      points: fine.map(([x, y]) => [x - minX, y - minY, 0.5] as [number, number, number]),
      simulatePressure: true,
    },
  };
}

function text(
  value: string,
  [x, y]: Point,
  fontSize: number,
  color: BoardColor,
  align?: "start" | "center" | "end",
): DrawOp {
  const size = measureText(value, "hand", fontSize);
  // Right-to-left text is anchored at its right edge, so it is written from the right.
  align ??= isRightToLeft(value) ? "end" : "start";
  return {
    kind: "text",
    element: {
      ...base(color),
      type: "text",
      x,
      y,
      width: size.width,
      height: size.height,
      text: value,
      font: "hand",
      fontSize,
      align,
    },
  };
}

/** Breaks text into lines no wider than `width`. */
export function wrap(value: string, width: number, fontSize: number): string[] {
  const lines: string[] = [];
  for (const paragraph of value.split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (line && measureText(next, "hand", fontSize).width > width) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    lines.push(line);
  }
  return lines;
}

const rectPath = (x: number, y: number, w: number, h: number): Point[] => [
  [x + 6, y],
  [x + w - 6, y],
  [x + w, y + 6],
  [x + w, y + h - 6],
  [x + w - 6, y + h],
  [x + 6, y + h],
  [x, y + h - 6],
  [x, y + 6],
  [x + 7, y - 1],
];

const circlePath = (cx: number, cy: number, r: number): Point[] =>
  Array.from({ length: 29 }, (_, at) => {
    const angle = (at / 28) * Math.PI * 2 - Math.PI / 2;
    return [cx + Math.cos(angle) * r, cy + Math.sin(angle) * r] as Point;
  });

/** A short arrow from `from` to `to`, as two strokes: the shaft and the head. */
function arrow(from: Point, to: Point, color: BoardColor): DrawOp[] {
  const angle = Math.atan2(to[1] - from[1], to[0] - from[0]);
  const head = (turn: number): Point => [
    to[0] - Math.cos(angle + turn) * 12,
    to[1] - Math.sin(angle + turn) * 12,
  ];
  return [stroke([from, to], color), stroke([head(0.5), to, head(-0.5)], color)];
}

export class BoardLayout {
  private y: number;

  constructor(
    private readonly x: number,
    top: number,
  ) {
    this.y = top;
  }

  /** The strokes for one item, placed below the ones before it. */
  place(item: BoardItem): DrawOp[] {
    const color = item.color ?? "ink";
    const ops: DrawOp[] = [];
    const words = [item.text, ...(item.items ?? []), ...(item.columns ?? [])].join(" ");
    const rtl = isRightToLeft(words);
    // Right-to-left writing starts at the column's right edge.
    const start = (width: number) => (rtl ? this.x + COLUMN - width : this.x);

    switch (item.kind) {
      case "heading": {
        const value = item.text ?? "";
        const size = 40;
        const width = measureText(value, "hand", size).width;
        ops.push(text(value, [rtl ? this.x + COLUMN - width : this.x, this.y], size, color));
        const underY = this.y + size * LINE_HEIGHT + 4;
        const left = start(width);
        const wave: Point[] = Array.from({ length: 9 }, (_, at) => [
          left + (width * at) / 8,
          underY + (at % 2 ? 3 : -1),
        ]);
        ops.push(stroke(wave, item.color && item.color !== "ink" ? item.color : "violet", 1.5));
        this.y = underY + GAP + 8;
        break;
      }
      case "text":
      case "formula": {
        const size = item.kind === "formula" ? 28 : 22;
        const tint = item.kind === "formula" && !item.color ? "blue" : color;
        for (const line of wrap(item.text ?? "", COLUMN, size)) {
          const width = measureText(line, "hand", size).width;
          ops.push(text(line, [start(width), this.y], size, tint));
          this.y += size * LINE_HEIGHT;
        }
        this.y += GAP;
        break;
      }
      case "list":
      case "steps": {
        const size = 22;
        const indent = 30;
        (item.items ?? []).forEach((entry, at) => {
          const mark = item.kind === "steps" ? `${at + 1}.` : "•";
          const markColor = item.color && item.color !== "ink" ? item.color : "blue";
          const markWidth = measureText(mark, "hand", size).width;
          ops.push(
            text(mark, [rtl ? this.x + COLUMN - markWidth : this.x, this.y], size, markColor),
          );
          for (const line of wrap(entry, COLUMN - indent, size)) {
            const width = measureText(line, "hand", size).width;
            ops.push(
              text(
                line,
                [rtl ? this.x + COLUMN - indent - width : this.x + indent, this.y],
                size,
                "ink",
              ),
            );
            this.y += size * LINE_HEIGHT;
          }
          this.y += 4;
        });
        this.y += GAP;
        break;
      }
      case "note": {
        const size = 22;
        const lines = wrap(item.text ?? "", COLUMN - 48, size);
        const height = lines.length * size * LINE_HEIGHT + 28;
        const boxColor = item.color && item.color !== "ink" ? item.color : "amber";
        ops.push(stroke(rectPath(this.x, this.y, COLUMN, height), boxColor, 1.1));
        let lineY = this.y + 14;
        for (const line of lines) {
          const width = measureText(line, "hand", size).width;
          ops.push(
            text(line, [rtl ? this.x + COLUMN - 24 - width : this.x + 24, lineY], size, "ink"),
          );
          lineY += size * LINE_HEIGHT;
        }
        this.y += height + GAP;
        break;
      }
      case "table": {
        const columns = item.columns ?? [];
        const rows = item.rows ?? [];
        const count = Math.max(columns.length, ...rows.map((row) => row.length), 1);
        const cellWidth = COLUMN / count;
        const size = 19;
        const pad = 10;
        const header = columns.map((cell) => wrap(cell, cellWidth - pad * 2, size));
        const body = rows.map((row) =>
          Array.from({ length: count }, (_, at) => wrap(row[at] ?? "", cellWidth - pad * 2, size)),
        );
        const heightOf = (cells: string[][]) =>
          Math.max(1, ...cells.map((cell) => cell.length)) * size * LINE_HEIGHT + pad * 2;
        const rowHeights = [...(columns.length ? [heightOf(header)] : []), ...body.map(heightOf)];
        const total = rowHeights.reduce((sum, height) => sum + height, 0);
        const lineColor = item.color && item.color !== "ink" ? item.color : "grey";
        // The grid first, then the words, row by row.
        ops.push(stroke(rectPath(this.x, this.y, COLUMN, total), lineColor));
        let lineY = this.y;
        for (const height of rowHeights.slice(0, -1)) {
          lineY += height;
          ops.push(
            stroke(
              [
                [this.x, lineY],
                [this.x + COLUMN, lineY],
              ],
              lineColor,
            ),
          );
        }
        for (let at = 1; at < count; at++) {
          const lineX = rtl ? this.x + COLUMN - cellWidth * at : this.x + cellWidth * at;
          ops.push(
            stroke(
              [
                [lineX, this.y],
                [lineX, this.y + total],
              ],
              lineColor,
            ),
          );
        }
        const allRows = [...(columns.length ? [header] : []), ...body];
        let rowY = this.y;
        allRows.forEach((cells, rowAt) => {
          cells.forEach((lines, at) => {
            const cellX = rtl ? this.x + COLUMN - cellWidth * (at + 1) : this.x + cellWidth * at;
            lines.forEach((line, lineAt) => {
              const width = measureText(line, "hand", size).width;
              ops.push(
                text(
                  line,
                  [
                    rtl ? cellX + cellWidth - pad - width : cellX + pad,
                    rowY + pad + lineAt * size * LINE_HEIGHT,
                  ],
                  size,
                  rowAt === 0 && columns.length ? (item.color ?? "blue") : "ink",
                ),
              );
            });
          });
          rowY += rowHeights[rowAt];
        });
        this.y += total + GAP;
        break;
      }
      case "flow": {
        const steps = item.items ?? [];
        const size = 19;
        const perRow = Math.min(4, Math.max(1, steps.length));
        const gap = 46;
        const boxWidth = (COLUMN - gap * (perRow - 1)) / perRow;
        const boxColor = item.color && item.color !== "ink" ? item.color : "green";
        for (let first = 0; first < steps.length; first += perRow) {
          const row = steps.slice(first, first + perRow);
          const wrapped = row.map((step) => wrap(step, boxWidth - 20, size));
          const height =
            Math.max(...wrapped.map((lines) => lines.length)) * size * LINE_HEIGHT + 24;
          row.forEach((_, at) => {
            const order = rtl ? perRow - 1 - at : at;
            const boxX = this.x + order * (boxWidth + gap);
            ops.push(stroke(rectPath(boxX, this.y, boxWidth, height), boxColor));
            wrapped[at].forEach((line, lineAt) => {
              const width = measureText(line, "hand", size).width;
              ops.push(
                text(
                  line,
                  [boxX + (boxWidth - width) / 2, this.y + 12 + lineAt * size * LINE_HEIGHT],
                  size,
                  "ink",
                ),
              );
            });
            if (at < row.length - 1) {
              const midY = this.y + height / 2;
              const from: Point = rtl ? [boxX - 6, midY] : [boxX + boxWidth + 6, midY];
              const to: Point = rtl ? [boxX - gap + 6, midY] : [boxX + boxWidth + gap - 6, midY];
              ops.push(...arrow(from, to, "ink"));
            }
          });
          this.y += height + 24;
        }
        this.y += GAP - 10;
        break;
      }
      case "icons": {
        const icons = item.icons ?? [];
        const cell = Math.min(170, COLUMN / Math.max(icons.length, 1));
        const scale = 0.9;
        icons.forEach((icon, at) => {
          const order = rtl ? icons.length - 1 - at : at;
          const left = this.x + order * cell + (cell - 100 * scale) / 2;
          const top = this.y;
          for (const shape of icon.shapes) ops.push(...iconShape(shape, left, top, scale));
          const width = measureText(icon.label, "hand", 18).width;
          ops.push(
            text(
              icon.label,
              [this.x + order * cell + (cell - width) / 2, top + 100 * scale + 6],
              18,
              "ink",
            ),
          );
        });
        this.y += 100 * scale + 18 * LINE_HEIGHT + 6 + GAP;
        break;
      }
    }
    return ops;
  }
}

function iconShape(shape: IconShape, left: number, top: number, scale: number): DrawOp[] {
  const color = shape.color ?? "ink";
  const at = (x: number, y: number): Point => [
    left + Math.min(100, Math.max(0, x)) * scale,
    top + Math.min(100, Math.max(0, y)) * scale,
  ];
  const p = shape.points;
  switch (shape.type) {
    case "circle": {
      const [cx, cy] = at(p[0] ?? 50, p[1] ?? 50);
      return [stroke(circlePath(cx, cy, Math.max(3, (shape.r ?? 20) * scale)), color, 1.1)];
    }
    case "dot": {
      const [cx, cy] = at(p[0] ?? 50, p[1] ?? 50);
      return [stroke(circlePath(cx, cy, 2.5), color, 2, 0.2)];
    }
    case "rect": {
      const [x, y] = at(p[0] ?? 20, p[1] ?? 20);
      return [stroke(rectPath(x, y, (p[2] ?? 60) * scale, (p[3] ?? 60) * scale), color, 1.1)];
    }
    case "line": {
      const points: Point[] = [];
      for (let index = 0; index + 1 < p.length; index += 2) points.push(at(p[index], p[index + 1]));
      return points.length >= 2 ? [stroke(points, color, 1.1)] : [];
    }
  }
}

/** Where the answer goes: right of what is on the board, level with its top, or at the view's corner. */
export function answerOrigin(
  elements: readonly { x: number; y: number; width: number; height: number }[],
  viewCorner: Point,
): Point {
  if (elements.length === 0) return viewCorner;
  const right = Math.max(...elements.map((element) => element.x + element.width));
  const top = Math.min(...elements.map((element) => element.y));
  return [right + 160, top];
}

export const ANSWER_WIDTH = COLUMN;
