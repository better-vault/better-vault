import { centerOf, commonBounds, rotate, type Point } from "./geometry";
import type { BoardElement } from "./schema";

/** Resizing and rotating, in world units. Pure: originals in, new elements out. */

export const handles = ["nw", "n", "ne", "e", "se", "s", "sw", "w"] as const;
export type Handle = (typeof handles)[number] | "rotate";

/** A box that may be turned: one element, or a selection (never turned). */
export interface Frame {
  x: number;
  y: number;
  width: number;
  height: number;
  angle: number;
}

/** The selection's frame: the element itself when there is one, else the box around all. */
export function frameOf(elements: readonly BoardElement[]): Frame | null {
  if (elements.length === 1) {
    const [element] = elements;
    return {
      x: element.x,
      y: element.y,
      width: element.width,
      height: element.height,
      angle: element.angle,
    };
  }
  const box = commonBounds(elements);
  return box
    ? {
        x: box.minX,
        y: box.minY,
        width: box.maxX - box.minX,
        height: box.maxY - box.minY,
        angle: 0,
      }
    : null;
}

/** Where each handle is drawn, in world units; the rotate handle sits above the top. */
export function handlePositions(frame: Frame, zoom: number): Record<Handle, Point> {
  const { x, y, width, height, angle } = frame;
  const center: Point = [x + width / 2, y + height / 2];
  const at = (px: number, py: number) => rotate([px, py], center, angle);
  return {
    nw: at(x, y),
    n: at(x + width / 2, y),
    ne: at(x + width, y),
    e: at(x + width, y + height / 2),
    se: at(x + width, y + height),
    s: at(x + width / 2, y + height),
    sw: at(x, y + height),
    w: at(x, y + height / 2),
    rotate: at(x + width / 2, y - 24 / zoom),
  };
}

/** The handle under a point, if any. Edge handles of a tiny box are left out. */
export function handleAt(frame: Frame, point: Point, zoom: number): Handle | null {
  const positions = handlePositions(frame, zoom);
  const reach = 9 / zoom;
  const small = Math.min(frame.width, frame.height) * zoom < 24;
  for (const handle of ["rotate", ...handles] as Handle[]) {
    if (small && handle.length === 1) continue;
    const [hx, hy] = positions[handle];
    if (Math.hypot(point[0] - hx, point[1] - hy) <= reach) return handle;
  }
  return null;
}

export interface ResizeOptions {
  /** Shift: keep the shape's proportions. */
  keepAspect: boolean;
  /** Alt: grow from the centre. */
  fromCenter: boolean;
}

const MIN = 1;

/** The new box edges in the frame's own (unturned) space, after dragging `handle` to `point`. */
function resizeBox(
  frame: Frame,
  handle: Exclude<Handle, "rotate">,
  point: Point,
  { keepAspect, fromCenter }: ResizeOptions,
) {
  const center: Point = [frame.x + frame.width / 2, frame.y + frame.height / 2];
  const [px, py] = rotate(point, center, -frame.angle);
  let x0 = frame.x;
  let y0 = frame.y;
  let x1 = frame.x + frame.width;
  let y1 = frame.y + frame.height;
  if (handle.includes("e")) x1 = Math.max(px, x0 + MIN);
  if (handle.includes("w")) x0 = Math.min(px, x1 - MIN);
  if (handle.includes("s")) y1 = Math.max(py, y0 + MIN);
  if (handle.includes("n")) y0 = Math.min(py, y1 - MIN);
  if (fromCenter) {
    if (handle.includes("e")) x0 = center[0] - (x1 - center[0]);
    if (handle.includes("w")) x1 = center[0] + (center[0] - x0);
    if (handle.includes("s")) y0 = center[1] - (y1 - center[1]);
    if (handle.includes("n")) y1 = center[1] + (center[1] - y0);
  }
  if (keepAspect && frame.width > 0 && frame.height > 0) {
    const sx = (x1 - x0) / frame.width;
    const sy = (y1 - y0) / frame.height;
    const corner = handle.length === 2;
    const scale = corner ? Math.max(sx, sy) : handle === "e" || handle === "w" ? sx : sy;
    const width = frame.width * scale;
    const height = frame.height * scale;
    // The fixed side stays put; the other edges follow.
    if (fromCenter) {
      x0 = center[0] - width / 2;
      x1 = center[0] + width / 2;
      y0 = center[1] - height / 2;
      y1 = center[1] + height / 2;
    } else {
      if (handle.includes("w")) x0 = x1 - width;
      else if (handle.includes("e")) x1 = x0 + width;
      else {
        x0 = center[0] - width / 2;
        x1 = center[0] + width / 2;
      }
      if (handle.includes("n")) y0 = y1 - height;
      else if (handle.includes("s")) y1 = y0 + height;
      else {
        y0 = center[1] - height / 2;
        y1 = center[1] + height / 2;
      }
    }
  }
  return { x0, y0, x1, y1, center };
}

