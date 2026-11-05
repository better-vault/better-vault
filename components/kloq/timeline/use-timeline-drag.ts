"use client";

/**
 * use-timeline-drag — the timeline's pointer state machine, parallel to the calendar's
 * use-drag-engine: one state object, one rAF loop, geometry written straight to DOM nodes
 * until drop, every frame published to `craft-bus`.
 */

import type React from "react";
import { useEffect, useState } from "react";
import { announceRefused, type RefusedGesture } from "../lib/announce";
import type { KloqAxis } from "../lib/axis";
import { DRAG_THRESHOLD_PX, type PlacedEvent } from "../lib/calendar-types";
import { allows, type Constraints, type DropRequest, NO_CONSTRAINTS } from "../lib/constraints";
import { craftBus, type DragFrame } from "../lib/craft-bus";
import { EASE, EDGE_MAX_V, EDGE_ZONE, TOUCH_CREATE_MIN } from "../lib/drag-engine/constants";
import { capturePointer, landCommit } from "../lib/drag-engine/dom";
import type { CommitResult } from "../lib/drag-engine/types";
import { autoScrollDelta } from "../lib/edge-autoscroll";
import { parseInstant } from "../lib/instant";
import type { Lane } from "../lib/lane";
import {
  beginLongPress,
  LONG_PRESS_MS,
  type LongPressState,
  longPressMove,
  longPressTick,
  wantsLongPress,
} from "../lib/long-press";
import type { PlacedOccurrence } from "../lib/projection";
import { prefersReducedMotion } from "../lib/springs";
import {
  createHorizontalAxis,
  instantAtMinute,
  minutesFromStart,
  type TimelineWindow,
} from "../lib/timeline-window";
import { useLatest } from "../lib/use-latest";
import { setCramped } from "./timeline-block";

export interface CreateDraftOptions {
  /** where the gesture started, in minutes from the window origin */
  anchorMin: number;
  /** where the pointer is now */
  pointerMin: number;
  /** snap step in minutes */
  snap: number;
  /** the shortest draft a gesture may produce */
  minDuration: number;
}

/**
 * The create gesture's span. Both edges snap; dragging backwards inverts
 * cleanly rather than collapsing; a barely-moved pointer still yields a
 * minimum-length draft on the side the pointer is heading.
 *
 * Frozen: this is the pure contract the tests verify byte-for-byte. It does
 * NOT clamp to the window — see `clampSpan` for that, applied by the caller.
 */
export function createDraft({ anchorMin, pointerMin, snap, minDuration }: CreateDraftOptions): {
  startMin: number;
  endMin: number;
} {
  const step = (m: number) => Math.round(m / snap) * snap;
  const a = step(anchorMin);
  const b = step(pointerMin);
  if (b > a) return { startMin: a, endMin: Math.max(b, a + minDuration) };
  if (b < a) return { startMin: Math.min(b, a - minDuration), endMin: a };
  return pointerMin < anchorMin
    ? { startMin: a - minDuration, endMin: a }
    : { startMin: a, endMin: a + minDuration };
}

/**
 * Holds a span inside `[lo, hi]`, one edge at a time — the same convention
 * `createSettings`'s `clampMinutes` uses for the calendar's create gesture
 * (`use-drag-engine.ts`'s `createTargets`, the `d.dayDelta === 0` branch).
 * `createDraft`'s minimum-duration floor can push an edge past the window
 * after snapping; this is what stops that draft being drawn off-canvas.
 */
export function clampSpan(
  span: { startMin: number; endMin: number },
  lo: number,
  hi: number,
): { startMin: number; endMin: number } {
  return {
    startMin: Math.max(lo, Math.min(span.startMin, hi)),
    endMin: Math.max(lo, Math.min(span.endMin, hi)),
  };
}

/**
 * The floor `finishCreate`/`finishMove` share before committing: the
 * calendar's `finishCreate` refuses to commit a span shorter than
 * `minEventMinutes` rather than let a clamped edge case (a window-edge
 * anchor, snapped past the window boundary) create a zero-minute booking.
 */
export function meetsMinDuration(
  span: { startMin: number; endMin: number },
  minDurationMinutes: number,
): boolean {
  return span.endMin - span.startMin >= minDurationMinutes;
}

export interface MoveTargetOptions {
  /** how far into the bar, in minutes, the pointer grabbed it */
  grabOffsetMin: number;
  pointerMin: number;
  /** the bar's length, preserved exactly across the move */
  duration: number;
  snap: number;
  /** the window's last minute */
  windowEndMin: number;
}

/**
 * A move preserves duration exactly and welds the grabbed point under the
 * pointer; only the start snaps, and the whole bar is held inside the window.
 */
export function moveTarget({
  grabOffsetMin,
  pointerMin,
  duration,
  snap,
  windowEndMin,
}: MoveTargetOptions): { startMin: number; endMin: number } {
  const raw = pointerMin - grabOffsetMin;
  const snapped = Math.round(raw / snap) * snap;
  const startMin = Math.max(0, Math.min(windowEndMin - duration, snapped));
  return { startMin, endMin: startMin + duration };
}

export interface ResizeTargetOptions {
  /** which edge the pointer grabbed */
  edge: "start" | "end";
  /** the edge that stays put, in minutes from the window origin */
  fixedMin: number;
  pointerMin: number;
  snap: number;
  minDuration: number;
}

/** A resize moves one edge, snaps it, and never collapses or inverts the bar. */
export function resizeTarget({
  edge,
  fixedMin,
  pointerMin,
  snap,
  minDuration,
}: ResizeTargetOptions): { startMin: number; endMin: number } {
  const snapped = Math.round(pointerMin / snap) * snap;
  return edge === "end"
    ? { startMin: fixedMin, endMin: Math.max(snapped, fixedMin + minDuration) }
    : { startMin: Math.min(snapped, fixedMin - minDuration), endMin: fixedMin };
}

/**
 * The window-relative span a gesture wants, as the `Date` pair the constraint
 * layer already speaks. Constraints need no timeline-specific code at all.
 */
export function slotForGesture(
  window: TimelineWindow,
  startMin: number,
  endMin: number,
): { start: Date; end: Date; allDay: false } {
  return {
    start: instantAtMinute(window, startMin),
    end: instantAtMinute(window, endMin),
    allDay: false,
  };
}

const DAY_MIN = 1440;

/**
 * An all-day bar moves by whole days, and only as far as it still shows inside
 * the window. `raw` is its real span in window minutes (a placement's own is
 * clipped to the window); returns the day shift actually allowed.
 */
export function clampDayShift(
  raw: { startMin: number; endMin: number },
  days: number,
  windowEndMin: number,
): number {
  const lo = Math.floor(-raw.endMin / DAY_MIN) + 1;
  const hi = Math.ceil((windowEndMin - raw.startMin) / DAY_MIN) - 1;
  if (lo > hi) return 0;
  return Math.max(lo, Math.min(hi, Math.trunc(days)));
}

