import {
  Add01Icon,
  CenterFocusIcon,
  Delete02Icon,
  Download04Icon,
  Link04Icon,
  MinusSignIcon,
  MoreHorizontalIcon,
  Note01Icon,
  PencilEdit01Icon,
  TextIcon,
} from "@hugeicons/core-free-icons";
import { generateId } from "ai";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { Field } from "@/components/common/field";
import { Icon } from "@/components/icon";
import { NoteReader } from "@/components/notes/note-reader";
import { useNotesWorld } from "@/components/notes/use-notes-world";
import { Button } from "@/components/panelui/button";
import { Canvas } from "@/components/panelui/canvas";
import { Dialog } from "@/components/panelui/dialog";
import { Input } from "@/components/panelui/input";
import { Menu } from "@/components/panelui/menu";
import { useWorkspace } from "@/components/workspace/workspace-context";
import { createNote } from "@/lib/db/notes";
import type { NoteLink } from "@/lib/db/types";
import { resolveLink } from "@/lib/notes/resolve";
import { cn } from "@/lib/utils";
import type { ToolViewerProps } from "@/studio/shared/form";
import { OutputInfo } from "@/studio/shared/output-info";
import { usePanZoom } from "@/studio/shared/pan-zoom";
import {
  anchor,
  canvasColors,
  edgePath,
  facing,
  noteTitleOf,
  type CanvasData,
  type CanvasEdge,
  type CanvasNode,
  type Side,
} from "./schema";

const ownSaves = new Set<string>();
const sides: Side[] = ["top", "right", "bottom", "left"];
const floating =
  "pointer-events-auto flex items-center gap-1 rounded-2xl border bg-background/95 p-1 shadow-sm backdrop-blur";
const toolButton =
  "flex size-8 cursor-pointer items-center justify-center rounded-xl text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring";

type Selection = { kind: "node" | "edge"; id: string } | null;
type Gesture =
  | { kind: "move"; id: string; startX: number; startY: number; x: number; y: number }
  | { kind: "resize"; id: string; startX: number; startY: number; width: number; height: number }
  | { kind: "connect"; from: string; side: Side; point: { x: number; y: number } }
  | null;

/**
 * The canvas, like Obsidian Canvas: text, note and link cards on an endless
 * board, joined by arrows. Drag a card to move it, its corner to resize it,
 * one of its dots onto another card to join them; double-click the board to
 * write. Saved in the JSON Canvas format, so it exports as a `.canvas` file.
 */
export function CanvasViewer({ data, onDataChange, chrome }: ToolViewerProps<CanvasData>) {
  const [shown, setShown] = useState({ data, key: 0 });
  if (data.saveId !== shown.data.saveId && data.saveId !== "" && !ownSaves.has(data.saveId)) {
    setShown({ data, key: shown.key + 1 });
  }
  const save = useCallback(
    (next: CanvasData) => {
      ownSaves.add(next.saveId);
      void onDataChange?.(next);
    },
    [onDataChange],
  );
  return <Board key={shown.key} initial={shown.data} onSave={save} chrome={chrome} />;
}