/** Scales what is inside an element (line points, text size) with its box. */
function scaleContent(element: BoardElement, sx: number, sy: number): BoardElement {
  switch (element.type) {
    case "line":
    case "arrow":
      return {
        ...element,
        points: element.points.map(([x, y]) => [x * sx, y * sy] as [number, number]),
      };
    case "freedraw":
      return {
        ...element,
        points: element.points.map(([x, y, p]) => [x * sx, y * sy, p] as [number, number, number]),
      };
    case "text":
      return { ...element, fontSize: Math.max(4, element.fontSize * sy) };
    default:
      return element;
  }
}

/** Keeps proportions by default for pictures and text. */
const proportional = (element: BoardElement) => element.type === "image" || element.type === "text";

/**
 * Resizes one element by a handle. Its box is changed in its own frame, then
 * placed so the side or corner opposite the handle stays where it was.
 */
export function resizeElement(
  original: BoardElement,
  handle: Exclude<Handle, "rotate">,
  point: Point,
  options: ResizeOptions,
): BoardElement {
  const keepAspect = options.keepAspect || proportional(original);
  const { x0, y0, x1, y1, center } = resizeBox(original, handle, point, { ...options, keepAspect });
  const width = x1 - x0;
  const height = y1 - y0;
  const [cx, cy] = rotate([(x0 + x1) / 2, (y0 + y1) / 2], center, original.angle);
  const sx = original.width ? width / original.width : 1;
  const sy = original.height ? height / original.height : 1;
  return scaleContent(
    { ...original, x: cx - width / 2, y: cy - height / 2, width, height },
    sx,
    sy,
  );
}

/**
 * Resizes several elements by a handle of the box around them. Each keeps
 * its place in the box; turned elements, text and pictures force the same
 * scale on both axes, so nothing is skewed.
 */
export function resizeElements(
  originals: readonly BoardElement[],
  handle: Exclude<Handle, "rotate">,
  point: Point,
  options: ResizeOptions,
): BoardElement[] {
  const frame = frameOf(originals);
  if (!frame || frame.width === 0 || frame.height === 0) return [...originals];
  const keepAspect =
    options.keepAspect || originals.some((element) => element.angle !== 0 || proportional(element));
  const { x0, y0, x1, y1 } = resizeBox(frame, handle, point, { ...options, keepAspect });
  const sx = (x1 - x0) / frame.width;
  const sy = (y1 - y0) / frame.height;
  return originals.map((element) => {
    const [cx, cy] = centerOf(element);
    const ncx = x0 + (cx - frame.x) * sx;
    const ncy = y0 + (cy - frame.y) * sy;
    const width = element.width * sx;
    const height = element.height * sy;
    return scaleContent(
      { ...element, x: ncx - width / 2, y: ncy - height / 2, width, height },
      sx,
      sy,
    );
  });
}

/** Turns elements around a centre by the angle swept from `from` to `to`; Shift snaps to 15°. */
export function rotateElements(
  originals: readonly BoardElement[],
  center: Point,
  from: Point,
  to: Point,
  snap: boolean,
): BoardElement[] {
  let delta =
    Math.atan2(to[1] - center[1], to[0] - center[0]) -
    Math.atan2(from[1] - center[1], from[0] - center[0]);
  const single = originals.length === 1 ? originals[0] : null;
  if (snap) {
    const step = Math.PI / 12;
    const base = single ? single.angle : 0;
    delta = Math.round((base + delta) / step) * step - base;
  }
  return originals.map((element) => {
    const [cx, cy] = rotate(centerOf(element), center, delta);
    let angle = (element.angle + delta) % (Math.PI * 2);
    if (angle < 0) angle += Math.PI * 2;
    return { ...element, x: cx - element.width / 2, y: cy - element.height / 2, angle };
  });
}
