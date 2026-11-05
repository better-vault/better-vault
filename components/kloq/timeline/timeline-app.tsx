"use client";

/** timeline-app — one scroll container holding the sticky header and the grid; owns the drag engine. */

import type React from "react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useConstraints } from "../calendar/constraints-context";
import { COLOR_KEYS } from "../calendar/context-menu-shared";
import { DEFAULT_QUICK_ADD_MIN } from "../calendar/kloq-command";
import { useKloqSettings } from "../calendar/settings-context";
import { useSlots } from "../calendar/slots";
import { useKloqStore } from "../calendar/store-context";
import type { WorkingHours } from "../calendar/time-shade";
import { useRecurrenceScope } from "../calendar/use-recurrence-scope";
import { useKloqSelection } from "../calendar/use-selection";
import {
  announceColor,
  announceCreated,
  announceMoved,
  announceRefused,
  announceResized,
  count,
  eventName,
} from "../lib/announce";
import { type KloqBatchOp, useStoreEvents } from "../lib/calendar-store";
import type { PlacedEvent } from "../lib/calendar-types";
import { readEventsFromClipboard, rebaseEvents } from "../lib/clipboard";
import { registerConflictScope } from "../lib/conflicts";
import { allows, NO_CONSTRAINTS } from "../lib/constraints";
import type { CommitResult } from "../lib/drag-engine/types";
import type { CalEvent, CalEventPatch } from "../lib/event-types";
import {
  addDays,
  displayDate,
  formatInstant,
  isDateOnly,
  parseInstant,
  startOfLocalDay,
  toDateOnlyString,
} from "../lib/instant";
import type { Keymap } from "../lib/keymap";
import { bucketByLane, type Lane, type LaneAdapter, laneIndexOf } from "../lib/lane";
import type { PlacedOccurrence } from "../lib/projection";
import { applyPlan, editOccurrence } from "../lib/recurrence";
import { layoutLane, maxSubRows } from "../lib/timeline-layout";
import { projectTimeline } from "../lib/timeline-projection";
import {
  createHorizontalAxis,
  defaultBookingSpan,
  instantAtMinute,
  minutesFromStart,
  type TimelineWindow,
  zoomWindow,
} from "../lib/timeline-window";
import { useLatest } from "../lib/use-latest";
import { ALL_DAY_LABEL, formatBarRange } from "./timeline-block";
import { GUTTER_WIDTH, TimelineGrid } from "./timeline-grid";
import { DEFAULT_WORKING_HOURS } from "./timeline-shade";
import {
  clampDayResize,
  clampDayShift,
  rawSpanOf,
  slotForGesture,
  type TimelineCreateInput,
  useTimelineDrag,
} from "./use-timeline-drag";
import { focusBar, type MoveStep, useTimelineKeys } from "./use-timeline-keys";

/** Overlapping bookings a default-height lane shows before "+N more"; a taller `Lane.height` raises it. */
const DEFAULT_LANE_SUBROWS = 3;

const NARROW_HOST_PX = 480;
const NARROW_GUTTER_WIDTH = 112;
const TIGHT_HOST_PX = 360;
const TIGHT_GUTTER_WIDTH = 96;
const DAY_MIN = 1440;

/** The gutter gives way on a phone-width host so the track keeps most of the surface. */
function gutterFor(hostWidth: number): number {
  if (hostWidth <= 0 || hostWidth >= NARROW_HOST_PX) return GUTTER_WIDTH;
  return hostWidth <= TIGHT_HOST_PX ? TIGHT_GUTTER_WIDTH : NARROW_GUTTER_WIDTH;
}

/** An all-day edge moves by calendar days and keeps its own spelling, date-only or not. */
function shiftDays(instant: string, days: number): string {
  const at = addDays(new Date(parseInstant(instant)), days);
  return isDateOnly(instant) ? toDateOnlyString(at) : formatInstant(at);
}

/** A stable function that always calls the latest `fn`, so memoised children don't re-render for it. */
function useStableCallback<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R {
  const ref = useLatest(fn);
  const [stable] = useState(
    () =>
      (...args: A) =>
        ref.current(...args),
  );
  return stable;
}

function useGutterWidth(ref: React.RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(GUTTER_WIDTH);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const measure = () => setWidth(gutterFor(el.clientWidth));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return width;
}

