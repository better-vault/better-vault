"use client";

import { useCallback, useState } from "react";
import type { ToolViewerProps } from "@/studio/shared/form";
import { Board } from "./board";
import type { BoardData } from "./schema";

/** The boards this page saved: their saves coming back are not changes from elsewhere. */
const ownSaves = new Set<string>();

/**
 * The whiteboard output. The board keeps its own state while it is open; a
 * save from another tab replaces it, the board's own saves don't.
 */
export function WhiteboardViewer({ data, onDataChange, chrome }: ToolViewerProps<BoardData>) {
  const [shown, setShown] = useState({ data, key: 0 });
  if (data.saveId !== shown.data.saveId && data.saveId !== "" && !ownSaves.has(data.saveId)) {
    setShown({ data, key: shown.key + 1 });
  }

  const save = useCallback(
    (next: BoardData) => {
      ownSaves.add(next.saveId);
      void onDataChange?.(next);
    },
    [onDataChange],
  );

  return <Board key={shown.key} initial={shown.data} onSave={save} chrome={chrome} />;
}