/** An all-day resize: one edge moves by whole days, the bar keeps at least a day and stays in view. */
export function clampDayResize(
  raw: { startMin: number; endMin: number },
  edge: "start" | "end",
  days: number,
  windowEndMin: number,
): number {
  const want = Math.trunc(days);
  if (edge === "end") {
    const lo = Math.max(
      Math.ceil((raw.startMin + DAY_MIN - raw.endMin) / DAY_MIN),
      Math.floor(-raw.endMin / DAY_MIN) + 1,
    );
    return Math.max(lo, want);
  }
  const hi = Math.min(
    Math.floor((raw.endMin - DAY_MIN - raw.startMin) / DAY_MIN),
    Math.ceil((windowEndMin - raw.startMin) / DAY_MIN) - 1,
  );
  return Math.min(hi, want);
}

/** A placement's real span in window minutes, before the window clipped it. */
export function rawSpanOf(
  window: TimelineWindow,
  event: PlacedEvent,
): { startMin: number; endMin: number } {
  const placed = event as Partial<PlacedOccurrence>;
  const start = parseInstant(placed.start ?? event.source?.start ?? "");
  const end = parseInstant(placed.end ?? event.source?.end ?? "");
  if (Number.isNaN(start) || Number.isNaN(end))
    return { startMin: event.startMin, endMin: event.endMin };
  return { startMin: minutesFromStart(window, start), endMin: minutesFromStart(window, end) };
}

/** The row under a pointer, clamped to the ends rather than reporting -1. */
export function laneFromY(y: number, rect: DOMRect, laneTops: readonly number[]): number {
  const local = y - rect.top;
  let index = 0;
  for (let i = 0; i < laneTops.length; i += 1) {
    if (local >= laneTops[i]) index = i;
  }
  return Math.max(0, Math.min(laneTops.length - 1, index));
}

/** One row's vertical band, top-down. Lane heights vary, so this can't be a division. */
export interface RowBand {
  top: number;
  height: number;
}

/**
 * Cumulative (top, height) per lane. The one piece of geometry with no
 * calendar analogue: day columns divide evenly, but `Lane.height` (see
 * `../lib/lane.ts`) is declared per row and may be omitted (falls back to
 * `rowHeight`).
 */
export function rowOffsets(lanes: readonly Lane[], rowHeight: number): RowBand[] {
  let y = 0;
  return lanes.map((lane) => {
    const height = lane.height ?? rowHeight;
    const top = y;
    y += height;
    return { top, height };
  });
}

/** What the create gesture hands back on commit. */
export interface TimelineCreateInput {
  laneId: string;
  startMin: number;
  endMin: number;
  start: Date;
  end: Date;
}

export interface TimelineDragOpts {
  /** the scrollable canvas the rows are stacked into — its top is the y origin */
  canvasRef: React.RefObject<HTMLDivElement | null>;
  /**
   * the row track itself — the element `axis.toPx`'s 0 lines up with. NOT
   * `canvasRef`: `timeline-grid.tsx` puts the sticky resource gutter inside
   * the same element `canvasRef` points at, so `canvasRef`'s left edge is
   * `GUTTER_WIDTH` px to the left of where bars are actually drawn. Every
   * horizontal read and write in this engine is relative to `trackRef`;
   * `canvasRef` is used for the vertical (row) axis only.
   */
  trackRef: React.RefObject<HTMLElement | null>;
  /** the horizontally-scrolling ancestor auto-scroll nudges; omit to disable auto-scroll */
  scrollRef?: React.RefObject<HTMLElement | null>;
  /**
   * the draft node the component owns and places in its own DOM — the
   * controller ruling for this task: the hook writes to it, the component
   * mounts it. It must share `trackRef`'s horizontal origin and
   * `canvasRef`'s vertical origin (see `trackRef`'s doc).
   */
  draftRef: React.RefObject<HTMLElement | null>;
  window: TimelineWindow;
  /** resolved host drop constraints; defaults to `NO_CONSTRAINTS` (nothing refused) */
  constraints?: Constraints;
  lanes: readonly Lane[];
  /** first lane in view, inclusive — matches `TimelineGridProps.from`. Defaults to 0. */
  from?: number;
  /** last lane in view, exclusive — matches `TimelineGridProps.to`. Defaults to `lanes.length`. */
  to?: number;
  /** default row height for a lane that doesn't declare its own */
  rowHeight: number;
  snapMinutes: number;
  minDurationMinutes: number;
  /**
   * Window-relative minutes → the calendar-matching time-range label (the
   * same conversion `TimelineBlock`'s static render uses: `instantAtMinute`
   * through the display zone, then the settings' own formatter). Used to
   * keep `[data-slot="event-time"]` — and the create draft's own label — live
   * every frame during a drag, mirroring `../calendar/use-drag-engine.ts`'s
   * `timeEl` writes.
   */
  formatBarTime: (startMin: number, endMin: number) => string;
  /** commits the draft, returning the id of the created placement */
  commitCreate: (input: TimelineCreateInput) => string;
  /**
   * commits a move, including a cross-row reassignment — the engine always
   * reports the resolved `laneId`, even when it's unchanged, and leaves it to
   * the host to merge `adapter.assign` and no-op when the lane didn't move.
   * May return a promise: a rejected commit must revert the bar, which is why
   * this routes through the shared `landCommit` rather than settling eagerly.
   */
  commitMove: (
    id: string,
    patch: { laneId: string; startMin: number; endMin: number },
  ) => CommitResult;
  /**
   * commits a resize. Lane never changes for a resize, so unlike `commitMove`
   * the patch is time-only. May return a promise: a rejected commit must
   * revert the bar, which is why this routes through the shared `landCommit`
   * rather than settling eagerly.
   */
  commitResize: (id: string, patch: { startMin: number; endMin: number }) => CommitResult;
  /**
   * commits an all-day bar: each edge shifts by whole days, never by minutes,
   * so the booking stays all-day. Omit and all-day bars can only be clicked.
   */
  commitAllDay?: (
    id: string,
    patch: { laneId: string; startDays: number; endDays: number },
  ) => CommitResult;
  openEditor: (id: string) => void;
  /** fired on a plain click (no movement) on empty canvas */
  onCanvasClick?: (pos: { clientX: number; clientY: number }) => void;
  /**
   * live-region announcer for constraint refusals — one polite sentence when
   * a drag first enters refused territory, one assertive sentence on a
   * refused release. Omit for silence. Mirrors the calendar's
   * `DragEngineOpts.announce` (`../lib/drag-engine/types.ts`).
   */
  announce?: (message: string, politeness?: "polite" | "assertive") => void;
  /** where inside its row the draft is drawn — the sub-row the booking will land in; omit to fill the row */
  draftBand?: (
    laneIndex: number,
    span: { startMin: number; endMin: number },
  ) => { top: number; height: number } | null;
}

interface CreateDrag {
  kind: "create";
  pointerId: number;
  captureEl: HTMLElement;
  downX: number;
  downY: number;
  /** absolute index into `opts.lanes` (already offset by `from`) */
  laneIndex: number;
  /** the lane's vertical band, captured at pointerdown — row heights don't change mid-gesture */
  rowTop: number;
  rowHeight: number;
  anchorMin: number;
  moved: boolean;
  /** eased (visual) left/width in px, lerped toward the snapped target every frame */
  vLeft: number;
  vWidth: number;
  /** the draft's own `[data-slot="draft-label"]` node, cached once at pointerdown */
  labelEl: HTMLElement | null;
}