export interface TimelineAppProps {
  lanes: readonly Lane[];
  adapter: LaneAdapter;
  window: TimelineWindow;
  selectedId: string | null;
  /** `open: false` selects without opening the editor */
  onSelect?: (id: string | null, opts?: { isNew?: boolean; open?: boolean }) => void;
  /** false = no working-hours tint, mirroring `Kloq`'s own `workingHours` prop */
  workingHours?: WorkingHours | false;
  /** the shell's node registry: the event panel, revert animation and history all look bars up in it */
  registerNode: (id: string, node: HTMLElement | null) => void;
  /** the shell's roving tab stop; standalone it falls back to the selection, then the first bar */
  rovingId?: string | null;
  /** spread into every created booking, as on every calendar create path */
  onDefaultCalendar?: { calendarId?: string };
  /** stamped onto every created booking's instants */
  authoredZone?: { timeZone: string };
  announce?: (message: string, politeness?: "polite" | "assertive") => void;
  /**
   * The window's placements, when the host already projected them (the shell
   * does, so selection and the keyboard see every bar). Omit and the timeline
   * projects the store itself.
   */
  events?: PlacedOccurrence[];
  /** the host's key overrides, for the create key */
  keymap?: Keymap;
  /** the view's anchor date; landing on today brings the now line back into view */
  anchorDate?: Date;
}

