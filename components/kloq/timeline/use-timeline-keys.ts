"use client";

/**
 * use-timeline-keys — the keyboard on a timeline. ←/→ walk a lane, ↑/↓ change
 * lane; ⌥ moves, ⌥⇧ resizes the end, ⌥⇧⌘ the start; ⌘C/X/V; 1–5 recolor.
 * The cursor is the focused bar when focus sits on one outside the selection,
 * otherwise the selection lead. Runs in the capture phase and prevents default,
 * so the shell's day-column arrows stand down.
 */

import { type RefObject, useEffect } from "react";
import { isTypingEvent, watchKeyboardScope } from "../lib/keyboard-scope";
import { actionForEvent, type Keymap, resolveKeymap } from "../lib/keymap";
import type { Lane } from "../lib/lane";
import type { PlacedOccurrence } from "../lib/projection";
import type { TimelineWindow } from "../lib/timeline-window";
import { useLatest } from "../lib/use-latest";

const LAYERED =
  '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"], [data-popup]';

export type ClipboardAction = "copy" | "cut" | "paste";

/** One keyboard step: `slots` along time (a day for an all-day bar), `lanes` across rows. */
export interface MoveStep {
  slots?: number;
  lanes?: number;
}

export interface TimelineKeysOpts {
  canvasRef: RefObject<HTMLElement | null>;
  events: readonly PlacedOccurrence[];
  lanes: readonly Lane[];
  window: TimelineWindow;
  selectedId: string | null;
  /** every selected id, lead included; omit for single selection */
  selectedIds?: readonly string[];
  /** `extend` grows the selection instead of replacing it */
  select: (id: string, extend: boolean) => void;
  /** make this bar the whole selection now, so a handler later in the same event acts on it */
  adopt?: (id: string) => void;
  /** returns false when the move was refused */
  move: (events: readonly PlacedOccurrence[], step: MoveStep) => boolean;
  /** one edge by one slot; `count` is how many bars are selected */
  resize: (event: PlacedOccurrence, edge: "start" | "end", slots: number, count: number) => boolean;
  /** create a default booking on the cursor's lane, or the first when there is none */
  create: (cursor: PlacedOccurrence | null) => void;
  /** 1–5: paint these bars with the nth event color */
  recolor: (events: readonly PlacedOccurrence[], index: number) => void;
  /** `false` passes the key through; `"refused"` handled it without changing anything */
  clipboard?: (
    action: ClipboardAction,
    targets: readonly PlacedOccurrence[],
    cursor: PlacedOccurrence | null,
  ) => boolean | "refused";
  keymap?: Keymap;
}

/** Focus a bar once it has rendered; the surface when there is nothing to land on. */
const pendingFocus = new WeakMap<HTMLElement, { outer: number; inner?: number }>();

export function focusBar(canvas: HTMLElement | null, id: string | null): void {
  if (!canvas) return;
  const previous = pendingFocus.get(canvas);
  if (previous) {
    cancelAnimationFrame(previous.outer);
    if (previous.inner !== undefined) cancelAnimationFrame(previous.inner);
  }
  const pending = { outer: 0, inner: undefined as number | undefined };
  pendingFocus.set(canvas, pending);
  pending.outer = requestAnimationFrame(() => {
    pending.inner = requestAnimationFrame(() => {
      if (pendingFocus.get(canvas) !== pending) return;
      pendingFocus.delete(canvas);
      const node = id
        ? canvas.querySelector<HTMLElement>(`[data-cal-event="${CSS.escape(id)}"]`)
        : null;
      if (node) {
        node.focus({ preventScroll: true });
        node.scrollIntoView({ block: "nearest", inline: "nearest" });
        return;
      }
      (canvas.closest<HTMLElement>('[tabindex="-1"]') ?? canvas).focus({ preventScroll: true });
    });
  });
}

