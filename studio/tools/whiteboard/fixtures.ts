import type { BoardElement, ElementOf } from "./schema";

/** Test helpers: elements with defaults. */
const base = {
  angle: 0,
  stroke: "ink" as const,
  fill: "none" as const,
  fillStyle: "hachure" as const,
  strokeWidth: 2,
  strokeStyle: "solid" as const,
  roughness: 1,
  edges: "round" as const,
  opacity: 100,
  seed: 7,
  groupIds: [] as string[],
  locked: false,
};

export const rect = (
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  extra: Partial<ElementOf<"rectangle">> = {},
): ElementOf<"rectangle"> => ({
  type: "rectangle",
  id,
  x,
  y,
  width,
  height,
  ...base,
  ...extra,
});

export const ellipse = (
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  extra: Partial<ElementOf<"ellipse">> = {},
): ElementOf<"ellipse"> => ({
  type: "ellipse",
  id,
  x,
  y,
  width,
  height,
  ...base,
  ...extra,
});

export const arrow = (
  id: string,
  x: number,
  y: number,
  points: [number, number][],
): ElementOf<"arrow"> => ({
  type: "arrow",
  id,
  x,
  y,
  width: Math.max(...points.map((p) => p[0])),
  height: Math.max(...points.map((p) => p[1])),
  points,
  start: null,
  end: "arrow",
  ...base,
});

export const text = (id: string, x: number, y: number, value: string): ElementOf<"text"> => ({
  type: "text",
  id,
  x,
  y,
  width: 100,
  height: 25,
  text: value,
  font: "hand",
  fontSize: 20,
  align: "start",
  ...base,
});

export type { BoardElement };