interface MoveDrag {
  kind: "move";
  pointerId: number;
  captureEl: HTMLElement;
  /** the real bar's own DOM node — the hook writes straight to it, same as the create draft */
  node: HTMLElement;
  event: PlacedEvent;
  downX: number;
  downY: number;
  /** how far into the bar, in minutes, the pointer grabbed it — captured at pointerdown */
  grabOffsetMin: number;
  /** the bar's length; preserved exactly across the move, so it never has to be recomputed */
  duration: number;
  /** the bar's own rendered height in px, captured at pointerdown (`node.getBoundingClientRect().height`) */
  height: number;
  /** row bands for the visible lane slice, captured at pointerdown */
  rows: RowBand[];
  /** first visible lane index, captured at pointerdown */
  from: number;
  /**
   * the bar's origin ROW TOP in the shared canvas frame — used ONLY to
   * compute the vertical translate delta, never written to the node
   * directly. The node's own `left`/`top` stay exactly what React gave it (a
   * sub-row offset inside its own lane's `TimelineRow`, not a
   * canvas-cumulative one); writing those frames' numbers straight into the
   * node's style, as an earlier round did, silently mixed the two coordinate
   * systems. Unlike the horizontal origin (see below), rows don't rescale
   * with zoom, so this is safe to cache as a px value.
   *
   * There is deliberately NO cached horizontal origin (`originLeft`/`width`
   * used to live here). Zoom can change `pxPerSlot` mid-gesture (the
   * calendar's zoom shortcuts are plain `keydown` listeners; pointer capture
   * does not block them), so a px value captured at pointerdown would go
   * stale the instant the scale changes while every OTHER read in this
   * engine rebuilds its axis fresh (`axis()` reads `optsRef.current.window`
   * live). The horizontal origin is re-derived every frame instead, from
   * `d.event.startMin` (a minute value, invariant under zoom) through the
   * live axis — see `originLeftOf`.
   */
  originTop: number;
  moved: boolean;
  /** eased (visual) translate delta in px, relative to `originLeft`/`originTop` */
  vDx: number;
  vDy: number;
  /** the bar's own `[data-slot="event-time"]` node; null for an all-day bar, whose label never changes */
  timeEl: HTMLElement | null;
  allDay: boolean;
  /** the real span behind a clipped all-day bar */
  raw: { startMin: number; endMin: number };
}

interface ResizeDrag {
  kind: "resize";
  pointerId: number;
  captureEl: HTMLElement;
  /** the real bar's own DOM node — the hook writes straight to it, same as move */
  node: HTMLElement;
  event: PlacedEvent;
  edge: "start" | "end";
  downX: number;
  downY: number;
  /** the edge that stays put, in window minutes — captured once at pointerdown */
  fixedMin: number;
  /**
   * how far into the moving edge's grab zone the pointer landed, in minutes
   * — captured at pointerdown, same idea as `MoveDrag.grabOffsetMin`. The
   * resize handle has width; without this, grabbing anywhere inside it
   * would jump the edge by up to a handle-width the instant the drag
   * engages, since the pure `resizeTarget` contract takes a raw pointer
   * minute with no notion of where inside the handle it was grabbed.
   */
  grabOffsetMin: number;
  /** the bar's row top, captured at pointerdown — a resize never changes lane */
  originTop: number;
  /**
   * NO cached `originLeft`/`originWidth` here either, for the same reason
   * `MoveDrag` doesn't cache one — see its doc. Both are re-derived per frame
   * from `d.event.startMin`/`endMin` (minutes, invariant under zoom) through
   * the live axis via `originLeftOf`/`originWidthOf`.
   */
  /** the bar's own rendered height in px, captured at pointerdown */
  height: number;
  moved: boolean;
  /** eased (visual) translate-x delta, relative to `originLeft` */
  vDx: number;
  /** eased (visual) width in px */
  vWidth: number;
  /** the bar's own `[data-slot="event-time"]` node; null for an all-day bar, whose label never changes */
  timeEl: HTMLElement | null;
  allDay: boolean;
  raw: { startMin: number; endMin: number };
}

type Drag = CreateDrag | MoveDrag | ResizeDrag;

interface Shared {
  drag: Drag | null;
  raf: number;
  pointer: { x: number; y: number };
  pointerType: string;
  press: LongPressState | null;
  reduced: boolean;
  /** the floor a long-press-armed touch create holds to (`TOUCH_CREATE_MIN`); 0 otherwise */
  holdSpan: number;
  /** is the in-flight target currently refused? drives `data-cal-refused` */
  refused: boolean;
  /** has the polite in-flight announcement already fired for this gesture? at most once */
  refusedSaid: boolean;
}

/** The resolved target of an in-flight move: snapped span, target lane, and its row band. */
interface MoveGeometry {
  span: { startMin: number; endMin: number };
  laneIndex: number;
  row: RowBand;
  /** px the bar travels along the axis */
  dx: number;
  /** whole days an all-day bar travels; 0 for a timed one */
  days: number;
}

/** A resize target: the span drawn, and for an all-day bar the day shift of each edge. */
interface ResizeGeometry {
  span: { startMin: number; endMin: number };
  /** what the constraints judge: `span` before the window clipped it */
  target: { startMin: number; endMin: number };
  startDays: number;
  endDays: number;
}