export function useTimelineKeys(opts: TimelineKeysOpts) {
  const o = useLatest(opts);

  useEffect(() => {
    const root = () =>
      o.current.canvasRef.current?.closest<HTMLElement>("[data-kloq-root]") ??
      o.current.canvasRef.current?.closest<HTMLElement>('[data-slot="timeline"]') ??
      null;
    const scope = watchKeyboardScope(root);

    const nodeOf = (id: string) =>
      o.current.canvasRef.current?.querySelector<HTMLElement>(
        `[data-cal-event="${CSS.escape(id)}"]`,
      ) ?? null;

    const focus = (id: string | null) => focusBar(o.current.canvasRef.current, id);

    /** bars that are drawn — a booking folded into "+N more" has no node to land on */
    const drawn = () => o.current.events.filter((e) => nodeOf(e.id) !== null);

    const walk = (cur: PlacedOccurrence, key: string): PlacedOccurrence | null => {
      const all = drawn();
      if (key === "ArrowLeft" || key === "ArrowRight") {
        const lane = all
          .filter((e) => e.laneIndex === cur.laneIndex)
          .sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
        const i = lane.findIndex((e) => e.id === cur.id);
        return lane[key === "ArrowRight" ? i + 1 : i - 1] ?? null;
      }
      const dir = key === "ArrowDown" ? 1 : -1;
      for (
        let lane = cur.laneIndex + dir;
        lane >= 0 && lane < o.current.lanes.length;
        lane += dir
      ) {
        const row = all.filter((e) => e.laneIndex === lane);
        if (!row.length) continue;
        return row.reduce((best, e) =>
          Math.abs(e.startMin - cur.startMin) < Math.abs(best.startMin - cur.startMin) ? e : best,
        );
      }
      return null;
    };

    /** where focus goes once `gone` leave: the next bar on the lane, else the nearest anywhere */
    const neighbour = (cur: PlacedOccurrence, gone: ReadonlySet<string>): string | null => {
      const rest = drawn().filter((e) => !gone.has(e.id));
      const lane = rest
        .filter((e) => e.laneIndex === cur.laneIndex)
        .sort((a, b) => a.startMin - b.startMin);
      const onLane = lane.find((e) => e.startMin >= cur.startMin) ?? lane.at(-1);
      if (onLane) return onLane.id;
      const near = (e: PlacedOccurrence) =>
        Math.abs(e.laneIndex - cur.laneIndex) * 1e6 + Math.abs(e.startMin - cur.startMin);
      return rest.sort((a, b) => near(a) - near(b))[0]?.id ?? null;
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || !o.current.canvasRef.current) return;
      if (!scope.owns() || isTypingEvent(e)) return;
      if ((e.target as Element | null)?.closest?.(LAYERED)) return;

      const { events, selectedId, lanes } = o.current;
      const ids = o.current.selectedIds ?? (selectedId ? [selectedId] : []);
      const active = document.activeElement as HTMLElement | null;
      const focusedBar = active?.closest<HTMLElement>("[data-cal-event]") ?? null;
      const focusedId =
        focusedBar && o.current.canvasRef.current.contains(focusedBar)
          ? (focusedBar.dataset.calEvent ?? null)
          : null;
      // focus on a bar outside the selection is where the user is: commands act there
      const detached = focusedId !== null && !ids.includes(focusedId);
      const cursorId = detached ? focusedId : (selectedId ?? focusedId);
      const cursor = cursorId ? (events.find((ev) => ev.id === cursorId) ?? null) : null;
      const targets =
        cursor && !detached && ids.length > 1
          ? events.filter((ev) => ids.includes(ev.id))
          : cursor
            ? [cursor]
            : [];
      const mod = e.metaKey || e.ctrlKey;

      if (!e.key.startsWith("Arrow")) {
        if (e.altKey) return;
        if (mod) {
          const key = e.key.toLowerCase();
          if (key === "c" || key === "x" || key === "v") {
            if (!o.current.clipboard || e.shiftKey) return;
            // with nothing to copy the browser keeps its own ⌘C
            if (key !== "v" && targets.length === 0) return;
            const action = key === "c" ? "copy" : key === "x" ? "cut" : "paste";
            const next =
              action === "cut" && cursor
                ? neighbour(cursor, new Set(targets.map((t) => t.id)))
                : null;
            const done = o.current.clipboard(action, targets, cursor);
            if (done === false) return;
            e.preventDefault();
            if (action === "cut" && done === true) focus(next);
            return;
          }
          // ⌘D is the shell's: hand it the bar under focus
          if (key === "d" && detached && cursor) o.current.adopt?.(cursor.id);
          return;
        }
        if ((e.key === "Delete" || e.key === "Backspace") && detached && cursor) {
          o.current.adopt?.(cursor.id);
          return;
        }
        if (cursor && /^[1-5]$/.test(e.key)) {
          e.preventDefault();
          if (detached) o.current.select(cursor.id, false);
          o.current.recolor(targets, Number(e.key) - 1);
          return;
        }
        if (actionForEvent(e, resolveKeymap(o.current.keymap)) !== "create") return;
        e.preventDefault();
        o.current.create(cursor);
        return;
      }

      if (mod && !e.altKey) return;

      if (!cursor) {
        if (e.altKey || e.key === "ArrowLeft" || e.key === "ArrowRight") return;
        const first = drawn().sort(
          (a, b) => a.laneIndex - b.laneIndex || a.startMin - b.startMin,
        )[0];
        if (!first) return;
        e.preventDefault();
        o.current.select(first.id, false);
        focus(first.id);
        return;
      }

      e.preventDefault();
      const unselected = detached || ids.length === 0;

      if (!e.altKey) {
        const next = walk(cursor, e.key);
        if (!next) return;
        // a range grown from a bar reached by Tab starts at that bar
        if (e.shiftKey && unselected) o.current.select(cursor.id, false);
        o.current.select(next.id, e.shiftKey);
        focus(next.id);
        return;
      }

      if (unselected) o.current.select(cursor.id, false);
      const horizontal = e.key === "ArrowLeft" || e.key === "ArrowRight";
      const sign = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1;

      if (e.shiftKey) {
        if (!horizontal) return;
        if (o.current.resize(cursor, mod ? "start" : "end", sign, targets.length)) focus(cursor.id);
        return;
      }

      const step: MoveStep = horizontal ? { slots: sign } : { lanes: sign };
      if (lanes.length && o.current.move(targets, step)) focus(cursor.id);
    };

    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      scope.dispose();
    };
  }, [o]);
}
