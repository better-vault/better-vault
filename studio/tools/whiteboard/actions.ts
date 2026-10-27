import { commonBounds, type Point } from "./geometry";
import {
  duplicate,
  group,
  moveElements,
  newId,
  newSeed,
  removeElements,
  reorder,
  setLocked,
  ungroup,
  type LayerMove,
} from "./scene";
import { boardData, type BoardElement, type BoardFile, type DrawStyle } from "./schema";
import { measureText } from "./text";
import type { BoardModel } from "./use-board";
import { fitView, toWorld, zoomAt } from "./viewport";

/** What the toolbar, the properties panel and the keyboard do to a board. */

export interface Size {
  width: number;
  height: number;
}

/** The selected elements that may be changed: locked ones are left alone. */
export function editableIds(board: BoardModel): Set<string> {
  return new Set(
    board.selectedElements.filter((element) => !element.locked).map((element) => element.id),
  );
}

export function deleteSelected(board: BoardModel): number {
  const ids = editableIds(board);
  if (ids.size === 0) return 0;
  board.change((list) => removeElements(list, ids));
  board.setSelected(new Set());
  return ids.size;
}

export function duplicateSelected(board: BoardModel) {
  const ids = editableIds(board);
  if (ids.size === 0) return;
  let copies = new Set<string>();
  board.change((list) => {
    const result = duplicate(list, ids);
    copies = result.ids;
    return result.elements;
  });
  board.setSelected(copies);
}

export function selectAll(board: BoardModel) {
  board.setTool("selection");
  board.setSelected(
    new Set(board.elements.filter((element) => !element.locked).map((element) => element.id)),
  );
}

export function groupSelected(board: BoardModel) {
  const ids = editableIds(board);
  if (ids.size > 1) board.change((list) => group(list, ids));
}

export function ungroupSelected(board: BoardModel) {
  const ids = editableIds(board);
  if (board.selectedElements.some((element) => ids.has(element.id) && element.groupIds.length > 0))
    board.change((list) => ungroup(list, ids));
}

/** Locks the selection, or unlocks it when all of it is locked. Locked elements can't be picked, so they are deselected. */
export function toggleLock(board: BoardModel) {
  const ids = new Set(board.selectedElements.map((element) => element.id));
  if (ids.size === 0) return;
  const lock = board.selectedElements.some((element) => !element.locked);
  board.change((list) => setLocked(list, ids, lock));
  if (lock) board.setSelected(new Set());
}

export function unlockAll(board: BoardModel) {
  const ids = new Set(
    board.elements.filter((element) => element.locked).map((element) => element.id),
  );
  if (ids.size === 0) return;
  board.change((list) => setLocked(list, ids, false));
  board.setSelected(ids);
}

export function clearBoard(board: BoardModel) {
  if (board.elements.length === 0) return;
  board.change(() => []);
  board.setSelected(new Set());
}

export function reorderSelected(board: BoardModel, move: LayerMove) {
  const ids = editableIds(board);
  if (ids.size > 0) board.change((list) => reorder(list, ids, move));
}

export function nudge(board: BoardModel, offset: Point) {
  const ids = editableIds(board);
  if (ids.size > 0) board.change((list) => moveElements(list, ids, offset), "nudge");
}

/** Applies a style change to the selection (and to what is drawn next). */
export function applyStyle(board: BoardModel, patch: Partial<DrawStyle>, key?: string) {
  board.setStyle((style) => ({ ...style, ...patch }));
  const ids = editableIds(board);
  if (ids.size === 0) return;
  board.change(
    (list) => list.map((element) => (ids.has(element.id) ? styled(element, patch) : element)),
    key,
  );
}

function styled(element: BoardElement, patch: Partial<DrawStyle>): BoardElement {
  const { font, fontSize, align, start, end, ...common } = patch;
  let next = { ...element, ...common } as BoardElement;
  if (
    next.type === "text" &&
    (font !== undefined || fontSize !== undefined || align !== undefined)
  ) {
    const text = {
      ...next,
      font: font ?? next.font,
      fontSize: fontSize ?? next.fontSize,
      align: align ?? next.align,
    };
    next = { ...text, ...measureText(text.text, text.font, text.fontSize) };
  }
  if (
    (next.type === "line" || next.type === "arrow") &&
    (start !== undefined || end !== undefined)
  ) {
    next = {
      ...next,
      start: start === undefined ? next.start : start,
      end: end === undefined ? next.end : end,
    };
  }
  return next;
}

// ---- View

/** The toolbar's height: fitted content goes below it. */
const TOOLBAR = 56;

