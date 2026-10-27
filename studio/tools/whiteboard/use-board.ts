"use client";

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createHistory } from "./history";
import {
  defaultStyle,
  type Background,
  type BoardData,
  type BoardElement,
  type BoardFile,
  type BoardView,
  type DrawStyle,
} from "./schema";
import type { BoardTool } from "./tools-meta";

/** What undo and redo restore. Files are kept so an undone deletion brings its picture back. */
export interface Snapshot {
  elements: BoardElement[];
  files: Record<string, BoardFile>;
}

/** Pictures no element uses: dropped when a board opens, not while it is edited. */
function usedFiles(data: BoardData): Record<string, BoardFile> {
  const used = new Set(
    data.elements.flatMap((element) => (element.type === "image" ? [element.fileId] : [])),
  );
  return Object.fromEntries(Object.entries(data.files).filter(([id]) => used.has(id)));
}

/**
 * A board's state while it is open: what is drawn, what is selected, the
 * tool and style, the view, and undo history. Every committed change bumps
 * `revision`, which the autosave watches.
 */
export function useBoard(initial: BoardData) {
  const [elements, setElements] = useState<BoardElement[]>(initial.elements);
  const [files, setFiles] = useState<Record<string, BoardFile>>(() => usedFiles(initial));
  const [background, setBackgroundState] = useState<Background>(initial.background);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tool, setTool] = useState<BoardTool>("selection");
  const [toolLocked, setToolLocked] = useState(false);
  const [style, setStyle] = useState<DrawStyle>(defaultStyle);
  const [view, setView] = useState<BoardView | null>(initial.view);
  const [revision, setRevision] = useState(0);
  const [historyState, setHistoryState] = useState({ undo: false, redo: false });
  const history = useRef(createHistory<Snapshot>());
  // Text being typed: which element, and the state from before, recorded as one step when typing ends.
  const editing = useRef<{ id: string; before: Snapshot } | null>(null);
  const current = useRef<Snapshot>({ elements: initial.elements, files: usedFiles(initial) });
  useLayoutEffect(() => {
    current.current = { elements, files };
  }, [elements, files]);

  const syncHistory = useCallback(() => {
    setHistoryState({ undo: history.current.canUndo(), redo: history.current.canRedo() });
  }, []);

  /** Records the state from before a change as one undo step, and marks the board changed. */
  const record = useCallback(
    (before: Snapshot, key?: string) => {
      history.current.record(before, key);
      syncHistory();
      setRevision((value) => value + 1);
    },
    [syncHistory],
  );

  /** One whole change: recorded for undo and saved. */
  const change = useCallback(
    (update: (elements: BoardElement[]) => BoardElement[], key?: string) => {
      const before = current.current;
      const next = update(before.elements);
      if (next === before.elements) return;
      setElements(next);
      record(before, key);
    },
    [record],
  );

  const addFile = useCallback(
    (id: string, file: BoardFile) => setFiles((existing) => ({ ...existing, [id]: file })),
    [],
  );

  const restore = useCallback(
    (snapshot: Snapshot | null) => {
      if (!snapshot) return;
      setElements(snapshot.elements);
      setFiles(snapshot.files);
      setSelected(
        (ids) =>
          new Set([...ids].filter((id) => snapshot.elements.some((element) => element.id === id))),
      );
      editing.current = null;
      setEditingId(null);
      syncHistory();
      setRevision((value) => value + 1);
    },
    [syncHistory],
  );

  const undo = useCallback(() => restore(history.current.undo(current.current)), [restore]);
  const redo = useCallback(() => restore(history.current.redo(current.current)), [restore]);

  const setBackground = useCallback((next: Background) => {
    setBackgroundState(next);
    setRevision((value) => value + 1);
  }, []);

  /** Starts typing in a text element; call it in the same handler that adds a new one. */
  const beginEdit = useCallback((id: string) => {
    editing.current = { id, before: current.current };
    setEditingId(id);
  }, []);

  /** Ends typing: empty text is removed, and a change is one undo step. */
  const endEdit = useCallback(() => {
    const edit = editing.current;
    editing.current = null;
    setEditingId(null);
    if (!edit) return;
    const element = current.current.elements.find((item) => item.id === edit.id);
    const original = edit.before.elements.find((item) => item.id === edit.id);
    if (!element || element.type !== "text") return;
    if (element.text.trim() === "") {
      setElements((list) => list.filter((item) => item.id !== edit.id));
      setSelected(new Set());
      // A new, empty text leaves nothing to undo.
      if (original) record(edit.before);
    } else if (!original || original.type !== "text" || original.text !== element.text) {
      record(edit.before);
    }
  }, [record]);

  const selectedElements = useMemo(
    () => elements.filter((element) => selected.has(element.id)),
    [elements, selected],
  );

  return {
    elements,
    setElements,
    files,
    addFile,
    background,
    setBackground,
    selected,
    setSelected,
    selectedElements,
    editingId,
    beginEdit,
    endEdit,
    tool,
    setTool,
    toolLocked,
    setToolLocked,
    style,
    setStyle,
    view,
    setView,
    revision,
    record,
    change,
    undo,
    redo,
    canUndo: historyState.undo,
    canRedo: historyState.redo,
    /** The latest elements and files, for event handlers that outlive a render. */
    latestRef: current,
  };
}

export type BoardModel = ReturnType<typeof useBoard>;
