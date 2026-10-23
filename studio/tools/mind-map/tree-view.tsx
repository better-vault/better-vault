"use client";

import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  ArrowShrink02Icon,
  ArrowExpand01Icon,
  FitToScreenIcon,
  MinusSignIcon,
  PlusSignIcon,
} from "@hugeicons/core-free-icons";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useChatSession } from "@/components/chat/chat-provider";
import { Icon } from "@/components/icon";
import { Canvas } from "@/components/panelui/canvas";
import { useWorkspace } from "@/components/workspace/workspace-context";
import { cn } from "@/lib/utils";
import { useTextMeasurer } from "./measure";
import { usePanZoom } from "./pan-zoom";
import { branchIds, layoutTree, NODE_HEIGHT, pathTo, TOGGLE, type MindNode } from "./tree";

/** Each depth in its own colour from Panel's chart ramp, as NotebookLM tints its levels. */
const DEPTH_STYLES = [
  "bg-chart-5/20 ring-chart-5/40 font-semibold",
  "bg-chart-2/15 ring-chart-2/35",
  "bg-chart-3/15 ring-chart-3/35",
  "bg-chart-4/15 ring-chart-4/35",
];

const MOTION = "duration-300 ease-[cubic-bezier(0.3,0.7,0.1,1)] motion-reduce:transition-none";

/**
 * The mind map as NotebookLM shows it: a tree growing to the right, opened a
 * level at a time with the round toggles. A click on a topic asks about it
 * in the chat.
 */
