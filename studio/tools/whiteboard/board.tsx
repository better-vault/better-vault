"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  copySelection,
  deleteSelected,
  duplicateSelected,
  fitContent,
  fittedView,
  groupSelected,
  nudge,
  pasteText,
  reorderSelected,
  resetZoom,
  selectAll,
  toggleLock,
  ungroupSelected,
  viewCenter,
  zoomBy,
  type Size,
} from "./actions";
import { BoardCanvas } from "./board-canvas";
import type { OutputChrome } from "@/studio/shared/form";
import { BoardInfo, BoardMenu, ViewControls } from "./controls";
import type { Point } from "./geometry";
import { placedSize, prepareImage } from "./images";
import { PropertiesPanel } from "./properties-panel";
import { newId, newSeed } from "./scene";
import type { BoardData, BoardElement } from "./schema";
import { TextEditor } from "./text-editor";
import { Toolbar } from "./toolbar";
import { toolForKey, type BoardTool } from "./tools-meta";
import { useBoard } from "./use-board";
import { toWorld } from "./viewport";

const SAVE_DELAY = 800;

/** Keys typed here belong to the field, not the board. */
const TYPING =
  "input, textarea, select, [contenteditable=true], [role=menu], [role=listbox], [role=dialog]";

/**
 * An open whiteboard: the drawing, the tools above it, the style panel at
 * its start, zoom and undo below. Changes are saved shortly after they are
 * made, and at once when the board closes or the page is hidden.
 */
