import type { BoardElement } from "./schema";

/** Pure geometry for the board: bounds, hit tests and selection, in world units. */

export type Point = [number, number];

export interface Box {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export const centerOf = (element: Pick<BoardElement, "x" | "y" | "width" | "height">): Point => [
  element.x + element.width / 2,
  element.y + element.height / 2,
];

/** Turns a point around a centre by `angle` radians. */
export function rotate([x, y]: Point, [cx, cy]: Point, angle: number): Point {
  if (!angle) return [x, y];
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dx = x - cx;
  const dy = y - cy;
  return [cx + dx * cos - dy * sin, cy + dx * sin + dy * cos];
}

/** A world point in the element's own frame: as if the element were not turned. */
export const toLocal = (point: Point, element: BoardElement): Point =>
  rotate(point, centerOf(element), -element.angle);

/** The four corners of an element's box, turned with it. */
export function cornersOf(element: BoardElement): Point[] {
  const { x, y, width, height } = element;
  const center = centerOf(element);
  return (
    [
      [x, y],
      [x + width, y],
      [x + width, y + height],
      [x, y + height],
    ] as Point[]
  ).map((corner) => rotate(corner, center, element.angle));
}

export function boxOf(points: readonly Point[]): Box {
  const box = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const [x, y] of points) {
    box.minX = Math.min(box.minX, x);
    box.minY = Math.min(box.minY, y);
    box.maxX = Math.max(box.maxX, x);
    box.maxY = Math.max(box.maxY, y);
  }
  return box;
}

/** The upright box around an element, turned or not. */
export const boundsOf = (element: BoardElement): Box => boxOf(cornersOf(element));

/** The upright box around several elements; null when there are none. */
export function commonBounds(elements: readonly BoardElement[]): Box | null {
  if (elements.length === 0) return null;
  return boxOf(elements.flatMap(cornersOf));
}

export function distanceToSegment([px, py]: Point, [ax, ay]: Point, [bx, by]: Point): number {
  const dx = bx - ax;
  const dy = by - ay;
  const length = dx * dx + dy * dy;
  const t = length ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / length)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Distance from a point to a rounded box (negative inside), in the box's own frame. */
function roundedBoxDistance(
  [px, py]: Point,
  width: number,
  height: number,
  radius: number,
): number {
  const halfW = width / 2;
  const halfH = height / 2;
  const qx = Math.abs(px - halfW) - (halfW - radius);
  const qy = Math.abs(py - halfH) - (halfH - radius);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius;
}

/** The radius of a round rectangle's corners, as it is drawn. */
/** Excalidraw's adaptive radius: a quarter of the shorter side, at most 32. */
export const cornerRadius = (width: number, height: number) =>
  Math.min(Math.min(Math.abs(width), Math.abs(height)) * 0.25, 32);

/**
 * Whether a world point is on an element. A filled shape is hit anywhere
 * inside; an empty one only near its outline, as in Excalidraw. The
 * tolerance grows as the board is zoomed out, and with sketchiness.
 */
export function hitTest(element: BoardElement, point: Point, zoom: number): boolean {
  const tolerance = Math.max(element.strokeWidth / 2, 8 / zoom) + element.roughness * 2;
  const [lx, ly] = toLocal(point, element);
  const x = lx - element.x;
  const y = ly - element.y;
  const { width, height } = element;
  const filled = element.fill !== "none";

  switch (element.type) {
    case "rectangle": {
      const radius = element.edges === "round" ? cornerRadius(width, height) : 0;
      const distance = roundedBoxDistance([x, y], width, height, radius);
      return filled ? distance <= tolerance : Math.abs(distance) <= tolerance;
    }
    case "ellipse": {
      const a = width / 2;
      const b = height / 2;
      if (a <= 0 || b <= 0) return false;
      const dx = x - a;
      const dy = y - b;
      if (filled && (dx / a) ** 2 + (dy / b) ** 2 <= 1) return true;
      // Distance along the line from the centre: the ellipse's radius in that direction.
      const length = Math.hypot(dx, dy);
      if (length === 0) return Math.min(a, b) <= tolerance;
      const radius = 1 / Math.hypot(dx / length / a, dy / length / b);
      return Math.abs(length - radius) <= tolerance;
    }
    case "diamond": {
      const corners: Point[] = [
        [width / 2, 0],
        [width, height / 2],
        [width / 2, height],
        [0, height / 2],
      ];
      const inside =
        width > 0 &&
        height > 0 &&
        Math.abs(x - width / 2) / (width / 2) + Math.abs(y - height / 2) / (height / 2) <= 1;
      if (filled && inside) return true;
      return corners.some(
        (corner, at) => distanceToSegment([x, y], corner, corners[(at + 1) % 4]) <= tolerance,
      );
    }
    case "line":
    case "arrow":
    case "freedraw": {
      const points = element.points as readonly (readonly number[])[];
      const reach = element.type === "freedraw" ? tolerance + element.strokeWidth * 2 : tolerance;
      if (points.length === 1) return Math.hypot(x - points[0][0], y - points[0][1]) <= reach;
      for (let at = 1; at < points.length; at++) {
        if (
          distanceToSegment(
            [x, y],
            [points[at - 1][0], points[at - 1][1]],
            [points[at][0], points[at][1]],
          ) <= reach
        )
          return true;
      }
      return false;
    }
    case "text":
    case "image":
      return (
        x >= -tolerance && y >= -tolerance && x <= width + tolerance && y <= height + tolerance
      );
  }
}

/** The topmost element at a point, skipping locked ones unless asked. */
export function elementAt(
  elements: readonly BoardElement[],
  point: Point,
  zoom: number,
  { includeLocked = false }: { includeLocked?: boolean } = {},
): BoardElement | null {
  for (let at = elements.length - 1; at >= 0; at--) {
    const element = elements[at];
    if (element.locked && !includeLocked) continue;
    const box = boundsOf(element);
    const pad = 12 / zoom + element.strokeWidth;
    if (
      point[0] < box.minX - pad ||
      point[0] > box.maxX + pad ||
      point[1] < box.minY - pad ||
      point[1] > box.maxY + pad
    )
      continue;
    if (hitTest(element, point, zoom)) return element;
  }
  return null;
}

/** The elements whose whole box lies inside a marquee. */
export function insideMarquee(elements: readonly BoardElement[], marquee: Box): BoardElement[] {
  return elements.filter((element) => {
    if (element.locked) return false;
    const box = boundsOf(element);
    return (
      box.minX >= marquee.minX &&
      box.maxX <= marquee.maxX &&
      box.minY >= marquee.minY &&
      box.maxY <= marquee.maxY
    );
  });
}

/** The box of points given relative to an origin, for lines and pen strokes. */
export function pointsBox(points: readonly (readonly number[])[]): Box {
  return boxOf(points.map((point) => [point[0], point[1]] as Point));
}
