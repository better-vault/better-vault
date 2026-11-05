"use client";

/**
 * use-calendar-keys — the keyboard layer. Fires only when the calendar owns the
 * keyboard (lib/keyboard-scope); ⌘K/⌘Z can go global via `globalShortcuts`.
 */

import type { RefObject } from "react";
import { useEffect } from "react";
import { flushSync } from "react-dom";
import type { EventColor, KloqView, PlacedEvent, ViewDescriptor } from "../lib/calendar-types";
import { MINUTES_PER_DAY } from "../lib/date-math";
import { resetZoom, zoomBy } from "../lib/density";
import { isTypingEvent, watchKeyboardScope } from "../lib/keyboard-scope";
import { actionForEvent, type KeyActionId, type Keymap, resolveKeymap } from "../lib/keymap";
import { compareForDay } from "../lib/month-grid";
import type { NavigationKeys } from "../lib/navigation";
import { nodeFor } from "../lib/recurrence";
import { KEYBOARD_SPRING, KEYBOARD_SPRING_MS, ms, prefersReducedMotion } from "../lib/springs";
import { useLatest } from "../lib/use-latest";
import { EVENT_COLORS } from "./event-block";
import { useKloqSettings } from "./settings-context";
import type { KloqSelectionHandle } from "./use-selection";

const COLOR_ORDER = Object.keys(EVENT_COLORS) as EventColor[];

/** Column-space patch; `updateEvent`'s implementer converts to store space. */
export type PlacedEventPatch = Partial<
  Pick<PlacedEvent, "dayIndex" | "endDayIndex" | "startMin" | "endMin" | "color">
>;

interface CalendarKeysOpts {
  rootRef: RefObject<HTMLElement | null>;
  /** Let ⌘K / ⌘Z / ⇧⌘Z fire without focus. Off by default — embedded calendars must not steal undo. */
  globalShortcuts?: boolean;
  projected: PlacedEvent[];
  view: ViewDescriptor;
  selectedId: string | null;
  registry: Map<string, HTMLElement>;
  /** never opens the panel by itself */
  select: (id: string) => void;
  panelOpen: boolean;
  openPanel: (id: string) => void;
  clearSelection: () => void;
  /** partial patch — `{ endMin }` alone must keep the existing start day */
  updateEvent: (id: string, patch: PlacedEventPatch) => void;
  quickCreate: () => void;
  undo: () => void;
  redo: () => void;
  openCommand: () => void;
  /** `false` leaves ⌘K entirely alone — no preventDefault, so the host's own palette keeps it */
  commandPalette?: boolean;
  openShortcuts: () => void;
  /** PageUp/PageDown always; ←/→ only when nothing is selected */
  stepRange: (dir: -1 | 1) => void;
  /** what ←/→ do under `navigationKeys: "day"` */
  stepDay?: (dir: -1 | 1) => void;
  /** show the gutter time markers for these edges, briefly */
  flashEdges?: (mins: number[]) => void;
  navigationKeys?: NavigationKeys;
  goToday: () => void;
  switchView: (view: KloqView) => void;
  /** omit and ⌘A/⌘C/⌘X/⌘V/⌘D and ⇧arrows don't fire; ⌥arrows / 1–5 act on `selectedId` alone */
  selection?: KloqSelectionHandle | null;
  keymap?: Keymap;
}

const VIEW_ACTIONS: Partial<Record<KeyActionId, KloqView>> = {
  "view-day": "day",
  "view-3days": 3,
  "view-week": "week",
  "view-month": "month",
  "view-agenda": "agenda",
  "view-year": "year",
};

function isTyping(e: KeyboardEvent): boolean {
  return isTypingEvent(e);
}

type ArrowKey = "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight";
/** A "+N more" trigger: a month day index, or the all-day lane. */
type MoreTarget = number | "lane";
type WalkView = Pick<ViewDescriptor, "kind" | "dayCount" | "todayIndex">;
export type WalkStep = { event: PlacedEvent } | { more: MoreTarget } | null;