export function MindMapTree({ root }: { root: MindNode }) {
  const { t } = useTranslation("studio");
  const { setTab } = useWorkspace();
  const chat = useChatSession();
  const measure = useTextMeasurer();
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(["0"]));
  const layout = useMemo(() => layoutTree(root, expanded, measure), [root, expanded, measure]);
  const { frame, view, setView, zoomAt, fit, handlers } = usePanZoom();
  const allIds = useMemo(() => branchIds(root), [root]);
  const allOpen = expanded.size >= allIds.size;

  // A toggled node stays where it was on screen while the tree moves around
  // it; then, as in NotebookLM, the view slides just enough to show the
  // branch it opened, without losing the node itself.
  const anchor = useRef<{ id: string; x: number; y: number } | null>(null);
  useLayoutEffect(() => {
    const held = anchor.current;
    if (!held) return;
    anchor.current = null;
    const placed = layout.nodes.find((entry) => entry.node.id === held.id);
    const box = frame.current?.getBoundingClientRect();
    if (!placed || !box) return;
    const children = layout.nodes.filter((entry) => entry.node.id.startsWith(`${held.id}.`) && entry.depth === placed.depth + 1);
    const margin = 32;
    setView((current) => {
      let x = current.x - (placed.x - held.x) * current.zoom;
      let y = current.y - (placed.y - held.y) * current.zoom;
      if (children.length > 0) {
        const z = current.zoom;
        const right = Math.max(...children.map((child) => child.x + child.width + TOGGLE + 8)) * z + x;
        const nodeLeft = placed.x * z + x;
        if (right > box.width - margin) x -= Math.min(right - (box.width - margin), Math.max(0, nodeLeft - margin));
        const top = Math.min(...children.map((child) => child.y)) * z + y;
        const bottom = Math.max(...children.map((child) => child.y + NODE_HEIGHT)) * z + y;
        if (bottom > box.height - margin) y -= Math.min(bottom - (box.height - margin), Math.max(0, top - margin));
        else if (top < margin) y += Math.min(margin - top, Math.max(0, box.height - margin - bottom));
      }
      return { ...current, x, y };
    });
  }, [layout, setView, frame]);

  // Fits the map when it first appears and when the frame changes size.
  const size = useRef({ width: layout.width, height: layout.height });
  useLayoutEffect(() => {
    size.current = { width: layout.width, height: layout.height };
  }, [layout]);
  useEffect(() => {
    fit(size.current.width, size.current.height, 1);
    const element = frame.current;
    if (!element) return;
    const observer = new ResizeObserver(() => fit(size.current.width, size.current.height, 1));
    observer.observe(element);
    return () => observer.disconnect();
  }, [fit, frame]);

  function toggle(id: string) {
    const placed = layout.nodes.find((entry) => entry.node.id === id);
    if (placed) anchor.current = { id, x: placed.x, y: placed.y };
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        // Closing a branch closes everything under it too.
        for (const open of current) if (open === id || open.startsWith(`${id}.`)) next.delete(open);
      } else next.add(id);
      return next;
    });
  }

  function ask(id: string) {
    const path = pathTo(root, id);
    const topic = path.at(-1) ?? root.label;
    const question =
      path.length > 1
        ? t("mind-map.viewer.question", { topic, parents: path.slice(0, -1).join(" › ") })
        : t("mind-map.viewer.questionRoot", { topic });
    setTab("chat");
    chat.send(question).catch((error: unknown) => toast.error(error instanceof Error ? error.message : String(error)));
  }

  const control =
    "flex size-9 cursor-pointer items-center justify-center text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset";

  return (
    <Canvas viewport={view} className="min-h-[460px] flex-1 rounded-3xl ring-1 ring-border">
      <Canvas.Pattern variant="dots" fade="edges" />
      <Canvas.Content>
        <div ref={frame} className="absolute inset-0 cursor-grab touch-none overflow-hidden active:cursor-grabbing" {...handlers}>
          <div
            className="absolute left-0 top-0 origin-top-left"
            style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`, width: layout.width, height: layout.height }}
          >
            <svg aria-hidden className="absolute left-0 top-0 overflow-visible" width={layout.width} height={layout.height}>
              {layout.edges.map((edge) => (
                <path
                  key={edge.id}
                  className={cn("fill-none stroke-chart-5/55 [stroke-width:1.6] transition-[d]", MOTION)}
                  style={{ d: `path("${edge.d}")` } as CSSProperties}
                />
              ))}
            </svg>
            {layout.nodes.map((placed) => {
              const hasChildren = placed.node.children.length > 0;
              return (
                <div
                  key={placed.node.id}
                  className={cn("absolute left-0 top-0 flex items-center gap-2 transition-transform animate-in fade-in-0", MOTION)}
                  style={{ transform: `translate(${placed.x}px, ${placed.y}px)` }}
                >
                  <button
                    type="button"
                    title={t("mind-map.viewer.ask", { label: placed.node.label })}
                    onClick={() => ask(placed.node.id)}
                    className={cn(
                      "cursor-pointer truncate rounded-xl px-4 text-start text-[15px] font-medium text-foreground ring-1 outline-none transition-[filter,box-shadow]",
                      "hover:brightness-110 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring dark:hover:brightness-125",
                      DEPTH_STYLES[placed.depth % DEPTH_STYLES.length],
                    )}
                    style={{ width: placed.width, height: NODE_HEIGHT }}
                  >
                    {placed.node.label}
                  </button>
                  {hasChildren ? (
                    <button
                      type="button"
                      aria-expanded={placed.expanded}
                      aria-label={
                        placed.expanded
                          ? t("mind-map.viewer.collapse", { label: placed.node.label })
                          : t("mind-map.viewer.expand", { label: placed.node.label })
                      }
                      onClick={() => toggle(placed.node.id)}
                      className="flex shrink-0 cursor-pointer items-center justify-center rounded-full bg-muted text-foreground ring-1 ring-border outline-none transition-colors hover:bg-foreground/15 focus-visible:ring-2 focus-visible:ring-ring"
                      style={{ width: TOGGLE, height: TOGGLE }}
                    >
                      <Icon icon={placed.expanded ? ArrowLeft01Icon : ArrowRight01Icon} size={13} strokeWidth={2.4} />
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        <p className="pointer-events-none absolute bottom-4 left-4 text-xs text-muted-foreground">{t("mind-map.viewer.hint")}</p>

        <div className="absolute bottom-4 right-4 flex flex-col gap-2">
          <div className="overflow-hidden rounded-full bg-popover shadow-sm ring-1 ring-border">
            <button
              type="button"
              className={control}
              aria-label={allOpen ? t("mind-map.viewer.collapseAll") : t("mind-map.viewer.expandAll")}
              title={allOpen ? t("mind-map.viewer.collapseAll") : t("mind-map.viewer.expandAll")}
              onClick={() => setExpanded(allOpen ? new Set(["0"]) : new Set(allIds))}
            >
              <Icon icon={allOpen ? ArrowShrink02Icon : ArrowExpand01Icon} size={16} />
            </button>
          </div>
          <div className="flex flex-col overflow-hidden rounded-full bg-popover shadow-sm ring-1 ring-border">
            <button type="button" className={control} aria-label={t("mind-map.viewer.zoomIn")} title={t("mind-map.viewer.zoomIn")} onClick={() => zoomAt(1.25)}>
              <Icon icon={PlusSignIcon} size={16} />
            </button>
            <button type="button" className={control} aria-label={t("mind-map.viewer.zoomOut")} title={t("mind-map.viewer.zoomOut")} onClick={() => zoomAt(1 / 1.25)}>
              <Icon icon={MinusSignIcon} size={16} />
            </button>
            <button type="button" className={control} aria-label={t("mind-map.viewer.fit")} title={t("mind-map.viewer.fit")} onClick={() => fit(layout.width, layout.height, 1)}>
              <Icon icon={FitToScreenIcon} size={16} />
            </button>
          </div>
        </div>
      </Canvas.Content>
    </Canvas>
  );
}