/** A view that shows these elements in the board, below the toolbar. */
export function fittedView(elements: readonly BoardElement[], size: Size, maxZoom = 1) {
  const view = fitView(commonBounds(elements), size.width, size.height - TOOLBAR, 56, maxZoom);
  return { ...view, y: view.y + TOOLBAR };
}

export function fitContent(board: BoardModel, size: Size, onlySelection = false) {
  const elements =
    onlySelection && board.selectedElements.length > 0 ? board.selectedElements : board.elements;
  board.setView(fittedView(elements, size, onlySelection ? 4 : 1));
}

export function zoomBy(board: BoardModel, factor: number, size: Size) {
  board.setView((view) =>
    zoomAt(view ?? { x: 0, y: 0, zoom: 1 }, factor, [size.width / 2, size.height / 2]),
  );
}

export function resetZoom(board: BoardModel, size: Size) {
  board.setView((view) => {
    const current = view ?? { x: 0, y: 0, zoom: 1 };
    return zoomAt(current, 1 / current.zoom, [size.width / 2, size.height / 2]);
  });
}

/** The middle of what is on screen, in world units. */
export function viewCenter(board: BoardModel, size: Size): Point {
  return toWorld([size.width / 2, size.height / 2], board.view ?? { x: 0, y: 0, zoom: 1 });
}

// ---- Clipboard

const CLIPBOARD_TYPE = "better-vault/whiteboard";
let memory: string | null = null;

/** Copies the selection, with its pictures, as JSON text. */
export function copySelection(board: BoardModel): boolean {
  const elements = board.selectedElements;
  if (elements.length === 0) return false;
  const used = new Set(
    elements.flatMap((element) => (element.type === "image" ? [element.fileId] : [])),
  );
  const files = Object.fromEntries(Object.entries(board.files).filter(([id]) => used.has(id)));
  memory = JSON.stringify({ type: CLIPBOARD_TYPE, elements, files });
  navigator.clipboard?.writeText(memory).catch(() => {});
  return true;
}

/** Elements copied from a board, if this text is one. */
function readCopied(
  text: string,
): { elements: BoardElement[]; files: Record<string, BoardFile> } | null {
  if (!text.startsWith("{") || !text.includes(CLIPBOARD_TYPE)) return null;
  try {
    const value = JSON.parse(text) as { type?: string; elements?: unknown; files?: unknown };
    if (value.type !== CLIPBOARD_TYPE) return null;
    const parsed = boardData.parse({ elements: value.elements, files: value.files });
    return parsed.elements.length > 0 ? { elements: parsed.elements, files: parsed.files } : null;
  } catch {
    return null;
  }
}

/** Pastes copied elements centred on `at`, or text as a new text element. */
export function pasteText(board: BoardModel, text: string, at: Point) {
  const copied = readCopied(text) ?? (memory && text === "" ? readCopied(memory) : null);
  if (copied) {
    const box = commonBounds(copied.elements)!;
    const dx = at[0] - (box.minX + box.maxX) / 2;
    const dy = at[1] - (box.minY + box.maxY) / 2;
    const fileIds = new Map(Object.keys(copied.files).map((id) => [id, newId()]));
    const groups = new Map<string, string>();
    const elements = copied.elements.map((element) => {
      const next = {
        ...element,
        id: newId(),
        seed: newSeed(),
        x: element.x + dx,
        y: element.y + dy,
        locked: false,
        groupIds: element.groupIds.map((id) => {
          if (!groups.has(id)) groups.set(id, newId());
          return groups.get(id)!;
        }),
      } as BoardElement;
      return next.type === "image"
        ? { ...next, fileId: fileIds.get(next.fileId) ?? next.fileId }
        : next;
    });
    for (const [id, file] of Object.entries(copied.files)) board.addFile(fileIds.get(id)!, file);
    board.change((list) => [...list, ...elements]);
    board.setTool("selection");
    board.setSelected(new Set(elements.map((element) => element.id)));
    return;
  }
  const value = text.trim().slice(0, 10_000);
  if (!value) return;
  const { style } = board;
  const size = measureText(value, style.font, style.fontSize);
  const element: BoardElement = {
    type: "text",
    id: newId(),
    x: at[0] - size.width / 2,
    y: at[1] - size.height / 2,
    ...size,
    angle: 0,
    text: value,
    font: style.font,
    fontSize: style.fontSize,
    align: style.align,
    stroke: style.stroke,
    fill: "none",
    fillStyle: style.fillStyle,
    strokeWidth: style.strokeWidth,
    strokeStyle: style.strokeStyle,
    roughness: style.roughness,
    edges: style.edges,
    opacity: style.opacity,
    seed: newSeed(),
    groupIds: [],
    locked: false,
  };
  board.change((list) => [...list, element]);
  board.setTool("selection");
  board.setSelected(new Set([element.id]));
}