const byStart = (a: PlacedEvent, b: PlacedEvent) =>
  a.dayIndex - b.dayIndex || a.startMin - b.startMin;
const byLane = (a: PlacedEvent, b: PlacedEvent) =>
  a.dayIndex - b.dayIndex || b.endDayIndex - a.endDayIndex || (a.id < b.id ? -1 : 1);
const byDay = (a: PlacedEvent, b: PlacedEvent) => a.dayIndex - b.dayIndex || compareForDay(a, b);

const isList = (view: WalkView) => view.kind === "month" || view.kind === "agenda";

/** Where a plain arrow starts when nothing is selected: today's first event, else the first drawn. */
export function firstEvent(
  events: readonly PlacedEvent[],
  view: WalkView,
  drawn: (e: PlacedEvent) => boolean = () => true,
): PlacedEvent | null {
  if (isList(view)) {
    const ordered = [...events].sort(byDay).filter(drawn);
    return ordered.find((e) => e.dayIndex === view.todayIndex) ?? ordered[0] ?? null;
  }
  const timed = events.filter((e) => !e.allDay).sort(byStart);
  return (
    timed.find((e) => e.dayIndex === view.todayIndex) ??
    timed[0] ??
    events.filter((e) => e.allDay && drawn(e)).sort(byLane)[0] ??
    null
  );
}

/**
 * One arrow press from `cur`, in the order the view draws events. Every event is reachable:
 * a time grid walks columns and climbs into the all-day lane, month and agenda walk day lists
 * and carry on into the next day. An event hidden behind "+N more" is never selected — the walk
 * stops on that trigger first, and a second press steps over what it hides.
 */
export function walkEvents(
  events: readonly PlacedEvent[],
  view: WalkView,
  cur: PlacedEvent,
  key: ArrowKey,
  drawn: (e: PlacedEvent) => boolean = () => true,
  onMore: MoreTarget | null = null,
): WalkStep {
  const dir = key === "ArrowDown" || key === "ArrowRight" ? 1 : -1;
  const vertical = key === "ArrowUp" || key === "ArrowDown";

  if (isList(view)) {
    const ordered = [...events].sort(byDay);
    const i = ordered.findIndex((e) => e.id === cur.id);
    if (!vertical) {
      for (let day = cur.dayIndex + dir; day >= 0 && day < view.dayCount; day += dir) {
        const first = ordered.find((e) => e.dayIndex === day && drawn(e));
        if (first) return { event: first };
      }
      return null;
    }
    const next = ordered[i + dir];
    if (!next) return null;
    if (drawn(next)) return { event: next };
    if (onMore !== next.dayIndex) return { more: next.dayIndex };
    for (let j = i + dir; ordered[j]; j += dir) if (drawn(ordered[j])) return { event: ordered[j] };
    return null;
  }

  const timed = events.filter((e) => !e.allDay).sort(byStart);
  const lane = events.filter((e) => e.allDay).sort(byLane);

  if (cur.allDay) {
    if (vertical) {
      if (dir < 0) return null;
      for (let day = cur.dayIndex; day <= cur.endDayIndex; day++) {
        const first = timed.find((e) => e.dayIndex === day);
        if (first) return { event: first };
      }
      return null;
    }
    const i = lane.findIndex((e) => e.id === cur.id);
    const next = lane[i + dir];
    if (!next) return null;
    if (drawn(next)) return { event: next };
    if (onMore !== "lane") return { more: "lane" };
    for (let j = i + dir; lane[j]; j += dir) if (drawn(lane[j])) return { event: lane[j] };
    return null;
  }

  if (vertical) {
    const col = timed.filter((e) => e.dayIndex === cur.dayIndex);
    const next = col[col.findIndex((e) => e.id === cur.id) + dir];
    if (next) return { event: next };
    if (dir > 0) return null;
    // off the top of a column: into the all-day lane above it
    const over = lane.filter((e) => e.dayIndex <= cur.dayIndex && cur.dayIndex <= e.endDayIndex);
    const chip = over.filter(drawn).at(-1);
    if (chip) return { event: chip };
    return over.length ? { more: "lane" } : null;
  }
  for (let day = cur.dayIndex + dir; day >= 0 && day < view.dayCount; day += dir) {
    const col = timed.filter((e) => e.dayIndex === day);
    if (!col.length) continue;
    return {
      event: col.reduce((best, e) =>
        Math.abs(e.startMin - cur.startMin) < Math.abs(best.startMin - cur.startMin) ? e : best,
      ),
    };
  }
  return null;
}

