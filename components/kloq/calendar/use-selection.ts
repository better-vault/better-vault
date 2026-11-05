"use client";

/**
 * use-selection — selection state plus everything that acts on it. Called once by
 * `calendar-app`, published via context; bulk mutations go through `store.batch()`.
 */

import type { RefObject } from "react";
import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import type { KloqSettings } from "../lib/calendar-config";
import type { KloqBatchOp, KloqStore } from "../lib/calendar-store";
import {
  addDays,
  asPlacementId,
  type CalEvent,
  dateOnlyAt,
  type EventColor,
  formatInstant,
  type Instant,
  instantAt,
  minutesOfDate,
  type PlacedEvent,
  parseInstant,
  type ViewDescriptor,
  wallMinutesBetween,
} from "../lib/calendar-types";
import { readEventsFromClipboard, rebaseEvents, writeEventsToClipboard } from "../lib/clipboard";
import type { PlacedOccurrence } from "../lib/projection";
import { masterIdOf, nodesFor, occurrenceStartOf, withoutSegment } from "../lib/recurrence";
import {
  addToSelection,
  applySelectionClick,
  EMPTY_SELECTION,
  eventKeyOf,
  isSelected,
  nearestOfSeries,
  remapSelection,
  removeFromSelection,
  replaceSelection,
  retainSelection,
  type SelectionModifiers,
  type SelectionState,
  selectAll as selectAllIds,
  selectionIndex,
  selectionOrder,
  selectOnly,
} from "../lib/selection";
import { KEYBOARD_SPRING, KEYBOARD_SPRING_MS, prefersReducedMotion } from "../lib/springs";
import { useLatest } from "../lib/use-latest";
import { useKloqSettings } from "./settings-context";

interface PasteAnchor {
  col: number;
  startMin: number;
}

interface NudgeDelta {
  days?: number;
  minutes?: number;
}

export interface KloqSelectionHandle {
  state: SelectionState;
  ids: readonly string[];
  count: number;
  lead: string | null;
  has(id: string): boolean;
  /** 1-based, or 0 */
  indexOf(id: string): number;

  click(id: string, mods: SelectionModifiers): void;
  setLead(id: string | null): void;
  replace(ids: readonly string[]): void;
  selectAll(): void;
  clear(): void;
  applyMarquee(ids: readonly string[], additive: boolean): void;
  extendTo(id: string): void;

  selectedEvents(): CalEvent[];

  /** hovered slot, written per-pointermove — a paste input, not a render input */
  hover: RefObject<PasteAnchor | null>;

  /** explicit `ids` act on something other than the selection (context menu) */
  copy(ids?: readonly string[]): void;
  cut(ids?: readonly string[]): void;
  paste(): void;
  duplicate(): void;
  remove(ids?: readonly string[]): void;
  recolor(color: EventColor): void;
  /** refuses rather than clamping, so the set keeps its shape */
  nudge(delta: NudgeDelta): void;
}

interface SelectionControllerOptions {
  store: KloqStore;
  view: ViewDescriptor;
  projected: readonly PlacedEvent[];
  registry: Map<string, HTMLElement>;
}

// calendar days, not days * 1440: a move across DST must keep the same clock time
function shiftInstant(instant: Instant, delta: NudgeDelta): Instant {
  const ms = parseInstant(instant);
  if (Number.isNaN(ms)) return instant;
  const d = addDays(new Date(ms), delta.days ?? 0);
  d.setMinutes(d.getMinutes() + (delta.minutes ?? 0));
  return formatInstant(d);
}

function outsideWindow(e: CalEvent, delta: NudgeDelta, g: KloqSettings): boolean {
  if (e.allDay) return false;
  const start = parseInstant(e.start);
  if (Number.isNaN(start)) return true;
  const duration = wallMinutesBetween(e.start, e.end);
  const min = minutesOfDate(new Date(start)) + (delta.minutes ?? 0);
  return min < g.dayStartMin || min + duration > g.dayEndMin;
}

