import type { Box, Point } from "./geometry";
import type { BoardView } from "./schema";

/** The board's camera: screen = world × zoom + offset, the same shape as a Panel Canvas viewport. */

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 30;
const clampZoom = (zoom: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));

export const toWorld = ([sx, sy]: Point, view: BoardView): Point => [
  (sx - view.x) / view.zoom,
  (sy - view.y) / view.zoom,
];
export const toScreen = ([wx, wy]: Point, view: BoardView): Point => [
  wx * view.zoom + view.x,
  wy * view.zoom + view.y,
];

/** Zooms around a screen point, so what is under it stays put. */
export function zoomAt(view: BoardView, factor: number, [sx, sy]: Point): BoardView {
  const zoom = clampZoom(view.zoom * factor);
  const ratio = zoom / view.zoom;
  return { zoom, x: sx - (sx - view.x) * ratio, y: sy - (sy - view.y) * ratio };
}

/** A view that shows a box in a screen of this size, with a margin, at most 100 %. */
export function fitView(
  box: Box | null,
  width: number,
  height: number,
  margin = 64,
  maxZoom = 1,
): BoardView {
  if (!box || width <= 0 || height <= 0) return { x: width / 2, y: height / 2, zoom: 1 };
  const boxWidth = Math.max(box.maxX - box.minX, 1);
  const boxHeight = Math.max(box.maxY - box.minY, 1);
  const zoom = clampZoom(
    Math.min((width - 2 * margin) / boxWidth, (height - 2 * margin) / boxHeight, maxZoom),
  );
  return {
    zoom,
    x: width / 2 - ((box.minX + box.maxX) / 2) * zoom,
    y: height / 2 - ((box.minY + box.maxY) / 2) * zoom,
  };
}

/** The grid spacing in world units, doubled as the board zooms out so marks stay at least 10 px apart. */
export function gridGap(zoom: number, base = 20): number {
  let gap = base;
  while (gap * zoom < 10) gap *= 2;
  return gap;
}