export function TimelineApp({
  lanes,
  adapter,
  window,
  selectedId,
  onSelect,
  workingHours = DEFAULT_WORKING_HOURS,
  registerNode,
  rovingId: rovingIdProp,
  onDefaultCalendar,
  authoredZone,
  announce,
  events: placed,
  keymap,
  anchorDate,
}: TimelineAppProps) {
  const C = useSlots();
  const g = useKloqSettings();
  const store = useKloqStore();
  const storeEvents = useStoreEvents(store);
  const selection = useKloqSelection();
  const askScope = useRecurrenceScope();
  const { constraints } = useConstraints();

  const scrollRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const draftRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  const BAR_HEIGHT = g.densityTokens.chipHeight + 8;
  const ROW_HEIGHT = BAR_HEIGHT * DEFAULT_LANE_SUBROWS + 6;
  const gutterWidth = useGutterWidth(scrollRef);

  // keyed on the window's values: a host passing an inline `timelineWindow` must not re-project every render
  const startMs = window.start.getTime();
  const endMs = window.end.getTime();
  const zoomed = useMemo(
    () => zoomWindow(window, g.zoom),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [startMs, endMs, window.slotMinutes, window.pxPerSlot, g.zoom],
  );
  const axis = useMemo(() => createHorizontalAxis(zoomed), [zoomed]);
  const total = minutesFromStart(zoomed, zoomed.end);

  const all = useMemo(
    () => placed ?? projectTimeline(storeEvents, lanes, zoomed, adapter).all,
    [placed, storeEvents, lanes, zoomed, adapter],
  );

  // two bookings only collide when they share a lane
  useEffect(
    () =>
      registerConflictScope(
        store,
        (a, b) => laneIndexOf(adapter, lanes, a) === laneIndexOf(adapter, lanes, b),
      ),
    [store, adapter, lanes],
  );

  const commitCreate = useCallback(
    (input: TimelineCreateInput): string => {
      const id = g.makeId();
      const draft: CalEvent = {
        id,
        title: "",
        ...onDefaultCalendar,
        ...authoredZone,
        start: formatInstant(input.start),
        end: formatInstant(input.end),
      } as CalEvent;
      store.add({ ...draft, ...adapter.assign(draft, input.laneId) } as CalEvent);
      const lane = lanes.find((l) => l.id === input.laneId);
      announce?.(
        announceCreated(
          { title: "" },
          { day: lane?.label, time: formatBarRange(zoomed, g, input.startMin, input.endMin) },
        ),
      );
      return id;
    },
    [g, store, adapter, onDefaultCalendar, authoredZone, lanes, announce, zoomed],
  );

  /** A timeline bar is a placement; recurring bars need the same scope choice as calendar bars. */
  const commitPlacement = useCallback(
    (id: string, patch: CalEventPatch): CommitResult => {
      const placedEvent = all.find((event) => event.id === id);
      if (!placedEvent) return Promise.resolve(false);
      const master = store.get(placedEvent.source.id);
      if (!master) return Promise.resolve(false);
      const occurrence = placedEvent.occurrence;
      if (!occurrence) {
        store.update(master.id, patch);
        return;
      }

      const apply = (scope: "this" | "following" | "all") => {
        const plan = editOccurrence(master, occurrence, patch, scope, { makeId: g.makeId });
        applyPlan(store, plan);
        if (plan.selectId) onSelect?.(plan.selectId);
      };
      if (!askScope) {
        apply("all");
        return;
      }
      return askScope({ action: "edit", event: master, occurrence }).then((scope) => {
        if (!scope) return false;
        flushSync(() => apply(scope));
        return true;
      });
    },
    [all, store, g.makeId, onSelect, askScope],
  );

  const commitMove = useCallback(
    (id: string, patch: { laneId: string; startMin: number; endMin: number }): CommitResult => {
      const ev = all.find((event) => event.id === id);
      if (!ev) return Promise.resolve(false);
      return commitPlacement(id, {
        ...adapter.assign(ev.source, patch.laneId),
        start: formatInstant(instantAtMinute(zoomed, patch.startMin)),
        end: formatInstant(instantAtMinute(zoomed, patch.endMin)),
      });
    },
    [all, adapter, zoomed, commitPlacement],
  );

  const commitResize = useCallback(
    (id: string, patch: { startMin: number; endMin: number }): CommitResult => {
      return commitPlacement(id, {
        start: formatInstant(instantAtMinute(zoomed, patch.startMin)),
        end: formatInstant(instantAtMinute(zoomed, patch.endMin)),
      });
    },
    [commitPlacement, zoomed],
  );

  const allDayPatch = useCallback(
    (
      ev: CalEvent,
      patch: { laneId: string; startDays: number; endDays: number },
    ): CalEventPatch => ({
      ...adapter.assign(ev, patch.laneId),
      start: shiftDays(ev.start, patch.startDays),
      end: shiftDays(ev.end, patch.endDays),
    }),
    [adapter],
  );

  const commitAllDay = useCallback(
    (id: string, patch: { laneId: string; startDays: number; endDays: number }): CommitResult => {
      const ev = all.find((event) => event.id === id);
      if (!ev) return Promise.resolve(false);
      return commitPlacement(id, {
        ...adapter.assign(ev.source, patch.laneId),
        start: shiftDays(ev.start, patch.startDays),
        end: shiftDays(ev.end, patch.endDays),
      });
    },
    [all, adapter, commitPlacement],
  );

  // the draft previews the sub-row a new booking will take: the first one free across its span
  const buckets = useMemo(() => bucketByLane(all, lanes.length), [all, lanes.length]);
  const draftBand = (laneIndex: number, span: { startMin: number; endMin: number }) => {
    const lane = lanes[laneIndex];
    if (!lane) return null;
    const inLane = buckets[laneIndex] ?? [];
    const cap = maxSubRows(lane, ROW_HEIGHT, BAR_HEIGHT);
    const taken = new Set<number>();
    if (inLane.some((e) => e.startMin < span.endMin && e.endMin > span.startMin)) {
      const layout = layoutLane(inLane, cap);
      for (const e of inLane) {
        if (e.startMin >= span.endMin || e.endMin <= span.startMin) continue;
        const slot = layout.get(e.id);
        if (slot && !slot.hidden) taken.add(slot.row);
      }
    }
    let row = 0;
    while (row < cap - 1 && taken.has(row)) row += 1;
    return { top: row * BAR_HEIGHT, height: BAR_HEIGHT - 2 };
  };

  const { onCanvasPointerDown, onEventPointerDown } = useTimelineDrag({
    draftBand,
    lanes,
    from: 0,
    to: lanes.length,
    window: zoomed,
    constraints,
    canvasRef,
    trackRef,
    scrollRef,
    draftRef,
    rowHeight: ROW_HEIGHT,
    snapMinutes: zoomed.slotMinutes,
    minDurationMinutes: zoomed.slotMinutes,
    commitCreate,
    commitMove,
    commitResize,
    commitAllDay,
    formatBarTime: (startMin, endMin) => formatBarRange(zoomed, g, startMin, endMin),
    openEditor: (id) => onSelect?.(id),
    onCanvasClick: () => onSelect?.(null),
    announce,
  });

  const onEventActivate = useStableCallback((event: PlacedEvent) => onSelect?.(event.id));
  const rovingId = rovingIdProp ?? selectedId ?? all[0]?.id ?? null;

  type Span = { startMin: number; endMin: number };

  /** the same constraint check a drag ends with */
  const allowed = (
    gesture: "lane-move" | "lane-resize",
    event: PlacedOccurrence,
    target: Span,
    origin: Span,
  ) => {
    const allDay = event.allDay === true;
    return allows(constraints ?? NO_CONSTRAINTS, {
      gesture,
      target: { ...slotForGesture(zoomed, target.startMin, target.endMin), allDay },
      origin: { ...slotForGesture(zoomed, origin.startMin, origin.endMin), allDay },
      event: event.source,
    });
  };

  const weekdayAt = (min: number) =>
    displayDate(instantAtMinute(zoomed, min), g.displayZone).toLocaleDateString(g.locale, {
      weekday: "long",
    });

  /** one bar's keyboard move, or null when it cannot make the step */
  const planMove = (event: PlacedOccurrence, step: MoveStep) => {
    const lane = lanes[event.laneIndex + (step.lanes ?? 0)];
    const source = store.get(event.source.id);
    if (event.readOnly || event.occurrence || !lane || !source) return null;
    const slots = step.slots ?? 0;
    if (event.allDay) {
      const raw = rawSpanOf(zoomed, event);
      if (clampDayShift(raw, slots, total) !== slots) return null;
      const target = {
        startMin: raw.startMin + slots * DAY_MIN,
        endMin: raw.endMin + slots * DAY_MIN,
      };
      if (!allowed("lane-move", event, target, raw)) return null;
      return {
        event,
        patch: allDayPatch(source, { laneId: lane.id, startDays: slots, endDays: slots }),
        when: { day: `${lane.label}, ${weekdayAt(Math.max(0, target.startMin))}`, allDay: true },
      };
    }
    const startMin = event.startMin + slots * zoomed.slotMinutes;
    const endMin = event.endMin + slots * zoomed.slotMinutes;
    if (startMin < 0 || endMin > total) return null;
    if (!allowed("lane-move", event, { startMin, endMin }, event)) return null;
    return {
      event,
      patch: {
        ...adapter.assign(source, lane.id),
        start: formatInstant(instantAtMinute(zoomed, startMin)),
        end: formatInstant(instantAtMinute(zoomed, endMin)),
      } as CalEventPatch,
      when: { day: lane.label, time: formatBarRange(zoomed, g, startMin, endMin) },
    };
  };

  /** ⌥-arrows: every selected bar takes the step, or none does */
  const keyMove = (targets: readonly PlacedOccurrence[], step: MoveStep): boolean => {
    // a day and a slot are different steps: a mixed selection has no common one along time
    const mixed = !!step.slots && targets.some((t) => t.allDay) && targets.some((t) => !t.allDay);
    const plans = mixed ? [] : targets.map((t) => planMove(t, step));
    const ready = plans.filter((p) => p !== null);
    if (ready.length === 0 || ready.length !== targets.length) {
      announce?.(
        targets.length > 1
          ? `${count(targets.length, "event")} cannot be moved there`
          : announceRefused("move", targets[0]),
        "assertive",
      );
      return false;
    }
    if (ready.length === 1) store.update(ready[0].event.source.id, ready[0].patch);
    else
      store.batch(
        ready.map((p): KloqBatchOp => ({ type: "update", id: p.event.source.id, patch: p.patch })),
      );
    announce?.(
      ready.length === 1
        ? announceMoved(ready[0].event, ready[0].when)
        : `${count(ready.length, "event")} moved`,
    );
    return true;
  };

  /** ⌥⇧-arrows: one edge, one slot — a day for an all-day bar */
  const keyResize = (
    event: PlacedOccurrence,
    edge: "start" | "end",
    slots: number,
    selected: number,
  ): boolean => {
    const refuse = (message = announceRefused("resize", event)) => {
      announce?.(message, "assertive");
      return false;
    };
    if (selected > 1) return refuse(`${count(selected, "event")} selected, resize one at a time`);
    const lane = lanes[event.laneIndex];
    const source = store.get(event.source.id);
    if (event.readOnly || event.occurrence || !lane || !source) return refuse();
    if (event.allDay) {
      const raw = rawSpanOf(zoomed, event);
      if (clampDayResize(raw, edge, slots, total) !== slots) return refuse();
      const startDays = edge === "start" ? slots : 0;
      const endDays = edge === "end" ? slots : 0;
      const target = {
        startMin: raw.startMin + startDays * DAY_MIN,
        endMin: raw.endMin + endDays * DAY_MIN,
      };
      if (!allowed("lane-resize", event, target, raw)) return refuse();
      void commitAllDay(source.id, { laneId: lane.id, startDays, endDays });
      const days = Math.round((target.endMin - target.startMin) / DAY_MIN);
      announce?.(
        announceResized(event, { day: `${lane.label}, ${count(days, "day")}`, allDay: true }),
      );
      return true;
    }
    const delta = slots * zoomed.slotMinutes;
    const startMin = edge === "start" ? event.startMin + delta : event.startMin;
    const endMin = edge === "end" ? event.endMin + delta : event.endMin;
    if (startMin < 0 || endMin > total || endMin - startMin < zoomed.slotMinutes) return refuse();
    if (!allowed("lane-resize", event, { startMin, endMin }, event)) return refuse();
    void commitResize(source.id, { startMin, endMin });
    announce?.(
      announceResized(event, {
        day: lane.label,
        time: formatBarRange(zoomed, g, startMin, endMin),
      }),
    );
    return true;
  };

  const createOnLane = (laneId: string, rawMin: number) => {
    const { startMin, endMin } = defaultBookingSpan(zoomed, rawMin, DEFAULT_QUICK_ADD_MIN);
    const span = slotForGesture(zoomed, startMin, endMin);
    if (!allows(constraints ?? NO_CONSTRAINTS, { gesture: "create", target: span })) {
      announce?.(announceRefused("create"), "assertive");
      return;
    }
    const id = commitCreate({ laneId, startMin, endMin, start: span.start, end: span.end });
    onSelect?.(id, { isNew: true });
  };

  /** the first slot the scroller shows */
  const firstVisibleMin = () => {
    const step = zoomed.slotMinutes;
    const left = axis.pxToMinutes(scrollRef.current?.scrollLeft ?? 0);
    return Math.max(0, Math.min(total - step, Math.ceil(left / step) * step));
  };

  /** slides a timed span later, a step at a time, to where nothing on the lane overlaps it */
  const nextFree = (laneIndex: number, startMin: number, duration: number): number | null => {
    const taken = (buckets[laneIndex] ?? []).filter((e) => !e.allDay);
    for (let at = startMin; at + duration <= total; at += zoomed.slotMinutes)
      if (!taken.some((e) => e.startMin < at + duration && e.endMin > at)) return at;
    return null;
  };

  /** ⌘V: onto the cursor's lane and time, slid along to the first gap so a copy never hides its source */
  const paste = (cursor: PlacedOccurrence | null) => {
    void readEventsFromClipboard().then(({ events: clip }) => {
      const copied = clip
        .filter((e) => !Number.isNaN(parseInstant(e.start)))
        .sort((a, b) => parseInstant(a.start) - parseInstant(b.start));
      if (copied.length === 0 || lanes.length === 0) return;
      const firstLane = laneIndexOf(adapter, lanes, copied[0]);
      const baseLane = cursor?.laneIndex ?? Math.max(0, firstLane);
      const laneIndexes = copied.map((e) => {
        const own = laneIndexOf(adapter, lanes, e);
        const at = own < 0 || firstLane < 0 ? baseLane : baseLane + own - firstLane;
        return Math.max(0, Math.min(lanes.length - 1, at));
      });
      const spanOf = (e: CalEvent) => ({
        startMin: minutesFromStart(zoomed, parseInstant(e.start)),
        endMin: minutesFromStart(zoomed, parseInstant(e.end)),
      });
      const placeAt = (atMin: number) =>
        rebaseEvents(copied, {
          target: formatInstant(instantAtMinute(zoomed, atMin)),
          newId: g.makeId,
        }).map((e, i) => ({ ...e, ...adapter.assign(e, lanes[laneIndexes[i]].id) }) as CalEvent);
      const clear = (set: CalEvent[]) =>
        set.every((e, i) => {
          const span = spanOf(e);
          if (!e.allDay && span.endMin > total) return false;
          return !(buckets[laneIndexes[i]] ?? []).some(
            (b) =>
              (b.allDay === true) === (e.allDay === true) &&
              b.startMin < span.endMin &&
              b.endMin > span.startMin,
          );
        });

      const step = copied.every((e) => e.allDay) ? DAY_MIN : zoomed.slotMinutes;
      const anchor = cursor ? cursor.startMin : firstVisibleMin();
      let pasted = placeAt(anchor);
      for (let at = anchor; at < total && !clear(pasted); at += step) {
        const next = placeAt(at + step);
        if (clear(next)) pasted = next;
      }

      const refused = pasted.find(
        (e) =>
          !allows(constraints ?? NO_CONSTRAINTS, {
            gesture: "paste",
            target: {
              start: new Date(parseInstant(e.start)),
              end: new Date(parseInstant(e.end)),
              allDay: e.allDay === true,
            },
          }),
      );
      if (refused) {
        announce?.(announceRefused("paste", refused), "assertive");
        return;
      }

      store.batch(pasted.map((event): KloqBatchOp => ({ type: "add", event })));
      const ids = pasted.map((e) => e.id);
      if (selection) selection.replace(ids);
      else onSelect?.(ids[0], { open: false });
      const first = pasted[0];
      const span = spanOf(first);
      announce?.(
        pasted.length > 1
          ? `${count(pasted.length, "event")} pasted`
          : `${eventName(first)} pasted to ${lanes[laneIndexes[0]].label}, ${
              first.allDay
                ? ALL_DAY_LABEL.toLowerCase()
                : formatBarRange(zoomed, g, span.startMin, span.endMin)
            }`,
      );
      focusBar(canvasRef.current, ids[0]);
    });
  };

  useTimelineKeys({
    canvasRef,
    events: all,
    lanes,
    window: zoomed,
    selectedId,
    selectedIds: selection?.ids,
    keymap,
    select: (id, extend) => {
      if (extend && selection) selection.extendTo(id);
      else if (selection) selection.setLead(id);
      else onSelect?.(id, { open: false });
    },
    adopt: (id) =>
      flushSync(() => {
        if (selection) selection.setLead(id);
        else onSelect?.(id, { open: false });
      }),
    move: keyMove,
    resize: keyResize,
    recolor: (targets, index) => {
      const color = COLOR_KEYS[index];
      const editable = targets.filter((t) => !t.readOnly);
      if (!color || editable.length === 0) return;
      if (editable.length === 1) store.update(editable[0].source.id, { color });
      else
        store.batch(
          editable.map((t): KloqBatchOp => ({ type: "update", id: t.source.id, patch: { color } })),
        );
      announce?.(announceColor(editable, color));
    },
    create: (cursor) => {
      const lane = lanes[cursor?.laneIndex ?? 0];
      if (!lane) return;
      const now = minutesFromStart(zoomed, Date.now());
      // with now off the axis: beside the bar in hand, else the first slot in view
      const at =
        now >= 0 && now < total
          ? now
          : cursor
            ? (nextFree(cursor.laneIndex, cursor.startMin, DEFAULT_QUICK_ADD_MIN) ??
              cursor.startMin)
            : firstVisibleMin();
      createOnLane(lane.id, at);
    },
    clipboard: selection
      ? (action, targets, cursor) => {
          const named = (list: readonly PlacedOccurrence[]) =>
            list.length === 1 ? eventName(list[0]) : count(list.length, "event");
          const ids = targets.map((t) => t.id);
          if (action === "paste") {
            paste(cursor);
            return true;
          }
          if (action === "copy") {
            selection.copy(ids);
            announce?.(`${named(targets)} copied`);
            return true;
          }
          const editable = targets.filter((t) => !t.readOnly);
          if (editable.length === 0) {
            announce?.(`${named(targets)} cannot be cut`, "assertive");
            return "refused";
          }
          selection.cut(ids);
          announce?.(`${named(editable)} cut`);
          return true;
        }
      : undefined,
  });

  const onCanvasDoubleClick = useStableCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // the first click's pointer capture can retarget this event to the canvas: hit-test instead
    const direct = e.target as HTMLElement;
    const hit = direct.closest('[data-slot="timeline-row"], [data-cal-event]')
      ? direct
      : ((document.elementFromPoint?.(e.clientX, e.clientY) as HTMLElement | null) ?? direct);
    if (hit.closest("[data-cal-event]")) return;
    const row = hit.closest('[data-slot="timeline-row"]') as HTMLElement | null;
    const laneId = row?.dataset.lane;
    if (!row || !laneId) return;

    const rect = trackRef.current?.getBoundingClientRect() ?? row.getBoundingClientRect();
    const rawMin = createHorizontalAxis(zoomed).pxToMinutes(e.clientX - rect.left);
    const { startMin, endMin } = defaultBookingSpan(zoomed, rawMin, DEFAULT_QUICK_ADD_MIN);
    const span = slotForGesture(zoomed, startMin, endMin);
    if (!allows(constraints ?? NO_CONSTRAINTS, { gesture: "create", target: span })) return;

    const id = commitCreate({ laneId, startMin, endMin, start: span.start, end: span.end });
    onSelect?.(id, { isNew: true });
  });

  const revealNow = useStableCallback(() => {
    const scroll = scrollRef.current;
    if (!scroll || scroll.clientWidth === 0) return;
    const now = minutesFromStart(zoomed, Date.now());
    if (now < 0 || now > total) return;
    const visible = scroll.clientWidth - gutterFor(scroll.clientWidth);
    if (axis.extentPx <= visible) return;
    scroll.scrollLeft = Math.max(0, axis.toPx(now) - visible / 3);
  });
  // a window opens on the present, and so does landing back on today
  const anchorDay = anchorDate ? startOfLocalDay(anchorDate).getTime() : null;
  useLayoutEffect(() => {
    if (anchorDay !== null && anchorDay !== startOfLocalDay(new Date()).getTime()) return;
    revealNow();
  }, [startMs, endMs, anchorDay, revealNow]);

  // sticky header and gutter cover the scroller's top-left: keep focused bars clear of them
  const [headerHeight, setHeaderHeight] = useState(32);
  useLayoutEffect(() => {
    const h = headerRef.current?.offsetHeight;
    if (h) setHeaderHeight(h);
  }, [zoomed, gutterWidth]);

  return (
    <div className="flex h-full flex-col" data-slot="timeline" data-kloq-density={g.density}>
      <div
        ref={scrollRef}
        className="relative flex-1 overflow-auto"
        style={{ scrollPaddingLeft: gutterWidth, scrollPaddingTop: headerHeight }}
        data-slot="timeline-scroll"
      >
        <div className="relative min-w-full" style={{ width: gutterWidth + axis.extentPx }}>
          <div ref={headerRef} className="sticky top-0 z-10 bg-background">
            <C.TimelineHeader window={zoomed} locale={g.locale} gutterWidth={gutterWidth} />
          </div>
          {/* its own stacking context: bars, the draft and a lifted bar all stay under the sticky gutter */}
          <div className="relative z-0">
            <TimelineGrid
              lanes={lanes}
              from={0}
              to={lanes.length}
              events={all}
              window={zoomed}
              rowHeight={ROW_HEIGHT}
              barHeight={BAR_HEIGHT}
              canvasRef={canvasRef}
              trackRef={trackRef}
              registerNode={registerNode}
              onCanvasPointerDown={onCanvasPointerDown}
              onCanvasDoubleClick={onCanvasDoubleClick}
              onEventPointerDown={onEventPointerDown}
              onEventActivate={onEventActivate}
              selectedId={selectedId}
              workingHours={workingHours}
              rovingId={rovingId}
              onSelect={onSelect}
              commitCreate={commitCreate}
              gutterWidth={gutterWidth}
              gutterNarrow={gutterWidth < GUTTER_WIDTH}
            />
            {/* the draft's frame: the track's left edge, the canvas's top */}
            <div className="absolute top-0" style={{ left: gutterWidth }}>
              <div ref={draftRef} hidden data-cal-draft className="absolute z-30">
                <span aria-hidden data-slot="draft-bar" />
                <span data-slot="draft-label" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