export function Board({
  initial,
  onSave,
  chrome,
}: {
  initial: BoardData;
  onSave: (data: BoardData) => void;
  /** The board's name and actions, shown on the board. */
  chrome?: OutputChrome;
}) {
  const { t } = useTranslation("studio");
  const board = useBoard(initial);
  const root = useRef<HTMLDivElement>(null);
  const sizeRef = useRef<Size>({ width: 0, height: 0 });
  const pointer = useRef<Point | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const placeAt = useRef<Point | null>(null);
  const [panning, setPanning] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const size = useCallback(() => sizeRef.current, []);

  // ---- Size, and a first view that shows everything.
  const { setView } = board;
  useLayoutEffect(() => {
    const element = root.current;
    if (!element) return;
    const measure = () => {
      sizeRef.current = { width: element.clientWidth, height: element.clientHeight };
    };
    measure();
    setView((view) => view ?? fittedView(initial.elements, sizeRef.current));
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    element.focus({ preventScroll: true });
    return () => observer.disconnect();
  }, [initial.elements, setView]);

  // ---- Saving.
  const latest = useRef({ background: board.background, view: board.view });
  const saved = useRef({
    elements: initial.elements,
    background: initial.background,
    view: initial.view,
  });
  useLayoutEffect(() => {
    latest.current = { background: board.background, view: board.view };
  }, [board.background, board.view]);

  const { latestRef } = board;
  const save = useCallback(() => {
    const { elements, files } = latestRef.current;
    const { background, view } = latest.current;
    const last = saved.current;
    if (last.elements === elements && last.background === background && last.view === view) return;
    saved.current = { elements, background, view };
    const used = new Set(
      elements.flatMap((element) => (element.type === "image" ? [element.fileId] : [])),
    );
    onSave({
      version: 1,
      elements,
      files: Object.fromEntries(Object.entries(files).filter(([id]) => used.has(id))),
      background,
      view,
      origin: initial.origin,
      saveId: newId(),
    });
  }, [latestRef, initial.origin, onSave]);

  useEffect(() => {
    if (board.revision === 0) return;
    const timer = window.setTimeout(save, SAVE_DELAY);
    return () => window.clearTimeout(timer);
  }, [board.revision, save]);

  useEffect(() => {
    const hide = () => {
      if (document.visibilityState === "hidden") save();
    };
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("pagehide", save);
    return () => {
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("pagehide", save);
      save();
    };
  }, [save]);

  // ---- Tools and pictures.
  const chooseTool = useCallback(
    (tool: BoardTool) => {
      if (tool === "image") {
        placeAt.current = null;
        fileInput.current?.click();
        return;
      }
      board.setTool(tool);
      if (tool !== "selection") board.setSelected(new Set());
      setAnnouncement(t("whiteboard.announce.tool", { tool: t(`whiteboard.tools.${tool}`) }));
    },
    [board, t],
  );

  async function insertImage(file: Blob, at: Point | null) {
    try {
      const prepared = await prepareImage(file);
      const fileId = newId();
      const { width, height } = placedSize(prepared);
      const [cx, cy] = at ?? viewCenter(board, sizeRef.current);
      const element: BoardElement = {
        type: "image",
        id: newId(),
        fileId,
        x: cx - width / 2,
        y: cy - height / 2,
        width,
        height,
        angle: 0,
        stroke: board.style.stroke,
        fill: "none",
        fillStyle: "hachure",
        strokeWidth: 2,
        strokeStyle: "solid",
        roughness: 1,
        edges: "round",
        opacity: 100,
        seed: newSeed(),
        groupIds: [],
        locked: false,
      };
      board.addFile(fileId, prepared);
      board.change((list) => [...list, element]);
      board.setTool("selection");
      board.setSelected(new Set([element.id]));
    } catch {
      toast.error(t("whiteboard.imageError"));
    }
  }

  const pointerWorld = (): Point =>
    pointer.current
      ? toWorld(pointer.current, board.view ?? { x: 0, y: 0, zoom: 1 })
      : viewCenter(board, sizeRef.current);

  // ---- Keyboard and clipboard, while the board has focus.
  const handlers = useRef<{
    key: (event: KeyboardEvent) => void;
    keyUp: (event: KeyboardEvent) => void;
    paste: (event: ClipboardEvent) => void;
  } | null>(null);
  useLayoutEffect(() => {
    handlers.current = {
      key(event) {
        const target = event.target as HTMLElement;
        if (board.editingId || target.closest(TYPING)) return;
        const mod = event.metaKey || event.ctrlKey;
        const key = event.key.toLowerCase();
        const onButton = target.closest("button") !== null;

        if (event.key === " " && !mod) {
          if (onButton) return;
          event.preventDefault();
          setPanning(true);
          return;
        }
        if (mod) {
          const bracket =
            event.code === "BracketRight" ? "]" : event.code === "BracketLeft" ? "[" : null;
          if (key === "z") {
            if (event.shiftKey) board.redo();
            else board.undo();
          } else if (key === "y") board.redo();
          else if (key === "a") selectAll(board);
          else if (key === "d") duplicateSelected(board);
          else if (key === "g") {
            if (event.shiftKey) ungroupSelected(board);
            else groupSelected(board);
          } else if (key === "c") {
            copySelection(board);
            return;
          } else if (key === "x") {
            if (copySelection(board)) deleteSelected(board);
          } else if (key === "l" && event.shiftKey) toggleLock(board);
          else if (bracket === "]") reorderSelected(board, event.shiftKey ? "front" : "forward");
          else if (bracket === "[") reorderSelected(board, event.shiftKey ? "back" : "backward");
          else if (key === "=" || key === "+") zoomBy(board, 1.25, sizeRef.current);
          else if (key === "-") zoomBy(board, 1 / 1.25, sizeRef.current);
          else if (key === "0") resetZoom(board, sizeRef.current);
          else return;
          event.preventDefault();
          return;
        }
        if (event.altKey) return;
        if (event.shiftKey && (event.code === "Digit1" || event.code === "Digit2")) {
          event.preventDefault();
          fitContent(board, sizeRef.current, event.code === "Digit2");
          return;
        }
        if (onButton && (event.key === "Enter" || event.key === " ")) return;

        switch (event.key) {
          case "Escape":
            board.setSelected(new Set());
            board.setTool("selection");
            return;
          case "Delete":
          case "Backspace": {
            const count = deleteSelected(board);
            if (count) setAnnouncement(t("whiteboard.announce.deleted", { count }));
            event.preventDefault();
            return;
          }
          case "Enter": {
            const [only] = board.selectedElements;
            if (board.selectedElements.length === 1 && only.type === "text" && !only.locked) {
              event.preventDefault();
              board.beginEdit(only.id);
            }
            return;
          }
          case "ArrowUp":
          case "ArrowDown":
          case "ArrowLeft":
          case "ArrowRight": {
            if (board.selectedElements.length === 0) return;
            event.preventDefault();
            const step = event.shiftKey ? 10 : 1;
            const dx = event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
            const dy = event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
            nudge(board, [dx, dy]);
            return;
          }
        }
        if (event.shiftKey) return;
        if (key === "q" || event.code === "KeyQ") {
          board.setToolLocked((locked) => !locked);
          return;
        }
        const tool = toolForKey(event);
        if (tool) {
          event.preventDefault();
          chooseTool(tool);
        }
      },
      keyUp(event) {
        if (event.key === " ") setPanning(false);
      },
      paste(event) {
        const target = event.target as HTMLElement | null;
        if (board.editingId || target?.closest(TYPING)) return;
        const data = event.clipboardData;
        if (!data) return;
        const picture = [...data.files].find((file) => file.type.startsWith("image/"));
        event.preventDefault();
        if (picture) void insertImage(picture, pointerWorld());
        else pasteText(board, data.getData("text/plain"), pointerWorld());
      },
    };
  });

  useEffect(() => {
    const within = () => root.current?.contains(document.activeElement) ?? false;
    const key = (event: KeyboardEvent) => {
      if (within()) handlers.current?.key(event);
    };
    const keyUp = (event: KeyboardEvent) => handlers.current?.keyUp(event);
    const paste = (event: ClipboardEvent) => {
      if (within()) handlers.current?.paste(event);
    };
    const blur = () => setPanning(false);
    document.addEventListener("keydown", key);
    document.addEventListener("keyup", keyUp);
    document.addEventListener("paste", paste);
    window.addEventListener("blur", blur);
    return () => {
      document.removeEventListener("keydown", key);
      document.removeEventListener("keyup", keyUp);
      document.removeEventListener("paste", paste);
      window.removeEventListener("blur", blur);
    };
  }, []);

  const editing = board.editingId
    ? board.elements.find((element) => element.id === board.editingId)
    : undefined;
  const empty = board.elements.length === 0;

  return (
    <div
      ref={root}
      role="application"
      aria-label={t("whiteboard.label")}
      aria-roledescription={t("whiteboard.label")}
      tabIndex={-1}
      className="relative isolate min-h-[28rem] flex-1 overflow-hidden rounded-3xl bg-background ring-1 ring-border outline-none"
      onPointerDownCapture={(event) => {
        // Focus the board, so its keys work, unless a control is being used.
        if (!(event.target as HTMLElement).closest("button, input, textarea, [role=slider]"))
          root.current?.focus({ preventScroll: true });
      }}
      onPointerMove={(event) => {
        const box = root.current!.getBoundingClientRect();
        pointer.current = [event.clientX - box.left, event.clientY - box.top];
      }}
      onDragOver={(event) => {
        if ([...event.dataTransfer.items].some((item) => item.kind === "file"))
          event.preventDefault();
      }}
      onDrop={(event) => {
        const picture = [...event.dataTransfer.files].find((file) =>
          file.type.startsWith("image/"),
        );
        if (!picture) return;
        event.preventDefault();
        const box = root.current!.getBoundingClientRect();
        void insertImage(
          picture,
          toWorld(
            [event.clientX - box.left, event.clientY - box.top],
            board.view ?? { x: 0, y: 0, zoom: 1 },
          ),
        );
      }}
    >
      <BoardCanvas
        board={board}
        panning={panning}
        onPlaceImage={(at) => {
          placeAt.current = at;
          fileInput.current?.click();
        }}
        onCreated={() => {
          if (!board.toolLocked) board.setTool("selection");
        }}
      />

      {editing?.type === "text" ? (
        <TextEditor
          key={editing.id}
          board={board}
          element={editing}
          onDone={() => {
            board.endEdit();
            if (!board.toolLocked) board.setTool("selection");
            root.current?.focus({ preventScroll: true });
          }}
        />
      ) : null}

      {empty && !editing ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-8">
          <div className="max-w-sm text-center">
            <p className="font-hand text-2xl text-muted-foreground">
              {t("whiteboard.empty.title")}
            </p>
            <p className="mt-2 text-sm text-muted-foreground/80">{t("whiteboard.empty.body")}</p>
          </div>
        </div>
      ) : null}

      <div className="pointer-events-none absolute inset-x-3 top-3 flex justify-center max-sm:top-auto max-sm:bottom-16">
        <Toolbar board={board} onChoose={chooseTool} />
      </div>

      {chrome ? (
        <div className="pointer-events-none absolute start-3 top-3">
          <BoardInfo chrome={chrome} />
        </div>
      ) : null}

      <div className="pointer-events-none absolute start-3 top-18 bottom-18 flex flex-col items-start max-sm:bottom-32">
        <PropertiesPanel board={board} />
      </div>

      <div className="pointer-events-none absolute start-3 bottom-3">
        <ViewControls board={board} size={size} />
      </div>
      <div className="pointer-events-none absolute end-3 bottom-3">
        <BoardMenu board={board} chrome={chrome} />
      </div>

      <input
        ref={fileInput}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        tabIndex={-1}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void insertImage(file, placeAt.current);
        }}
      />
      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>
    </div>
  );
}
