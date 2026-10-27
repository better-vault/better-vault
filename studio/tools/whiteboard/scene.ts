import { pointsBox, type Point } from "./geometry";
import type { BoardElement } from "./schema";

/** Pure operations on a board's elements. Elements are never changed in place. */

export const newId = () =>
  Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
export const newSeed = () => Math.floor(Math.random() * 2 ** 31);

/**
 * Lines and pen strokes keep their points relative to (x, y), with the
 * smallest point at 0, 0 and the box as large as the points: the box then
 * matches what is drawn, and turns around the right centre.
 */
export function fitPoints<T extends BoardElement>(element: T): T {
  if (element.type !== "line" && element.type !== "arrow" && element.type !== "freedraw")
    return element;
  const points = element.points as readonly (readonly number[])[];
  const box = pointsBox(points);
  if (box.minX === 0 && box.minY === 0 && element.width === box.maxX && element.height === box.maxY)
    return element;
  return {
    ...element,
    x: element.x + box.minX,
    y: element.y + box.minY,
    width: box.maxX - box.minX,
    height: box.maxY - box.minY,
    points: points.map(([x, y, ...rest]) => [x - box.minX, y - box.minY, ...rest]),
  } as T;
}

export function updateElements(
  elements: readonly BoardElement[],
  ids: ReadonlySet<string>,
  change: (element: BoardElement) => BoardElement,
): BoardElement[] {
  return elements.map((element) => (ids.has(element.id) ? change(element) : element));
}

export const removeElements = (elements: readonly BoardElement[], ids: ReadonlySet<string>) =>
  elements.filter((element) => !ids.has(element.id));

/**
 * The ids to select when these are chosen: grouped elements bring their whole
 * outermost group, as in Excalidraw.
 */
export function withGroups(elements: readonly BoardElement[], ids: Iterable<string>): Set<string> {
  const chosen = new Set(ids);
  const groups = new Set(
    elements
      .filter((element) => chosen.has(element.id) && element.groupIds.length > 0)
      .map((element) => element.groupIds.at(-1)!),
  );
  for (const element of elements)
    if (element.groupIds.some((group) => groups.has(group))) chosen.add(element.id);
  return chosen;
}

/** Copies of these elements, moved by `offset`, with new ids and groups; they go on top. */
export function duplicate(
  elements: readonly BoardElement[],
  ids: ReadonlySet<string>,
  offset: Point = [12, 12],
): { elements: BoardElement[]; ids: Set<string> } {
  const groupMap = new Map<string, string>();
  const copies = elements
    .filter((element) => ids.has(element.id))
    .map((element) => ({
      ...element,
      id: newId(),
      seed: newSeed(),
      x: element.x + offset[0],
      y: element.y + offset[1],
      groupIds: element.groupIds.map((group) => {
        if (!groupMap.has(group)) groupMap.set(group, newId());
        return groupMap.get(group)!;
      }),
    })) as BoardElement[];
  return { elements: [...elements, ...copies], ids: new Set(copies.map((copy) => copy.id)) };
}

export type LayerMove = "front" | "back" | "forward" | "backward";

/** Moves elements up or down the stack, keeping their order among themselves. */
export function reorder(
  elements: readonly BoardElement[],
  ids: ReadonlySet<string>,
  move: LayerMove,
): BoardElement[] {
  const chosen = elements.filter((element) => ids.has(element.id));
  const rest = elements.filter((element) => !ids.has(element.id));
  if (chosen.length === 0) return [...elements];
  if (move === "front") return [...rest, ...chosen];
  if (move === "back") return [...chosen, ...rest];
  const out = [...elements];
  if (move === "forward") {
    for (let at = out.length - 2; at >= 0; at--) {
      if (ids.has(out[at].id) && !ids.has(out[at + 1].id))
        [out[at], out[at + 1]] = [out[at + 1], out[at]];
    }
  } else {
    for (let at = 1; at < out.length; at++) {
      if (ids.has(out[at].id) && !ids.has(out[at - 1].id))
        [out[at], out[at - 1]] = [out[at - 1], out[at]];
    }
  }
  return out;
}

/** Puts these elements in one new group, outside any group they were in. */
export function group(elements: readonly BoardElement[], ids: ReadonlySet<string>): BoardElement[] {
  if (ids.size < 2) return [...elements];
  const id = newId();
  return updateElements(elements, ids, (element) => ({
    ...element,
    groupIds: [...element.groupIds, id],
  }));
}

/** Takes these elements out of their outermost group. */
export function ungroup(
  elements: readonly BoardElement[],
  ids: ReadonlySet<string>,
): BoardElement[] {
  return updateElements(elements, ids, (element) => ({
    ...element,
    groupIds: element.groupIds.slice(0, -1),
  }));
}

export const setLocked = (
  elements: readonly BoardElement[],
  ids: ReadonlySet<string>,
  locked: boolean,
) => updateElements(elements, ids, (element) => ({ ...element, locked }));

export const moveElements = (
  elements: readonly BoardElement[],
  ids: ReadonlySet<string>,
  [dx, dy]: Point,
) =>
  updateElements(elements, ids, (element) => ({
    ...element,
    x: element.x + dx,
    y: element.y + dy,
  }));