export function useCalendarKeys(opts: CalendarKeysOpts) {
  const g = useKloqSettings();
  const o = useLatest({ ...opts, g });

  useEffect(() => {
    const scope = watchKeyboardScope(() => o.current.rootRef.current);

    const applyAnimated = (id: string, patch: PlacedEventPatch) => {
      const { registry, updateEvent } = o.current;
      const node = nodeFor(registry, id);
      const old = node?.getBoundingClientRect();
      flushSync(() => updateEvent(id, patch));
      const after = nodeFor(registry, id);
      if (!old || !after || prefersReducedMotion()) return;
      const now = after.getBoundingClientRect();
      const dx = old.left - now.left;
      const dy = old.top - now.top;
      const sy = now.height > 0 ? old.height / now.height : 1;
      const sx = now.width > 0 ? old.width / now.width : 1;
      if (
        Math.abs(dx) < 1 &&
        Math.abs(dy) < 1 &&
        Math.abs(sy - 1) < 0.01 &&
        Math.abs(sx - 1) < 0.01
      )
        return;
      const tilt = Math.max(-2, Math.min(2, -dx / 60));
      after.animate(
        [
          {
            transform: `translate(${dx}px, ${dy}px) rotate(${tilt}deg) scale(${sx}, ${sy})`,
            transformOrigin: "top left",
          },
          { transform: "none", transformOrigin: "top left" },
        ],
        { duration: KEYBOARD_SPRING_MS, easing: KEYBOARD_SPRING },
      );
    };

    const reveal = (id: string) => {
      o.current.registry.get(id)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    };

    // an event the view drew: hidden ones sit behind a "+N more" and have no node
    const drawn = (ev: PlacedEvent) =>
      o.current.registry.size === 0 || nodeFor(o.current.registry, ev.id) !== undefined;

    /** The overflow trigger that has focus: a month day index, the all-day lane, or none. */
    const focusedMore = (): MoreTarget | null => {
      const el = document.activeElement as HTMLElement | null;
      if (!el?.matches?.("[data-cal-more]")) return null;
      const day = el.closest<HTMLElement>("[data-month-day]")?.dataset.monthDay;
      return day === undefined ? "lane" : Number(day);
    };

    const focusMore = (target: MoreTarget) => {
      o.current.rootRef.current
        ?.querySelector<HTMLElement>(
          target === "lane"
            ? "[data-cal-lane] [data-cal-more]"
            : `[data-month-day="${target}"] [data-cal-more]`,
        )
        ?.focus();
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      const { selectedId, projected, view, g } = o.current;
      const owned = scope.owns();
      const global = o.current.globalShortcuts ?? false;

      // ⌘K works even while typing
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        if (o.current.commandPalette === false) return;
        if (!owned && !global) return;
        e.preventDefault();
        o.current.openCommand();
        return;
      }
      if (isTyping(e)) return;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        if (!owned && !global) return;
        e.preventDefault();
        if (e.shiftKey) o.current.redo();
        else o.current.undo();
        return;
      }
      if (
        (e.metaKey || e.ctrlKey) &&
        e.shiftKey &&
        (e.key === "," || e.key === "." || e.key === "0")
      ) {
        if (!owned && !global) return;
        e.preventDefault();
        if (e.key === "0") resetZoom();
        else zoomBy(e.key === "." ? 1 : -1);
        return;
      }
      // everything below is never global: no preventDefault() on arrows for a page not looking at us
      if (!owned) return;

      // with an empty selection ⌘C falls through to the browser's own copy
      const sel = o.current.selection;
      if (sel && (e.metaKey || e.ctrlKey) && !e.altKey) {
        const key = e.key.toLowerCase();
        if (key === "a") {
          e.preventDefault();
          sel.selectAll();
          return;
        }
        if (key === "v") {
          e.preventDefault();
          sel.paste();
          return;
        }
        if (sel.count === 0) return;
        if (key === "c") {
          e.preventDefault();
          sel.copy();
          return;
        }
        if (key === "x") {
          e.preventDefault();
          sel.cut();
          return;
        }
        if (key === "d") {
          e.preventDefault();
          sel.duplicate();
          return;
        }
        return;
      }
      // ⌥⇧⌘↑↓ (start-edge resize) is the one ⌘ chord that belongs to the ⌥ layer below
      if ((e.metaKey || e.ctrlKey) && !e.altKey) return;

      if (sel && sel.count > 0 && (e.key === "Backspace" || e.key === "Delete")) {
        e.preventDefault();
        sel.remove();
        return;
      }

      const selected = selectedId ? (projected.find((ev) => ev.id === selectedId) ?? null) : null;

      // Escape clears only with the panel closed; inside a layered surface it is that surface's
      if (selected && !isTyping(e) && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const layered = (e.target as Element | null)?.closest?.(
          '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"], [data-popup]',
        );
        // Enter on a focused "+N more" opens that popover, not the selected event
        const onControl = (e.target as Element | null)?.closest?.("[data-cal-more]");
        if (e.key === "Enter" && !layered && !onControl) {
          e.preventDefault();
          o.current.openPanel(selected.id);
          return;
        }
        if (e.key === "Escape" && !layered && !o.current.panelOpen) {
          e.preventDefault();
          o.current.clearSelection();
          return;
        }
      }

      // before the keymap dispatch on purpose: with a selection, digits always recolor
      if (selected && /^[1-5]$/.test(e.key)) {
        e.preventDefault();
        const color = COLOR_ORDER[Number(e.key) - 1];
        if (sel && sel.count > 1) sel.recolor(color);
        else o.current.updateEvent(selected.id, { color });
        requestAnimationFrame(() => {
          document
            .querySelector<HTMLElement>(`[data-color-swatch="${color}"]`)
            ?.animate(
              [{ transform: "scale(1)" }, { transform: "scale(1.35)" }, { transform: "scale(1)" }],
              { duration: ms(220), easing: "ease-out" },
            );
        });
        return;
      }

      // resolved per keydown so a keymap prop change needs no listener re-wiring
      const mnemonic = actionForEvent(e, resolveKeymap(o.current.keymap));
      if (mnemonic) {
        e.preventDefault();
        const nextView = VIEW_ACTIONS[mnemonic];
        if (nextView) {
          o.current.switchView(nextView);
        } else if (mnemonic === "today") {
          o.current.goToday();
        } else if (mnemonic === "create") {
          o.current.quickCreate();
        } else if (mnemonic === "shortcuts") {
          o.current.openShortcuts();
        } else if (mnemonic === "prev-period" || mnemonic === "next-period") {
          // like bare ←/→ with nothing selected, but these fire even with a selection
          const dir = mnemonic === "next-period" ? 1 : -1;
          if (o.current.navigationKeys === "day" && o.current.stepDay) o.current.stepDay(dir);
          else o.current.stepRange(dir);
        }
        return;
      }

      if (e.key === "PageUp" || e.key === "PageDown") {
        e.preventDefault();
        o.current.stepRange(e.key === "PageUp" ? -1 : 1);
        return;
      }

      if (!e.key.startsWith("Arrow")) return;

      if (e.altKey && selected) {
        e.preventDefault();
        const step = g.snapMinutes;
        // bulk move only — no bulk resize: it would turn a 15-minute standup negative
        if (sel && sel.count > 1) {
          if (e.key === "ArrowLeft" || e.key === "ArrowRight")
            sel.nudge({ days: e.key === "ArrowRight" ? 1 : -1 });
          else if (!e.shiftKey) sel.nudge({ minutes: e.key === "ArrowDown" ? step : -step });
          return;
        }
        if (selected.allDay) {
          if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
            const delta = e.key === "ArrowRight" ? 1 : -1;
            const span = selected.endDayIndex - selected.dayIndex;
            const lo = Math.max(0, Math.min(view.dayCount - 1 - span, selected.dayIndex + delta));
            applyAnimated(selected.id, {
              dayIndex: lo,
              endDayIndex: lo + span,
            });
          }
          return;
        }
        const duration = selected.endMin - selected.startMin;
        // midnight is crossable on a full-day grid; a windowed grid has hard edges; a split has none
        const split = selected.segment.n > 1;
        const floorMin = split ? -Infinity : g.dayStartMin > 0 ? g.dayStartMin : -Infinity;
        const ceilMin = split ? Infinity : g.dayEndMin < MINUTES_PER_DAY ? g.dayEndMin : Infinity;
        // ⌥⇧⌘↑/↓ moves the start edge; ⌥⇧↑/↓ the end
        if (
          e.shiftKey &&
          (e.metaKey || e.ctrlKey) &&
          (e.key === "ArrowUp" || e.key === "ArrowDown")
        ) {
          const startMin = Math.min(
            selected.endMin - g.minEventMinutes,
            Math.max(floorMin, selected.startMin + (e.key === "ArrowDown" ? step : -step)),
          );
          applyAnimated(selected.id, { startMin });
          o.current.flashEdges?.([startMin]);
        } else if (e.shiftKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
          const endMin = Math.max(
            selected.startMin + g.minEventMinutes,
            Math.min(ceilMin, selected.endMin + (e.key === "ArrowDown" ? step : -step)),
          );
          applyAnimated(selected.id, { endMin });
          o.current.flashEdges?.([endMin]);
        } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
          const startMin = Math.max(
            floorMin,
            Math.min(
              ceilMin - duration,
              selected.startMin + (e.key === "ArrowDown" ? step : -step),
            ),
          );
          applyAnimated(selected.id, {
            startMin,
            endMin: startMin + duration,
          });
          o.current.flashEdges?.([startMin, startMin + duration]);
        } else {
          const dayIndex = Math.max(
            0,
            Math.min(view.dayCount - 1, selected.dayIndex + (e.key === "ArrowRight" ? 1 : -1)),
          );
          applyAnimated(selected.id, { dayIndex });
          o.current.flashEdges?.([selected.startMin, selected.endMin]);
        }
        reveal(selected.id);
        return;
      }
      if (e.altKey) return;

      e.preventDefault();
      if (!selected) {
        if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
          const dir = e.key === "ArrowLeft" ? -1 : 1;
          if (o.current.navigationKeys === "day" && o.current.stepDay) o.current.stepDay(dir);
          else o.current.stepRange(dir);
          return;
        }
        const first = firstEvent(projected, view, drawn);
        if (first) {
          o.current.select(first.id);
          reveal(first.id);
        }
        return;
      }
      const step = walkEvents(projected, view, selected, e.key as ArrowKey, drawn, focusedMore());
      if (!step) return;
      if ("more" in step) {
        focusMore(step.more);
        return;
      }
      if (e.shiftKey && sel) sel.extendTo(step.event.id);
      else o.current.select(step.event.id);
      reveal(step.event.id);
    };

    // document listener, not root: with nothing focused the event targets <body> and never reaches root
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      scope.dispose();
    };
  }, []);
}