export function useSelectionController({
  store,
  view,
  projected,
  registry,
}: SelectionControllerOptions): KloqSelectionHandle {
  const g = useKloqSettings();
  const [state, setState] = useState<SelectionState>(EMPTY_SELECTION);
  const hover = useRef<PasteAnchor | null>(null);

  const order = useMemo(() => selectionOrder(projected), [projected]);
  const visible = useMemo(() => new Set(order), [order]);

  // lead placement per event key — keeps a selection alive when a resize re-keys `base` to `base@0`
  const leadByKey = useMemo(() => {
    const byId = new Map(projected.map((p) => [p.id as string, p]));
    const m = new Map<string, string>();
    for (const id of order) {
      const p = byId.get(id);
      if (p) m.set(eventKeyOf(p), id);
    }
    return m;
  }, [order, projected]);

  // render-phase prune; both helpers return the same object when unchanged, so this doesn't loop.
  // An id that vanished under a rule edit follows its series to the nearest occurrence.
  const live = retainSelection(
    remapSelection(state, (id) =>
      visible.has(asPlacementId(id))
        ? undefined
        : (leadByKey.get(withoutSegment(id)) ??
          nearestOfSeries(
            projected,
            id,
            occurrenceStartOf(id) ?? store.get(masterIdOf(id))?.start ?? null,
          )),
    ),
    visible,
  );
  if (live !== state) setState(live);

  const latest = useLatest({ store, view, projected, order, state: live, g, registry });

  const popIn = useCallback((ids: readonly string[]) => {
    if (prefersReducedMotion()) return;
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        for (const id of ids) {
          for (const node of nodesFor(latest.current.registry, id))
            node.animate(
              [
                { opacity: 0, transform: "scale(0.92)" },
                { opacity: 1, transform: "none" },
              ],
              { duration: KEYBOARD_SPRING_MS, easing: KEYBOARD_SPRING },
            );
        }
      }),
    );
  }, []);

  const resolve = useCallback((ids?: readonly string[]): CalEvent[] => {
    const { state: s, store: st, order: ord } = latest.current;
    const rank = new Map<string, number>(ord.map((id, i) => [id, i]));
    return (
      [...(ids ?? s.ids)]
        .sort((a, b) => (rank.get(a) ?? 0) - (rank.get(b) ?? 0))
        // strip only the segment suffix; recurring instances fall through to `resolveForCopy`
        .map((id) => st.get(id) ?? st.get(withoutSegment(id)))
        .filter((e): e is CalEvent => e !== undefined)
    );
  }, []);

  // a recurring instance materialises as that occurrence, detached
  const resolveForCopy = useCallback((ids?: readonly string[]): CalEvent[] => {
    const { state: s, store: st, order: ord, projected: proj } = latest.current;
    const rank = new Map<string, number>(ord.map((id, i) => [id, i]));
    const out: CalEvent[] = [];
    for (const id of [...(ids ?? s.ids)].sort((a, b) => (rank.get(a) ?? 0) - (rank.get(b) ?? 0))) {
      const direct = st.get(id) ?? st.get(withoutSegment(id));
      if (direct) {
        out.push(direct);
        continue;
      }
      const placed = proj.find((e) => e.id === id) as PlacedOccurrence | undefined;
      const occ = placed?.occurrence;
      const master = occ && st.get(masterIdOf(id));
      if (!occ || !master) continue;
      const { rrule: _r, exdates: _x, recurrenceId: _i, ...rest } = master;
      out.push({ ...rest, start: occ.start, end: occ.end } as CalEvent);
    }
    return out;
  }, []);

  const selectedEvents = useCallback((): CalEvent[] => resolve(), [resolve]);

  const editable = useCallback(
    (ids?: readonly string[]): CalEvent[] => resolve(ids).filter((e) => !e.readOnly),
    [resolve],
  );

  // hovered slot, else the lead's slot, else the anchor day date-only (keeps original time of day)
  const pasteTarget = useCallback((): Instant => {
    const { view: v, projected: p, state: s } = latest.current;
    const h = hover.current;
    const lead = s.lead ? p.find((e) => e.id === s.lead) : undefined;
    // a timeline placement's column is its lane and its minutes run from the window start: use its real instant
    if (v.kind === "timeline") {
      const at = (lead as Partial<PlacedOccurrence> | undefined)?.start;
      return at && !lead?.allDay ? at : dateOnlyAt(v, 0);
    }
    if (h) return instantAt(v, h.col, h.startMin);
    if (lead && !lead.allDay) return instantAt(v, lead.dayIndex, lead.startMin);
    return dateOnlyAt(v, v.todayIndex >= 0 ? v.todayIndex : 0);
  }, []);

  const insert = useCallback(
    (events: CalEvent[]) => {
      if (events.length === 0) return;
      latest.current.store.batch(events.map((event): KloqBatchOp => ({ type: "add", event })));
      setState(replaceSelection(events.map((e) => e.id)));
      popIn(events.map((e) => e.id));
    },
    [popIn],
  );

  const copy = useCallback(
    (ids?: readonly string[]) => {
      const events = resolveForCopy(ids);
      if (events.length === 0) return;
      void writeEventsToClipboard(events, {
        locale: latest.current.g.locale,
        hour12: latest.current.g.hour12,
      });
    },
    [resolveForCopy],
  );

  const removeSelection = useCallback(
    (ids?: readonly string[]) => {
      const events = editable(ids);
      if (events.length === 0) return;
      latest.current.store.batch(events.map((e): KloqBatchOp => ({ type: "remove", id: e.id })));
      setState((cur) => (ids ? removeFromSelection(cur, ids) : EMPTY_SELECTION));
    },
    [editable],
  );

  const cut = useCallback(
    (ids?: readonly string[]) => {
      copy(ids);
      removeSelection(ids);
    },
    [copy, removeSelection],
  );

  const paste = useCallback(() => {
    const target = pasteTarget();
    void readEventsFromClipboard().then(({ events }) => {
      if (events.length === 0) return;
      insert(rebaseEvents(events, { target, newId: g.makeId }));
    });
  }, [pasteTarget, insert, g.makeId]);

  // deliberately never touches the clipboard
  const duplicate = useCallback(() => {
    const events = resolveForCopy();
    if (events.length === 0) return;
    // copies land below the whole selection's span; if that doesn't fit the day, exactly on top
    const anchor = events[0]!;
    const span = anchor.allDay
      ? 0
      : Math.max(0, ...events.map((e) => (e.allDay ? 0 : wallMinutesBetween(anchor.start, e.end))));
    const startMs = parseInstant(anchor.start);
    const fits =
      span > 0 &&
      !Number.isNaN(startMs) &&
      minutesOfDate(new Date(startMs)) + 2 * span <= latest.current.g.dayEndMin;
    const target = fits ? shiftInstant(anchor.start, { minutes: span }) : anchor.start;
    insert(rebaseEvents(events, { target }));
  }, [resolveForCopy, insert]);

  const recolor = useCallback(
    (color: CalEvent["color"]) => {
      const events = editable();
      if (events.length === 0) return;
      latest.current.store.batch(
        events.map(
          (e): KloqBatchOp => ({
            type: "update",
            id: e.id,
            patch: { color },
          }),
        ),
      );
    },
    [editable],
  );

  const nudge = useCallback(
    (delta: NudgeDelta) => {
      const events = editable();
      if (events.length === 0) return;
      const { g: settings, store: st } = latest.current;
      // refuse rather than clamp: per-event clamping would collapse the selection's shape
      if (events.some((e) => outsideWindow(e, delta, settings))) return;
      st.batch(
        events.map(
          (e): KloqBatchOp => ({
            type: "update",
            id: e.id,
            patch: {
              start: shiftInstant(e.start, delta),
              end: shiftInstant(e.end, delta),
            },
          }),
        ),
      );
    },
    [editable],
  );

  return useMemo<KloqSelectionHandle>(() => {
    const s = live;
    return {
      state: s,
      ids: s.ids,
      count: s.ids.length,
      lead: s.lead,
      has: (id) => isSelected(s, id),
      indexOf: (id) => selectionIndex(s, id),
      click: (id, mods) =>
        setState((cur) => applySelectionClick(cur, id, mods, latest.current.order)),
      setLead: (id) => setState(selectOnly(id)),
      replace: (ids) => setState(replaceSelection(ids)),
      selectAll: () => setState(selectAllIds(latest.current.order)),
      clear: () => setState(EMPTY_SELECTION),
      applyMarquee: (ids, additive) =>
        setState((cur) => (additive ? addToSelection(cur, ids) : replaceSelection(ids))),
      extendTo: (id) =>
        setState((cur) => applySelectionClick(cur, id, { range: true }, latest.current.order)),
      selectedEvents,
      hover,
      copy,
      cut,
      paste,
      duplicate,
      remove: removeSelection,
      recolor,
      nudge,
    };
  }, [live, selectedEvents, copy, cut, paste, duplicate, removeSelection, recolor, nudge]);
}

const SelectionContext = createContext<KloqSelectionHandle | null>(null);

export const SelectionProvider = SelectionContext.Provider;

/** `null` outside a provider — callers treat that as single selection. */
export function useKloqSelection(): KloqSelectionHandle | null {
  return useContext(SelectionContext);
}

interface ModifierEvent {
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
}

function isAppleLike(): boolean {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  return /mac|iphone|ipad|ipod/i.test(
    nav.userAgentData?.platform || nav.platform || nav.userAgent || "",
  );
}

/** ⌘ on Apple, Ctrl elsewhere — ctrl+click is `contextmenu` on a Mac. */
export const isToggleModifier = (e: ModifierEvent): boolean =>
  e.metaKey || (e.ctrlKey && !isAppleLike());

export function selectionModifiers(e: ModifierEvent): SelectionModifiers {
  return { toggle: isToggleModifier(e), range: e.shiftKey };
}

export const hasSelectionModifier = (e: ModifierEvent): boolean =>
  isToggleModifier(e) || e.shiftKey;