function createTimelineDragEngine(optsRef: { readonly current: TimelineDragOpts }) {
  const s: Shared = {
    drag: null,
    raf: 0,
    pointer: { x: 0, y: 0 },
    pointerType: "mouse",
    press: null,
    reduced: false,
    holdSpan: 0,
    refused: false,
    refusedSaid: false,
  };

  const isTouch = () => wantsLongPress(s.pointerType);

  // -- geometry --------------------------------------------------------------

  const axis = (): KloqAxis => createHorizontalAxis(optsRef.current.window);

  const canvasRect = () => optsRef.current.canvasRef.current?.getBoundingClientRect() ?? null;

  // falls back to canvasRect only so a missing trackRef degrades rather than throws;
  // the fallback still reproduces the old (wrong) frame, so callers should always wire trackRef
  const trackRect = () => optsRef.current.trackRef.current?.getBoundingClientRect() ?? canvasRect();

  const constraintsOf = () => optsRef.current.constraints ?? NO_CONSTRAINTS;

  /**
   * Builds the `DropRequest` a gesture's current span wants checked. `create`
   * gets no `origin`/`event` — `EXEMPTS_ORIGIN.create` is `false` and
   * `canDrop` is documented as never called on create (`lib/constraints.ts`),
   * so create's request must stay bare. `lane-move`/`lane-resize` carry the
   * event's own current span as `origin` (so a shrink or a change that
   * vacates refused time isn't refused just because the event already
   * overlapped it) and `event.source` (so a host `canDrop` sees the real
   * event, the only lane-aware refusal channel that exists).
   */
  function dropRequest(
    gesture: "create" | "lane-move" | "lane-resize",
    span: { startMin: number; endMin: number },
    event?: PlacedEvent,
  ): DropRequest {
    const w = optsRef.current.window;
    const target = slotForGesture(w, span.startMin, span.endMin);
    if (gesture === "create" || !event) return { gesture, target };
    if (event.allDay) {
      const raw = rawSpanOf(w, event);
      return {
        gesture,
        target: { ...target, allDay: true },
        origin: { ...slotForGesture(w, raw.startMin, raw.endMin), allDay: true },
        event: event.source,
      };
    }
    return {
      gesture,
      target,
      origin: slotForGesture(w, event.startMin, event.endMin),
      event: event.source,
    };
  }

  // the cursor/announce affordance for a refused in-flight target — same
  // shape as the calendar's `setRefused`/`refuseRelease` (`use-drag-engine.ts`)
  function setRefused(on: boolean, gesture: RefusedGesture, e?: PlacedEvent) {
    if (s.refused === on) return;
    s.refused = on;
    if (!on) {
      document.body.removeAttribute("data-cal-refused");
      return;
    }
    document.body.setAttribute("data-cal-refused", "");
    if (s.refusedSaid) return;
    s.refusedSaid = true;
    optsRef.current.announce?.(announceRefused(gesture, e));
  }

  function refuseRelease(gesture: RefusedGesture, e?: PlacedEvent) {
    optsRef.current.announce?.(announceRefused(gesture, e), "assertive");
  }

  function visibleLanes() {
    const { lanes, from = 0, to } = optsRef.current;
    return { from, lanes: lanes.slice(from, to ?? lanes.length) };
  }

  // -- publish / frame ---------------------------------------------------------

  function publish(type: "drag:start" | "drag:frame", frame: DragFrame) {
    craftBus.emit({ type, frame });
  }

  function endPublish(frame: DragFrame, cancelled: boolean) {
    craftBus.emit({ type: "drag:end", frame, cancelled });
  }

  function autoScroll() {
    const scroll = optsRef.current.scrollRef?.current;
    if (!scroll) return;
    const r = scroll.getBoundingClientRect();
    const dv = autoScrollDelta(r, s.pointer, "x", EDGE_ZONE, EDGE_MAX_V);
    if (dv !== 0) scroll.scrollLeft += dv;
  }

  // -- create flow -------------------------------------------------------------

  /** the snapped, window-clamped span the pointer names right now */
  function currentSpan(d: CreateDrag, a: KloqAxis) {
    const rect = trackRect();
    const rawPointerMin = rect ? a.pxToMinutes(s.pointer.x - rect.left) : d.anchorMin;
    const floor = Math.max(optsRef.current.minDurationMinutes, s.holdSpan);
    const raw = createDraft({
      anchorMin: d.anchorMin,
      pointerMin: a.clamp(rawPointerMin),
      snap: optsRef.current.snapMinutes,
      minDuration: floor,
    });
    const span = clampSpan(raw, a.startMin, a.endMin);
    setRefused(!allows(constraintsOf(), dropRequest("create", span)), "create");
    return span;
  }

  /** the published frame reflects the eased (visual) position, same as the calendar's `createFrame` */
  function createFrameOf(d: CreateDrag): DragFrame {
    const a = axis();
    const startMin = a.pxToMinutes(d.vLeft);
    const endMin = startMin + a.pxToDuration(d.vWidth);
    return {
      kind: "create",
      id: "draft",
      velocity: 0,
      rect: { x: d.vLeft, y: d.rowTop, width: d.vWidth, height: d.rowHeight },
      startMin: Math.round(startMin),
      endMin: Math.round(endMin),
      dayIndex: d.laneIndex,
      pointer: { ...s.pointer },
    };
  }

  function renderDraft(d: CreateDrag, span: { startMin: number; endMin: number }) {
    const node = optsRef.current.draftRef.current;
    if (!node) return;
    node.style.left = `${d.vLeft}px`;
    node.style.width = `${d.vWidth}px`;
    const band = optsRef.current.draftBand?.(d.laneIndex, span) ?? null;
    node.style.top = `${d.rowTop + (band?.top ?? 0)}px`;
    node.style.height = `${band?.height ?? d.rowHeight}px`;
    if (d.labelEl)
      d.labelEl.textContent = optsRef.current.formatBarTime(
        Math.round(span.startMin),
        Math.round(span.endMin),
      );
  }

  /**
   * The one lerp both gestures share: 0.38 per-frame toward `target`, settling
   * exactly once within 0.5px, snapping outright under reduced motion. Create
   * eases `vLeft`/`vWidth`, move eases `vDx`/`vDy` — same channel-at-a-time
   * shape, so this is the single place either one's easing curve lives.
   */
  function easeTo(current: number, target: number): number {
    if (s.reduced) return target;
    const next = current + (target - current) * EASE;
    return Math.abs(target - next) < 0.5 ? target : next;
  }

  /** eases `vLeft`/`vWidth` toward the snapped target, same 0.38 lerp + 0.5px settle as the calendar's create draft */
  function stepEase(d: CreateDrag, a: KloqAxis, span: { startMin: number; endMin: number }) {
    const targetLeft = a.toPx(span.startMin);
    const targetWidth = Math.max(2, a.durationToPx(span.endMin - span.startMin));
    d.vLeft = easeTo(d.vLeft, targetLeft);
    d.vWidth = easeTo(d.vWidth, targetWidth);
  }

  function engageCreate(d: CreateDrag) {
    d.moved = true;
    const a = axis();
    const span = currentSpan(d, a);
    d.vLeft = a.toPx(span.startMin);
    d.vWidth = Math.max(2, a.durationToPx(span.endMin - span.startMin));
    const node = optsRef.current.draftRef.current;
    if (node) {
      renderDraft(d, span);
      node.removeAttribute("hidden");
    }
    publish("drag:start", createFrameOf(d));
  }

  function stepCreate(d: CreateDrag) {
    autoScroll();
    const a = axis();
    const span = currentSpan(d, a);
    stepEase(d, a, span);
    renderDraft(d, span);
    publish("drag:frame", createFrameOf(d));
  }

  // a scroll (touch moved pre-arm) or Escape: nothing should be left behind
  function abandonCreate(d: CreateDrag) {
    cleanup(d);
    optsRef.current.draftRef.current?.setAttribute("hidden", "");
  }

  function finishCreate(d: CreateDrag, commit: boolean) {
    const a = axis();
    const span = currentSpan(d, a);
    const frame = createFrameOf(d);
    const node = optsRef.current.draftRef.current;
    const moved = d.moved;
    const wasClick = !moved;
    cleanup(d);

    if (!commit || !moved) {
      node?.setAttribute("hidden", "");
      endPublish(frame, true);
      if (wasClick) optsRef.current.onCanvasClick?.({ clientX: s.pointer.x, clientY: s.pointer.y });
      return;
    }

    const lane = optsRef.current.lanes[d.laneIndex];
    const ok = allows(constraintsOf(), dropRequest("create", span));
    if (!lane || !meetsMinDuration(span, optsRef.current.minDurationMinutes) || !ok) {
      // nothing to commit onto, too short, or refused by the host — a cancel, not a silent success
      node?.setAttribute("hidden", "");
      endPublish(frame, true);
      if (!ok) refuseRelease("create");
      return;
    }

    const w = optsRef.current.window;
    const id = optsRef.current.commitCreate({
      laneId: lane.id,
      startMin: span.startMin,
      endMin: span.endMin,
      start: instantAtMinute(w, span.startMin),
      end: instantAtMinute(w, span.endMin),
    });
    endPublish(frame, false);
    // let the real bar paint before the draft disappears, same as the calendar's finishCreate
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        node?.setAttribute("hidden", "");
        optsRef.current.openEditor(id);
      }),
    );
  }

  // -- move flow -----------------------------------------------------------

  /**
   * The horizontal origin `MoveDrag`/`ResizeDrag` translate deltas are
   * relative to, re-derived from the event's own (minute-valued, zoom-
   * invariant) `startMin` through the LIVE axis every time it's needed —
   * never cached in px. Caching it in px at pointerdown was the bug: zoom's
   * `⌘.`/`⌘,` shortcuts fire on plain `keydown`, which pointer capture does
   * not block, so a px origin captured under the old scale would silently
   * disagree with a freshly-rebuilt-axis target for the rest of the gesture.
   */
  function originLeftOf(a: KloqAxis, startMin: number): number {
    return a.toPx(startMin);
  }

  /** Same reasoning as `originLeftOf`, for a bar's width. */
  function originWidthOf(a: KloqAxis, startMin: number, endMin: number): number {
    return Math.max(2, a.durationToPx(endMin - startMin));
  }

  /**
   * The target span, row and absolute lane index the pointer currently
   * names. A missing `trackRect()`/`canvasRect()` (component torn down
   * mid-drag) falls back to holding the bar exactly at its origin — the same
   * "hold still" shape `currentSpan` uses (falling back to `d.anchorMin`) —
   * rather than resolving to the window/lane-0 origin, which would read as a
   * teleport.
   */
  function moveGeometry(d: MoveDrag, a: KloqAxis): MoveGeometry {
    const trackR = trackRect();
    const rawPointerMin = trackR
      ? a.pxToMinutes(s.pointer.x - trackR.left)
      : d.event.startMin + d.grabOffsetMin;
    const days = d.allDay
      ? clampDayShift(
          d.raw,
          Math.round((rawPointerMin - d.grabOffsetMin - d.event.startMin) / DAY_MIN),
          a.endMin,
        )
      : 0;
    const span = d.allDay
      ? { startMin: d.raw.startMin + days * DAY_MIN, endMin: d.raw.endMin + days * DAY_MIN }
      : moveTarget({
          grabOffsetMin: d.grabOffsetMin,
          pointerMin: rawPointerMin,
          duration: d.duration,
          snap: optsRef.current.snapMinutes,
          windowEndMin: a.endMin,
        });
    const dx = d.allDay
      ? a.durationToPx(days * DAY_MIN)
      : a.toPx(span.startMin) - originLeftOf(a, d.event.startMin);
    const canvasR = canvasRect();
    const laneTops = d.rows.map((row) => row.top);
    const originRel = d.event.laneIndex - d.from;
    const rel =
      canvasR && laneTops.length > 0 ? laneFromY(s.pointer.y, canvasR, laneTops) : originRel;
    const row = d.rows[rel] ?? { top: d.originTop, height: optsRef.current.rowHeight };
    setRefused(!allows(constraintsOf(), dropRequest("lane-move", span, d.event)), "move", d.event);
    return { span, laneIndex: d.from + rel, row, dx, days };
  }

  function moveFrameOf(d: MoveDrag, geo: MoveGeometry, a: KloqAxis): DragFrame {
    const originLeft = originLeftOf(a, d.event.startMin);
    const width = originWidthOf(a, d.event.startMin, d.event.endMin);
    return {
      kind: "move",
      id: d.event.id,
      velocity: 0,
      // the bar's OWN height, not the (taller, sub-row-stacking) lane band
      rect: { x: originLeft + d.vDx, y: d.originTop + d.vDy, width, height: d.height },
      startMin: Math.round(geo.span.startMin),
      endMin: Math.round(geo.span.endMin),
      dayIndex: geo.laneIndex,
      pointer: { ...s.pointer },
    };
  }

  /**
   * Moves the node by a translate delta from wherever React put it — never by
   * writing an absolute `left`/`top`. `left`/`top` are expressed in the
   * node's own offset parent (its lane's `TimelineRow`, sub-row-relative);
   * `originLeft`/`originTop` and the row tops `moveGeometry` resolves against
   * are canvas/track-cumulative. A translate delta is frame-agnostic — it
   * shifts the rendered box by that many px regardless of which coordinate
   * system produced the number — so this sidesteps the mismatch entirely,
   * the same way the calendar's move (`use-drag-engine.ts`) never has to
   * reason about a node's containing block.
   */
  function renderMove(d: MoveDrag, span: { startMin: number; endMin: number }) {
    d.node.style.transform = `translate(${d.vDx}px, ${d.vDy}px)`;
    if (d.timeEl)
      d.timeEl.textContent = optsRef.current.formatBarTime(
        Math.round(span.startMin),
        Math.round(span.endMin),
      );
  }

  function engageMove(d: MoveDrag) {
    d.moved = true;
    const a = axis();
    const geo = moveGeometry(d, a);
    d.vDx = geo.dx;
    d.vDy = geo.row.top - d.originTop;
    d.node.setAttribute("data-dragging", "");
    renderMove(d, geo.span);
    publish("drag:start", moveFrameOf(d, geo, a));
  }

  function stepMove(d: MoveDrag) {
    autoScroll();
    const a = axis();
    const geo = moveGeometry(d, a);
    d.vDx = easeTo(d.vDx, geo.dx);
    d.vDy = easeTo(d.vDy, geo.row.top - d.originTop);
    renderMove(d, geo.span);
    publish("drag:frame", moveFrameOf(d, geo, a));
  }

  function abandonMove(d: MoveDrag) {
    cleanup(d);
  }

  /**
   * Snaps the bar back to exactly where the gesture grabbed it — a click, a
   * cancel, a refusal, or a rejected commit. Clearing the transform is exact
   * by construction: it never depended on which frame `left`/`top` live in.
   */
  function restoreMove(d: MoveDrag) {
    d.node.style.transform = "";
    d.node.removeAttribute("data-dragging");
    if (d.timeEl)
      d.timeEl.textContent = optsRef.current.formatBarTime(d.event.startMin, d.event.endMin);
  }

  function finishMove(d: MoveDrag, commit: boolean) {
    const a = axis();
    const geo = moveGeometry(d, a);
    const frame = moveFrameOf(d, geo, a);
    const moved = d.moved;
    cleanup(d);

    if (!commit || !moved) {
      restoreMove(d);
      endPublish(frame, true);
      return;
    }

    const lane = optsRef.current.lanes[geo.laneIndex];
    const ok = allows(constraintsOf(), dropRequest("lane-move", geo.span, d.event));
    const commitAllDay = optsRef.current.commitAllDay;
    const stayed = d.allDay && geo.days === 0 && geo.laneIndex === d.event.laneIndex;
    if (
      !lane ||
      !ok ||
      stayed ||
      (d.allDay ? !commitAllDay : !meetsMinDuration(geo.span, optsRef.current.minDurationMinutes))
    ) {
      restoreMove(d);
      endPublish(frame, true);
      if (!ok || (d.allDay && !commitAllDay)) refuseRelease("move", d.event);
      return;
    }

    const result =
      d.allDay && commitAllDay
        ? commitAllDay(d.event.id, { laneId: lane.id, startDays: geo.days, endDays: geo.days })
        : optsRef.current.commitMove(d.event.id, {
            laneId: lane.id,
            startMin: geo.span.startMin,
            endMin: geo.span.endMin,
          });
    endPublish(frame, false);
    landCommit(
      result,
      () => {
        // the host's next render will confirm with real left/top/lane props;
        // clearing the transform here just stops double-applying the delta
        d.node.style.transform = "";
        d.node.removeAttribute("data-dragging");
      },
      () => restoreMove(d),
    );
  }

  // -- resize flow -----------------------------------------------------------

  /**
   * The snapped, window-clamped span the pointer names right now. Subtracts
   * `grabOffsetMin` before handing the pointer minute to the pure
   * `resizeTarget` (whose frozen contract has no notion of a grab offset) —
   * the same weld-the-grabbed-point idea `moveTarget` bakes in directly,
   * applied at the call site instead since `resizeTarget`'s signature can't
   * change.
   */
  function resizeGeometry(d: ResizeDrag, a: KloqAxis): ResizeGeometry {
    const rect = trackRect();
    if (d.allDay) {
      const edgeMin = d.edge === "end" ? d.event.endMin : d.event.startMin;
      const pointerMin = rect ? a.pxToMinutes(s.pointer.x - rect.left) - d.grabOffsetMin : edgeMin;
      const days = clampDayResize(
        d.raw,
        d.edge,
        Math.round((pointerMin - edgeMin) / DAY_MIN),
        a.endMin,
      );
      const startDays = d.edge === "start" ? days : 0;
      const endDays = d.edge === "end" ? days : 0;
      const target = {
        startMin: d.raw.startMin + startDays * DAY_MIN,
        endMin: d.raw.endMin + endDays * DAY_MIN,
      };
      setRefused(
        !allows(constraintsOf(), dropRequest("lane-resize", target, d.event)),
        "resize",
        d.event,
      );
      return { span: clampSpan(target, a.startMin, a.endMin), target, startDays, endDays };
    }
    const rawPointerMin = rect
      ? a.pxToMinutes(s.pointer.x - rect.left) - d.grabOffsetMin
      : d.fixedMin;
    const raw = resizeTarget({
      edge: d.edge,
      fixedMin: d.fixedMin,
      pointerMin: a.clamp(rawPointerMin),
      snap: optsRef.current.snapMinutes,
      minDuration: optsRef.current.minDurationMinutes,
    });
    const span = clampSpan(raw, a.startMin, a.endMin);
    setRefused(
      !allows(constraintsOf(), dropRequest("lane-resize", span, d.event)),
      "resize",
      d.event,
    );
    return { span, target: span, startDays: 0, endDays: 0 };
  }

  function resizeFrameOf(
    d: ResizeDrag,
    span: { startMin: number; endMin: number },
    a: KloqAxis,
  ): DragFrame {
    const originLeft = originLeftOf(a, d.event.startMin);
    return {
      kind: d.edge === "start" ? "resize-start" : "resize-end",
      id: d.event.id,
      velocity: 0,
      rect: { x: originLeft + d.vDx, y: d.originTop, width: d.vWidth, height: d.height },
      startMin: Math.round(span.startMin),
      endMin: Math.round(span.endMin),
      dayIndex: d.event.laneIndex,
      pointer: { ...s.pointer },
    };
  }

  /**
   * Moves and sizes the node by a translate delta and a direct width write —
   * never an absolute `left`. `left` stays exactly what React gave it, same
   * as the move gesture; a translate delta is frame-agnostic, so it sidesteps
   * the canvas/track-vs-node-offset-parent mismatch entirely. Width has no
   * such mismatch (it isn't relative to any origin), so it's written
   * straight through.
   */
  function renderResize(d: ResizeDrag, span: { startMin: number; endMin: number }) {
    d.node.style.transform = `translate(${d.vDx}px, 0)`;
    d.node.style.width = `${d.vWidth}px`;
    setCramped(d.node, d.vWidth);
    if (d.timeEl)
      d.timeEl.textContent = optsRef.current.formatBarTime(
        Math.round(span.startMin),
        Math.round(span.endMin),
      );
  }

  function engageResize(d: ResizeDrag) {
    d.moved = true;
    const a = axis();
    const { span } = resizeGeometry(d, a);
    d.vDx = a.toPx(span.startMin) - originLeftOf(a, d.event.startMin);
    d.vWidth = Math.max(2, a.durationToPx(span.endMin - span.startMin));
    d.node.setAttribute("data-resizing", "");
    renderResize(d, span);
    publish("drag:start", resizeFrameOf(d, span, a));
  }

  function stepResize(d: ResizeDrag) {
    autoScroll();
    const a = axis();
    const { span } = resizeGeometry(d, a);
    d.vDx = easeTo(d.vDx, a.toPx(span.startMin) - originLeftOf(a, d.event.startMin));
    d.vWidth = easeTo(d.vWidth, Math.max(2, a.durationToPx(span.endMin - span.startMin)));
    renderResize(d, span);
    publish("drag:frame", resizeFrameOf(d, span, a));
  }

  function abandonResize(d: ResizeDrag) {
    cleanup(d);
  }

  /**
   * Snaps the bar back to exactly where the gesture grabbed it — a cancel, a
   * refusal, or a rejected commit. Clearing the transform is exact for the
   * same reason `restoreMove` is; the width has no ambient "cleared" value
   * (an unset width on an absolutely positioned node isn't the original box),
   * so it's restored to the exact px captured at pointerdown instead.
   */
  function restoreResize(d: ResizeDrag) {
    d.node.style.transform = "";
    // re-derived from the live axis, not a px value cached at pointerdown —
    // a rejected commit's restore can land well after a mid-gesture zoom
    // change, and the original width must be drawn at the CURRENT scale
    const width = originWidthOf(axis(), d.event.startMin, d.event.endMin);
    d.node.style.width = `${width}px`;
    setCramped(d.node, width);
    d.node.removeAttribute("data-resizing");
    if (d.timeEl)
      d.timeEl.textContent = optsRef.current.formatBarTime(d.event.startMin, d.event.endMin);
  }

  function finishResize(d: ResizeDrag, commit: boolean) {
    const a = axis();
    const geo = resizeGeometry(d, a);
    const span = geo.span;
    const frame = resizeFrameOf(d, span, a);
    const moved = d.moved;
    cleanup(d);

    if (!commit || !moved) {
      restoreResize(d);
      endPublish(frame, true);
      return;
    }

    const ok = allows(constraintsOf(), dropRequest("lane-resize", geo.target, d.event));
    const commitAllDay = optsRef.current.commitAllDay;
    const lane = optsRef.current.lanes[d.event.laneIndex];
    const stayed = d.allDay && geo.startDays === 0 && geo.endDays === 0;
    if (
      !ok ||
      stayed ||
      (d.allDay
        ? !commitAllDay || !lane
        : !meetsMinDuration(span, optsRef.current.minDurationMinutes))
    ) {
      restoreResize(d);
      endPublish(frame, true);
      if (!ok || (d.allDay && !stayed)) refuseRelease("resize", d.event);
      return;
    }

    const result =
      d.allDay && commitAllDay && lane
        ? commitAllDay(d.event.id, {
            laneId: lane.id,
            startDays: geo.startDays,
            endDays: geo.endDays,
          })
        : optsRef.current.commitResize(d.event.id, {
            startMin: span.startMin,
            endMin: span.endMin,
          });
    endPublish(frame, false);
    // the concrete committed width — `width` is a React-managed style
    // (`TimelineBlock`'s `style={{ left, width, top, height }}`), and React
    // only rewrites it when the computed value CHANGES, so a settle that
    // resolves to the identical span (or a host that no-ops the commit)
    // would otherwise leave the node with no inline width at all and it
    // collapses to content width. Never clear it to "".
    const settledWidth = Math.max(2, a.durationToPx(span.endMin - span.startMin));
    landCommit(
      result,
      () => {
        // the host's next render will confirm with real left/width props;
        // clearing the transform here just stops double-applying the drag's
        // own write — `transform` is never React-managed, so "" is safe there
        d.node.style.transform = "";
        d.node.style.width = `${settledWidth}px`;
        setCramped(d.node, settledWidth);
        d.node.removeAttribute("data-resizing");
      },
      () => restoreResize(d),
    );
  }

  // -- shared lifecycle -----------------------------------------------------

  function engage(d: Drag) {
    if (d.kind === "create") engageCreate(d);
    else if (d.kind === "move") engageMove(d);
    else engageResize(d);
  }

  function step(d: Drag) {
    if (d.kind === "create") stepCreate(d);
    else if (d.kind === "move") stepMove(d);
    else stepResize(d);
  }

  function abandon(d: Drag) {
    if (d.kind === "create") abandonCreate(d);
    else if (d.kind === "move") abandonMove(d);
    else abandonResize(d);
  }

  // a plain click (no movement) on an existing bar reuses `openEditor` — the
  // same hook `finishCreate` calls after a successful create — rather than a
  // dedicated selection callback, matching the calendar engine's own onUp
  // dispatch (`../calendar/use-drag-engine.ts`), which opens the same way on
  // a click whether the block is new or pre-existing.
  function finish(d: Drag, commit: boolean) {
    if (d.kind === "create") {
      finishCreate(d, commit);
      return;
    }
    const wasClick = !d.moved;
    const event = d.event;
    if (d.kind === "move") finishMove(d, commit);
    else finishResize(d, commit);
    if (wasClick) optsRef.current.openEditor(event.id);
  }

  function cleanup(d: Drag) {
    stopLoop();
    s.drag = null;
    s.press = null;
    s.holdSpan = 0;
    s.refused = false;
    s.refusedSaid = false;
    document.body.removeAttribute("data-cal-refused");
    try {
      d.captureEl.releasePointerCapture(d.pointerId);
    } catch {
      /* already released */
    }
  }

  // -- rAF loop ----------------------------------------------------------------

  function tick() {
    const d = s.drag;
    if (!d) return;

    // the long-press clock rides the rAF loop, same as the calendar engine —
    // the arming instant and the frame that engages the drag are the same frame
    if (s.press) {
      const next = longPressTick(s.press, performance.now());
      if (next !== s.press) {
        s.press = next;
        if (next.phase === "armed") {
          // what a long-press create makes when you lift without dragging further
          if (d.kind === "create") s.holdSpan = TOUCH_CREATE_MIN;
          engage(d);
          if (!s.drag) return;
        }
      }
    }

    if (d.moved) step(d);
    s.raf = requestAnimationFrame(tick);
  }

  function startLoop() {
    cancelAnimationFrame(s.raf);
    s.raf = requestAnimationFrame(tick);
  }

  function stopLoop() {
    cancelAnimationFrame(s.raf);
    s.raf = 0;
  }

  // -- pointerdown -----------------------------------------------------------

  const onCanvasPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || e.ctrlKey || s.drag) return;
    // `[data-cal-more]`: the overflow control (`timeline-row.tsx`'s
    // `TimelineMoreButton`) sits inside the canvas the same way a bar does.
    // Without this exclusion, the very pointerdown that opens it also arms a
    // create-drag and captures the pointer onto the canvas, so the click the
    // popover needs never reaches it — same failure mode `[data-cal-event]`
    // is already excluded from.
    if ((e.target as HTMLElement).closest("[data-cal-event], [data-cal-more]")) return;
    const canvasR = canvasRect();
    if (!canvasR) return;
    const trackR = trackRect();
    const el = e.currentTarget;
    // explicit capture on touch too — implicit capture doesn't survive a rebuilt canvas
    capturePointer(el, e.pointerId);
    s.reduced = prefersReducedMotion();
    s.pointerType = e.pointerType || "mouse";
    s.holdSpan = 0;
    s.pointer = { x: e.clientX, y: e.clientY };

    const { from, lanes } = visibleLanes();
    const rows = rowOffsets(lanes, optsRef.current.rowHeight);
    const rel = laneFromY(
      e.clientY,
      canvasR,
      rows.map((r) => r.top),
    );
    const row = rows[rel] ?? { top: 0, height: optsRef.current.rowHeight };
    const a = axis();
    const anchorMin = trackR ? a.clamp(a.pxToMinutes(e.clientX - trackR.left)) : a.startMin;

    const d: CreateDrag = {
      kind: "create",
      pointerId: e.pointerId,
      captureEl: el,
      downX: e.clientX,
      downY: e.clientY,
      laneIndex: from + rel,
      rowTop: row.top,
      rowHeight: row.height,
      anchorMin,
      moved: false,
      vLeft: 0,
      vWidth: 0,
      labelEl:
        optsRef.current.draftRef.current?.querySelector<HTMLElement>('[data-slot="draft-label"]') ??
        null,
    };
    s.drag = d;
    s.press = isTouch()
      ? beginLongPress(e.clientX, e.clientY, performance.now(), {
          delayMs: LONG_PRESS_MS,
          movePx: DRAG_THRESHOLD_PX,
        })
      : null;
    startLoop();
  };

  const onEventPointerDown = (e: React.PointerEvent<HTMLElement>, event: PlacedEvent) => {
    e.stopPropagation();
    if (e.button !== 0 || e.ctrlKey || s.drag) return;
    // read-only: a click still selects, nothing drags
    if (event.readOnly) {
      const el = e.currentTarget;
      const downX = e.clientX;
      const downY = e.clientY;
      const onUp = (ev: PointerEvent) => {
        el.removeEventListener("pointerup", onUp);
        el.removeEventListener("pointercancel", onUp);
        if (ev.type !== "pointerup") return;
        if (Math.hypot(ev.clientX - downX, ev.clientY - downY) < DRAG_THRESHOLD_PX)
          optsRef.current.openEditor(event.id);
      };
      el.addEventListener("pointerup", onUp);
      el.addEventListener("pointercancel", onUp);
      return;
    }
    const canvasR = canvasRect();
    if (!canvasR) return;
    const trackR = trackRect();
    const node = e.currentTarget;
    capturePointer(node, e.pointerId);
    s.reduced = prefersReducedMotion();
    s.pointerType = e.pointerType || "mouse";
    s.holdSpan = 0;
    s.pointer = { x: e.clientX, y: e.clientY };

    const { from, lanes } = visibleLanes();
    const rows = rowOffsets(lanes, optsRef.current.rowHeight);
    const rel = event.laneIndex - from;
    const row = rows[rel] ?? { top: 0, height: optsRef.current.rowHeight };
    const a = axis();
    const allDay = event.allDay === true;
    const raw = rawSpanOf(optsRef.current.window, event);
    // an all-day bar keeps its label: the engine never writes a clock time into it
    const timeEl = allDay ? null : node.querySelector<HTMLElement>('[data-slot="event-time"]');

    const edgeEl = (e.target as HTMLElement).closest?.("[data-resize-edge]");
    const edge = edgeEl?.getAttribute("data-resize-edge");
    if (edge === "start" || edge === "end") {
      // welds the grabbed point on the handle to the moving edge, same idea
      // as the move gesture's `grabOffsetMin` — see `resizeGeometry`'s doc
      const movingEdgeMin = edge === "end" ? event.endMin : event.startMin;
      const pointerMinAtDown = trackR ? a.pxToMinutes(e.clientX - trackR.left) : movingEdgeMin;
      const r: ResizeDrag = {
        kind: "resize",
        pointerId: e.pointerId,
        captureEl: node,
        node,
        event,
        edge,
        downX: e.clientX,
        downY: e.clientY,
        fixedMin: edge === "end" ? event.startMin : event.endMin,
        grabOffsetMin: pointerMinAtDown - movingEdgeMin,
        originTop: row.top,
        height: node.getBoundingClientRect().height,
        moved: false,
        vDx: 0,
        vWidth: 0,
        timeEl,
        allDay,
        raw,
      };
      s.drag = r;
      s.press = isTouch()
        ? beginLongPress(e.clientX, e.clientY, performance.now(), {
            delayMs: LONG_PRESS_MS,
            movePx: DRAG_THRESHOLD_PX,
          })
        : null;
      startLoop();
      return;
    }

    const pointerMin = trackR ? a.pxToMinutes(e.clientX - trackR.left) : event.startMin;

    const d: MoveDrag = {
      kind: "move",
      pointerId: e.pointerId,
      captureEl: node,
      node,
      event,
      downX: e.clientX,
      downY: e.clientY,
      grabOffsetMin: pointerMin - event.startMin,
      duration: event.endMin - event.startMin,
      height: node.getBoundingClientRect().height,
      rows,
      from,
      originTop: row.top,
      moved: false,
      vDx: 0,
      vDy: 0,
      timeEl,
      allDay,
      raw,
    };
    s.drag = d;
    s.press = isTouch()
      ? beginLongPress(e.clientX, e.clientY, performance.now(), {
          delayMs: LONG_PRESS_MS,
          movePx: DRAG_THRESHOLD_PX,
        })
      : null;
    startLoop();
  };

  // -- global listeners --------------------------------------------------------

  const attach = () => {
    function onMove(e: PointerEvent) {
      const d = s.drag;
      if (!d || e.pointerId !== d.pointerId) return;
      s.pointer = { x: e.clientX, y: e.clientY };

      if (s.press) {
        const next = longPressMove(s.press, e.clientX, e.clientY);
        if (next !== s.press) {
          s.press = next;
          if (next.phase === "cancelled") {
            abandon(d);
            return;
          }
        }
        // touch waits for the hold to arm; movement alone never starts the drag
        return;
      }

      if (!d.moved) {
        const dist = Math.hypot(e.clientX - d.downX, e.clientY - d.downY);
        if (dist >= DRAG_THRESHOLD_PX) engage(d);
      }
    }

    function onUp(e: PointerEvent) {
      const d = s.drag;
      if (!d || e.pointerId !== d.pointerId) return;
      finish(d, true);
    }

    function onCancel(e: PointerEvent) {
      const d = s.drag;
      if (!d || e.pointerId !== d.pointerId) return;
      if (!d.moved) abandon(d);
      else finish(d, false);
    }

    function onKey(e: KeyboardEvent) {
      const d = s.drag;
      if (!d) return;
      if (e.key === "Escape" && e.type === "keydown") {
        e.preventDefault();
        e.stopImmediatePropagation();
        // Escape must never select: on an unmoved press this ends the
        // gesture the same way `onCancel` does, skipping the wasClick ->
        // openEditor path in `finish` entirely.
        if (!d.moved) abandon(d);
        else finish(d, false);
      }
    }

    // capture-phase stopPropagation keeps base-ui's long-press timer from starting on empty canvas
    function onTouchStartCapture(e: TouchEvent) {
      const t = e.target as HTMLElement | null;
      if (!t?.closest) return;
      if (t.closest("[data-cal-event]")) return;
      e.stopPropagation();
    }

    // touch-action can't change for a touch in flight; a non-passive touchmove preventDefault
    // can. Without this a long-press create races the browser's own horizontal pan.
    function onTouchMove(e: TouchEvent) {
      const d = s.drag;
      if (!d || !isTouch()) return;
      if (s.press?.phase === "pending") return;
      if (d.moved && e.cancelable) e.preventDefault();
    }

    // every gesture starts on the canvas, so the non-passive listener lives there, not on the page
    const canvas = optsRef.current.canvasRef.current;
    canvas?.addEventListener("touchstart", onTouchStartCapture, { capture: true });
    canvas?.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    // capture phase: the engine must see Escape before a focused element can swallow it
    window.addEventListener("keydown", onKey, { capture: true });

    return () => {
      canvas?.removeEventListener("touchstart", onTouchStartCapture, { capture: true });
      canvas?.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      window.removeEventListener("keydown", onKey, { capture: true });
      stopLoop();
    };
  };

  return { onCanvasPointerDown, onEventPointerDown, attach };
}

export type TimelineDragEngine = ReturnType<typeof createTimelineDragEngine>;

/** One engine per mount; options are read through a ref, so nothing here re-renders or re-binds. */
export function useTimelineDrag(opts: TimelineDragOpts) {
  const optsRef = useLatest(opts);
  const [engine] = useState(() => createTimelineDragEngine(optsRef));
  useEffect(() => engine.attach(), [engine]);
  return {
    onCanvasPointerDown: engine.onCanvasPointerDown,
    onEventPointerDown: engine.onEventPointerDown,
  };
}