function Board({
  initial,
  onSave,
  chrome,
}: {
  initial: CanvasData;
  onSave: (data: CanvasData) => void;
  chrome?: ToolViewerProps<CanvasData>["chrome"];
}) {
  const { t } = useTranslation("studio");
  const { notebook } = useWorkspace();
  const navigate = useNavigate();
  const world = useNotesWorld();
  const vaultId = notebook.vaultId ?? "default";
  const [nodes, setNodes] = useState(initial.nodes);
  const [edges, setEdges] = useState(initial.edges);
  const [selection, setSelection] = useState<Selection>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [gesture, setGesture] = useState<Gesture>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const { frame, view, setView, zoomAt, fit, handlers } = usePanZoom();
  const first = useRef(true);

  // Saves a moment after each change to the cards or arrows (only then: a
  // new `onSave` from the page must not save again, or saves would loop).
  const saveRef = useRef(onSave);
  useEffect(() => {
    saveRef.current = onSave;
  });
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const timer = setTimeout(() => saveRef.current({ nodes, edges, saveId: generateId() }), 300);
    return () => clearTimeout(timer);
  }, [nodes, edges]);

  const toWorld = useCallback(
    (clientX: number, clientY: number) => {
      const box = frame.current?.getBoundingClientRect();
      return {
        x: (clientX - (box?.left ?? 0) - view.x) / view.zoom,
        y: (clientY - (box?.top ?? 0) - view.y) / view.zoom,
      };
    },
    [frame, view],
  );

  const center = () => {
    const box = frame.current?.getBoundingClientRect();
    return toWorld(
      (box?.left ?? 0) + (box?.width ?? 600) / 2,
      (box?.top ?? 0) + (box?.height ?? 400) / 2,
    );
  };

  const fitAll = useCallback(() => {
    if (nodes.length === 0) return setView({ x: 0, y: 0, zoom: 1 });
    const minX = Math.min(...nodes.map((n) => n.x));
    const minY = Math.min(...nodes.map((n) => n.y));
    const maxX = Math.max(...nodes.map((n) => n.x + n.width));
    const maxY = Math.max(...nodes.map((n) => n.y + n.height));
    fit(maxX - minX, maxY - minY);
    setView((current) => ({
      ...current,
      x: current.x - minX * current.zoom,
      y: current.y - minY * current.zoom,
    }));
  }, [nodes, fit, setView]);

  // Starts fitted to what is on it.
  useEffect(() => {
    const timer = setTimeout(fitAll, 0);
    return () => clearTimeout(timer);
    // Only once, when the board opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addNode = (node: {
    type: CanvasNode["type"];
    width: number;
    height: number;
    x?: number;
    y?: number;
    text?: string;
    file?: string;
    url?: string;
  }) => {
    const at = node.x !== undefined && node.y !== undefined ? { x: node.x, y: node.y } : center();
    const created: CanvasNode = {
      ...node,
      id: generateId(),
      x: Math.round(at.x - node.width / 2),
      y: Math.round(at.y - node.height / 2),
    };
    setNodes((current) => [...current, created]);
    setSelection({ kind: "node", id: created.id });
    return created;
  };

  const patchNode = (id: string, patch: Partial<CanvasNode>) =>
    setNodes((current) => current.map((node) => (node.id === id ? { ...node, ...patch } : node)));
  const patchEdge = (id: string, patch: Partial<CanvasEdge>) =>
    setEdges((current) => current.map((edge) => (edge.id === id ? { ...edge, ...patch } : edge)));

  const removeSelection = useCallback(() => {
    if (!selection) return;
    if (selection.kind === "node") {
      setNodes((current) => current.filter((node) => node.id !== selection.id));
      setEdges((current) =>
        current.filter((edge) => edge.fromNode !== selection.id && edge.toNode !== selection.id),
      );
    } else {
      setEdges((current) => current.filter((edge) => edge.id !== selection.id));
    }
    setSelection(null);
  }, [selection]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const typing =
        event.target instanceof HTMLElement &&
        (event.target.isContentEditable || ["INPUT", "TEXTAREA"].includes(event.target.tagName));
      if (typing) return;
      if ((event.key === "Delete" || event.key === "Backspace") && selection) {
        event.preventDefault();
        removeSelection();
      } else if (event.key === "Escape") {
        setSelection(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selection, removeSelection]);

  // Moving, resizing and joining follow the pointer anywhere on the page.
  useEffect(() => {
    if (!gesture) return;
    const move = (event: PointerEvent) => {
      const point = toWorld(event.clientX, event.clientY);
      if (gesture.kind === "move") {
        const dx = (event.clientX - gesture.startX) / view.zoom;
        const dy = (event.clientY - gesture.startY) / view.zoom;
        patchNode(gesture.id, { x: Math.round(gesture.x + dx), y: Math.round(gesture.y + dy) });
      } else if (gesture.kind === "resize") {
        patchNode(gesture.id, {
          width: Math.max(
            120,
            Math.round(gesture.width + (event.clientX - gesture.startX) / view.zoom),
          ),
          height: Math.max(
            60,
            Math.round(gesture.height + (event.clientY - gesture.startY) / view.zoom),
          ),
        });
      } else {
        setGesture({ ...gesture, point });
      }
    };
    const up = (event: PointerEvent) => {
      if (gesture.kind === "connect") {
        const point = toWorld(event.clientX, event.clientY);
        const target = [...nodes]
          .reverse()
          .find(
            (node) =>
              node.id !== gesture.from &&
              point.x >= node.x &&
              point.x <= node.x + node.width &&
              point.y >= node.y &&
              point.y <= node.y + node.height,
          );
        const from = nodes.find((node) => node.id === gesture.from);
        if (target && from) {
          setEdges((current) => [
            ...current,
            {
              id: generateId(),
              fromNode: from.id,
              fromSide: gesture.side,
              toNode: target.id,
              toSide: facing(target, from),
              toEnd: "arrow",
            },
          ]);
        }
      }
      setGesture(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [gesture, nodes, toWorld, view.zoom]);

  const byId = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const ordered = useMemo(
    () => [...nodes].sort((a, b) => (a.type === "group" ? -1 : 0) - (b.type === "group" ? -1 : 0)),
    [nodes],
  );
  const selectedNode = selection?.kind === "node" ? byId.get(selection.id) : undefined;
  const selectedEdge =
    selection?.kind === "edge" ? edges.find((edge) => edge.id === selection.id) : undefined;
  const vaultNotes = (world?.notes ?? []).filter((note) => note.vaultId === vaultId);

  const openLink = async (link: NoteLink) => {
    if (!world) return;
    const target = resolveLink(link, world, vaultId);
    if (target?.kind === "note") navigate(`/?view=notes&note=${target.note.id}`);
    else if (target?.kind === "notebook") navigate(`/notebook/${target.notebook.id}`);
    else if (target?.kind === "source")
      navigate(`/notebook/${target.source.notebookId}?source=${target.source.id}`);
    else if (link.kind === "note" && link.target) {
      const created = await createNote({ vaultId, title: link.target, notebookId: notebook.id });
      navigate(`/?view=notes&note=${created.id}`);
    }
  };

  const onCardPointerDown = (node: CanvasNode) => (event: ReactPointerEvent) => {
    if (event.button !== 0 || editing === node.id) return;
    if ((event.target as HTMLElement).closest("button, a, textarea, input, [data-handle]")) return;
    event.stopPropagation();
    setSelection({ kind: "node", id: node.id });
    setGesture({
      kind: "move",
      id: node.id,
      startX: event.clientX,
      startY: event.clientY,
      x: node.x,
      y: node.y,
    });
  };

  return (
    <div className="relative isolate min-h-[28rem] flex-1 overflow-hidden rounded-3xl bg-background ring-1 ring-border select-none">
      <Canvas viewport={view} className="absolute inset-0">
        <Canvas.Pattern variant="dots" fade="edges" />
        <div
          ref={frame}
          {...handlers}
          onPointerDown={(event) => {
            if ((event.target as HTMLElement).closest("[data-card], [data-edge]")) return;
            setSelection(null);
            setEditing(null);
            handlers.onPointerDown(event);
          }}
          onDoubleClick={(event) => {
            if ((event.target as HTMLElement).closest("[data-card]")) return;
            const point = toWorld(event.clientX, event.clientY);
            const created = addNode({ type: "text", text: "", width: 260, height: 120, ...point });
            setEditing(created.id);
          }}
          className="absolute inset-0 cursor-grab touch-none active:cursor-grabbing"
        >
          <div
            className="absolute start-0 top-0 origin-top-left"
            style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})` }}
          >
            {/* Arrows under the cards. */}
            <svg className="pointer-events-none absolute overflow-visible" width="1" height="1">
              <defs>
                <marker
                  id="canvas-arrow"
                  viewBox="0 0 10 10"
                  refX="9"
                  refY="5"
                  markerWidth="8"
                  markerHeight="8"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--muted-foreground)" />
                </marker>
                <marker
                  id="canvas-arrow-on"
                  viewBox="0 0 10 10"
                  refX="9"
                  refY="5"
                  markerWidth="8"
                  markerHeight="8"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--primary)" />
                </marker>
              </defs>
              {edges.map((edge) => {
                const from = byId.get(edge.fromNode);
                const to = byId.get(edge.toNode);
                if (!from || !to) return null;
                const fromSide = edge.fromSide ?? facing(from, to);
                const toSide = edge.toSide ?? facing(to, from);
                const a = anchor(from, fromSide);
                const b = anchor(to, toSide);
                const d = edgePath(a, fromSide, b, toSide);
                const on = selection?.kind === "edge" && selection.id === edge.id;
                return (
                  <g key={edge.id} data-edge>
                    <path
                      d={d}
                      fill="none"
                      stroke="transparent"
                      strokeWidth={14}
                      className="pointer-events-auto cursor-pointer"
                      onPointerDown={(event) => {
                        event.stopPropagation();
                        setSelection({ kind: "edge", id: edge.id });
                      }}
                    />
                    <path
                      d={d}
                      fill="none"
                      stroke={on ? "var(--primary)" : "var(--muted-foreground)"}
                      strokeWidth={on ? 2.5 : 1.75}
                      markerEnd={
                        edge.toEnd === "none"
                          ? undefined
                          : `url(#${on ? "canvas-arrow-on" : "canvas-arrow"})`
                      }
                    />
                    {edge.label ? (
                      <text
                        x={(a.x + b.x) / 2}
                        y={(a.y + b.y) / 2 - 6}
                        textAnchor="middle"
                        className="fill-muted-foreground text-xs"
                        style={{
                          paintOrder: "stroke",
                          stroke: "var(--background)",
                          strokeWidth: 4,
                        }}
                      >
                        {edge.label}
                      </text>
                    ) : null}
                  </g>
                );
              })}
              {gesture?.kind === "connect"
                ? (() => {
                    const from = byId.get(gesture.from);
                    if (!from) return null;
                    const a = anchor(from, gesture.side);
                    return (
                      <path
                        d={edgePath(
                          a,
                          gesture.side,
                          gesture.point,
                          gesture.side === "left"
                            ? "right"
                            : gesture.side === "right"
                              ? "left"
                              : gesture.side === "top"
                                ? "bottom"
                                : "top",
                        )}
                        fill="none"
                        stroke="var(--primary)"
                        strokeWidth={2}
                        strokeDasharray="6 4"
                      />
                    );
                  })()
                : null}
            </svg>

            {ordered.map((node) => {
              const color = node.color ? canvasColors[node.color] : undefined;
              const selected = selection?.kind === "node" && selection.id === node.id;
              const noteTarget =
                node.type === "file" && world && node.file
                  ? resolveLink(
                      { kind: "note", target: noteTitleOf(node.file), embed: false },
                      world,
                      vaultId,
                    )
                  : null;
              return (
                <div
                  key={node.id}
                  data-card
                  onPointerDown={onCardPointerDown(node)}
                  onDoubleClick={(event) => {
                    event.stopPropagation();
                    if (node.type === "text") setEditing(node.id);
                    if (node.type === "file" && noteTarget?.kind === "note")
                      navigate(`/?view=notes&note=${noteTarget.note.id}`);
                  }}
                  style={{ left: node.x, top: node.y, width: node.width, height: node.height }}
                  className={cn(
                    "group absolute flex flex-col rounded-2xl border-2 text-sm shadow-sm",
                    node.type === "group" ? "border-dashed bg-transparent shadow-none" : "bg-card",
                    color
                      ? cn(color.border, node.type === "group" ? color.fill : "")
                      : "border-border",
                    selected && "ring-2 ring-primary ring-offset-2 ring-offset-background",
                  )}
                >
                  {node.type === "group" ? (
                    <span className="absolute start-1 -top-6 text-xs font-medium text-muted-foreground">
                      {node.label}
                    </span>
                  ) : null}
                  <div
                    className={cn(
                      "min-h-0 flex-1 overflow-hidden",
                      color && node.type !== "group" && color.fill,
                      "rounded-[14px]",
                    )}
                  >
                    {node.type === "text" ? (
                      editing === node.id ? (
                        <textarea
                          autoFocus
                          defaultValue={node.text ?? ""}
                          onBlur={(event) => {
                            patchNode(node.id, { text: event.target.value });
                            setEditing(null);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Escape") event.currentTarget.blur();
                          }}
                          className="size-full resize-none bg-transparent p-3 font-mono text-[13px] outline-none select-text"
                        />
                      ) : (
                        <div className="size-full overflow-auto p-3 [&_.markdown]:text-sm">
                          {world && node.text ? (
                            <NoteReader
                              body={node.text}
                              world={world}
                              vaultId={vaultId}
                              onOpenLink={(link) => void openLink(link)}
                              depth={1}
                            />
                          ) : (
                            <span className="text-muted-foreground">{t("canvas.card.edit")}…</span>
                          )}
                        </div>
                      )
                    ) : node.type === "file" ? (
                      <div className="flex size-full flex-col p-3">
                        <span className="flex items-center gap-1.5 font-semibold">
                          <Icon
                            icon={Note01Icon}
                            size={14}
                            className="shrink-0 text-muted-foreground"
                          />
                          <span className="truncate">{noteTitleOf(node.file ?? "")}</span>
                        </span>
                        {noteTarget?.kind === "note" ? (
                          <p className="mt-1 line-clamp-[8] text-xs whitespace-pre-line text-muted-foreground">
                            {noteTarget.note.body.replace(/^---[\s\S]*?---\s*/, "").slice(0, 600)}
                          </p>
                        ) : (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {t("canvas.card.missingNote")}
                          </p>
                        )}
                      </div>
                    ) : node.type === "link" ? (
                      <a
                        href={node.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="flex size-full flex-col justify-center gap-1 p-3 outline-none hover:bg-muted/50"
                      >
                        <span className="flex items-center gap-1.5 font-semibold">
                          <Icon
                            icon={Link04Icon}
                            size={14}
                            className="shrink-0 text-muted-foreground"
                          />
                          <span className="truncate">
                            {(() => {
                              try {
                                return new URL(node.url ?? "").hostname;
                              } catch {
                                return node.url;
                              }
                            })()}
                          </span>
                        </span>
                        <span className="truncate text-xs text-muted-foreground" dir="ltr">
                          {node.url}
                        </span>
                      </a>
                    ) : null}
                  </div>

                  {/* Dots to drag an arrow from, and the corner to resize. */}
                  {node.type !== "group"
                    ? sides.map((at) => (
                        <span
                          key={at}
                          data-handle
                          onPointerDown={(event) => {
                            event.stopPropagation();
                            setGesture({
                              kind: "connect",
                              from: node.id,
                              side: at,
                              point: toWorld(event.clientX, event.clientY),
                            });
                          }}
                          className={cn(
                            "absolute z-10 size-3.5 cursor-crosshair rounded-full border-2 border-background bg-primary opacity-0 transition-opacity group-hover:opacity-100",
                            selected && "opacity-100",
                            at === "top" && "start-1/2 -top-2 -translate-x-1/2",
                            at === "bottom" && "start-1/2 -bottom-2 -translate-x-1/2",
                            at === "left" && "-start-2 top-1/2 -translate-y-1/2",
                            at === "right" && "-end-2 top-1/2 -translate-y-1/2",
                          )}
                        />
                      ))
                    : null}
                  <span
                    data-handle
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      setGesture({
                        kind: "resize",
                        id: node.id,
                        startX: event.clientX,
                        startY: event.clientY,
                        width: node.width,
                        height: node.height,
                      });
                    }}
                    className="absolute -end-1 -bottom-1 size-4 cursor-nwse-resize opacity-0 group-hover:opacity-100"
                  />
                </div>
              );
            })}
          </div>
        </div>
      </Canvas>

      {nodes.length === 0 ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <p className="text-lg font-medium text-muted-foreground">{t("canvas.empty.title")}</p>
            <p className="mt-1 text-sm text-muted-foreground/80">{t("canvas.empty.body")}</p>
          </div>
        </div>
      ) : null}

      {/* What to add. */}
      <div className="pointer-events-none absolute inset-x-3 top-3 flex justify-center">
        <div className={floating}>
          <button
            type="button"
            className={toolButton}
            aria-label={t("canvas.add.text")}
            title={t("canvas.add.text")}
            onClick={() => {
              const created = addNode({ type: "text", text: "", width: 260, height: 120 });
              setEditing(created.id);
            }}
          >
            <Icon icon={TextIcon} size={18} />
          </button>
          <Menu>
            <Menu.Trigger
              className={toolButton}
              aria-label={t("canvas.add.note")}
              title={t("canvas.add.note")}
            >
              <Icon icon={Note01Icon} size={18} />
            </Menu.Trigger>
            <Menu.Content className="max-h-80">
              <Menu.Group>
                <Menu.GroupLabel>{t("canvas.add.choose")}</Menu.GroupLabel>
                {vaultNotes.length === 0 ? (
                  <Menu.Item disabled>{t("canvas.add.noNotes")}</Menu.Item>
                ) : (
                  vaultNotes.map((note) => (
                    <Menu.Item
                      key={note.id}
                      onClick={() =>
                        addNode({ type: "file", file: `${note.title}.md`, width: 280, height: 180 })
                      }
                    >
                      <Icon icon={Note01Icon} />
                      {note.title}
                    </Menu.Item>
                  ))
                )}
              </Menu.Group>
            </Menu.Content>
          </Menu>
          <button
            type="button"
            className={toolButton}
            aria-label={t("canvas.add.link")}
            title={t("canvas.add.link")}
            onClick={() => setLinkOpen(true)}
          >
            <Icon icon={Link04Icon} size={18} />
          </button>
        </div>
      </div>

      {chrome ? (
        <div className="pointer-events-none absolute start-3 top-3">
          <OutputInfo chrome={chrome} />
        </div>
      ) : null}

      {/* The selected card or arrow. */}
      {selectedNode ? (
        <div className="pointer-events-none absolute inset-x-3 bottom-3 flex justify-center">
          <div className={floating}>
            {selectedNode.type === "text" ? (
              <button
                type="button"
                className={toolButton}
                aria-label={t("canvas.card.edit")}
                title={t("canvas.card.edit")}
                onClick={() => setEditing(selectedNode.id)}
              >
                <Icon icon={PencilEdit01Icon} size={16} />
              </button>
            ) : null}
            <div
              role="radiogroup"
              aria-label={t("canvas.card.color")}
              className="flex items-center gap-1 px-1"
            >
              <button
                type="button"
                role="radio"
                aria-checked={!selectedNode.color}
                aria-label={t("canvas.card.noColor")}
                onClick={() => patchNode(selectedNode.id, { color: undefined })}
                className={cn(
                  "size-5 cursor-pointer rounded-full border-2 border-border bg-card",
                  !selectedNode.color &&
                    "ring-2 ring-foreground ring-offset-1 ring-offset-background",
                )}
              />
              {Object.entries(canvasColors).map(([key, value]) => (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={selectedNode.color === key}
                  aria-label={t(`canvas.colors.${key}` as "canvas.colors.1")}
                  onClick={() => patchNode(selectedNode.id, { color: key })}
                  className={cn(
                    "size-5 cursor-pointer rounded-full",
                    value.swatch,
                    selectedNode.color === key &&
                      "ring-2 ring-foreground ring-offset-1 ring-offset-background",
                  )}
                />
              ))}
            </div>
            <button
              type="button"
              className={cn(toolButton, "hover:text-destructive")}
              aria-label={t("canvas.card.delete")}
              title={t("canvas.card.delete")}
              onClick={removeSelection}
            >
              <Icon icon={Delete02Icon} size={16} />
            </button>
          </div>
        </div>
      ) : selectedEdge ? (
        <div className="pointer-events-none absolute inset-x-3 bottom-3 flex justify-center">
          <div className={floating}>
            <Input
              size="sm"
              aria-label={t("canvas.edge.label")}
              placeholder={t("canvas.edge.label")}
              defaultValue={selectedEdge.label ?? ""}
              key={selectedEdge.id}
              onChange={(event) =>
                patchEdge(selectedEdge.id, { label: event.target.value || undefined })
              }
              className="w-44"
            />
            <button
              type="button"
              className={cn(toolButton, "hover:text-destructive")}
              aria-label={t("canvas.edge.delete")}
              title={t("canvas.edge.delete")}
              onClick={removeSelection}
            >
              <Icon icon={Delete02Icon} size={16} />
            </button>
          </div>
        </div>
      ) : nodes.length > 0 ? (
        <p className="pointer-events-none absolute inset-x-3 bottom-4 text-center text-xs text-muted-foreground">
          {t("canvas.hint")}
        </p>
      ) : null}

      {/* Zoom, and the board's menu. */}
      <div className="pointer-events-none absolute end-3 bottom-3 flex items-center gap-2">
        <div className={floating}>
          <button
            type="button"
            className={toolButton}
            aria-label={t("canvas.zoomOut")}
            title={t("canvas.zoomOut")}
            onClick={() => zoomAt(1 / 1.2)}
          >
            <Icon icon={MinusSignIcon} size={16} />
          </button>
          <button
            type="button"
            className={toolButton}
            aria-label={t("canvas.fit")}
            title={t("canvas.fit")}
            onClick={fitAll}
          >
            <Icon icon={CenterFocusIcon} size={16} />
          </button>
          <button
            type="button"
            className={toolButton}
            aria-label={t("canvas.zoomIn")}
            title={t("canvas.zoomIn")}
            onClick={() => zoomAt(1.2)}
          >
            <Icon icon={Add01Icon} size={16} />
          </button>
        </div>
        {chrome ? (
          <Menu>
            <Menu.Trigger
              render={
                <Button
                  variant="outline"
                  size="icon"
                  shape="pill"
                  aria-label={t("canvas.menu")}
                  className="pointer-events-auto bg-background/95 shadow-sm backdrop-blur"
                />
              }
            >
              <Icon icon={MoreHorizontalIcon} size={18} />
            </Menu.Trigger>
            <Menu.Content side="top" align="end" className="min-w-52">
              {chrome.downloads.map((download) => (
                <Menu.Item key={download.format} onClick={download.onSelect} disabled={chrome.busy}>
                  <Icon icon={Download04Icon} />
                  {download.label}
                </Menu.Item>
              ))}
              <Menu.Separator />
              <Menu.Item onClick={chrome.onRename}>
                <Icon icon={PencilEdit01Icon} />
                {t("canvas.rename")}
              </Menu.Item>
              <Menu.Item variant="destructive" onClick={chrome.onDelete}>
                <Icon icon={Delete02Icon} />
                {t("canvas.delete")}
              </Menu.Item>
            </Menu.Content>
          </Menu>
        ) : null}
      </div>

      <LinkDialog
        open={linkOpen}
        onOpenChange={setLinkOpen}
        onAdd={(url) => addNode({ type: "link", url, width: 300, height: 90 })}
      />
    </div>
  );
}

function LinkDialog({
  open,
  onOpenChange,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (url: string) => void;
}) {
  const { t } = useTranslation("studio");
  const { t: tCommon } = useTranslation();
  const id = useId();
  const [url, setUrl] = useState("");
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setUrl("");
        onOpenChange(next);
      }}
    >
      <Dialog.Content size="sm" closeLabel={tCommon("actions.close")}>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const value = /^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`;
            onAdd(value);
            onOpenChange(false);
          }}
        >
          <Dialog.Header title={t("canvas.add.link")} />
          <Dialog.Body>
            <Field label={t("canvas.add.url")} htmlFor={id}>
              <Input
                id={id}
                type="url"
                inputMode="url"
                dir="ltr"
                autoFocus
                required
                placeholder="https://"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
              />
            </Field>
          </Dialog.Body>
          <Dialog.Footer>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              {tCommon("actions.cancel")}
            </Button>
            <Button type="submit" disabled={!url.trim()}>
              {t("canvas.add.addLink")}
            </Button>
          </Dialog.Footer>
        </form>
      </Dialog.Content>
    </Dialog>
  );
}
