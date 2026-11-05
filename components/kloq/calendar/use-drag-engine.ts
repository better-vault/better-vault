"use client";

/**
 * use-drag-engine — the pointer state machine behind every calendar gesture.
 * One state object, one rAF loop, direct DOM writes; React sees nothing until drop.
 */

import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { announceRefused, type RefusedGesture } from "../lib/announce";
import {
  DRAG_THRESHOLD_PX,
  formatDaySpan,
  type PlacedEvent,
  snapMinutes,
} from "../lib/calendar-types";
import {
  allDaySlot,
  allows,
  type ConstraintGesture,
  type DropRequest,
  NO_CONSTRAINTS,
  timedSlot,
} from "../lib/constraints";
import { craftBus, type DragFrame, type DragKind } from "../lib/craft-bus";
import { MINUTES_PER_DAY } from "../lib/date-math";
import {
  ALIGN_PX,
  BASEUI_LONG_PRESS_MOVE_PX,
  EASE,
  EDGE_MAX_V,
  EDGE_ZONE,
  LABEL_FLIP_H,
  LANE_ROW_H,
  RESIZE_PUSH,
  TOUCH_CREATE_MIN,
  TOUCH_THRESHOLD_PX,
} from "../lib/drag-engine/constants";
import {
  animateAll,
  capturePointer,
  LIFT_REST,
  landCommit,
  liftFrom,
  segmentSiblings,
  setTransformAll,
  springHomeFrom,
} from "../lib/drag-engine/dom";
import type {
  CreateDrag,
  Drag,
  DragEngineOpts,
  LaneCreateDrag,
  LaneMoveDrag,
  LaneResizeDrag,
  MoveDrag,
  PressMode,
  ResizeDrag,
  Shared,
} from "../lib/drag-engine/types";
import {
  createJiggle,
  JIGGLE_REST,
  jiggleAtRest,
  jiggleTransform,
  kickJiggle,
  liftOf,
  stepJiggle,
} from "../lib/drag-physics";
import { autoScrollDelta } from "../lib/edge-autoscroll";
import {
  beginLongPress,
  LONG_PRESS_MS,
  longPressMove,
  longPressProgress,
  longPressTick,
  wantsLongPress,
} from "../lib/long-press";
import { ms, prefersReducedMotion, RESIZE_SPRING, SPRING, SPRING_MS } from "../lib/springs";
import { useLatest } from "../lib/use-latest";

export type { CommitResult } from "../lib/drag-engine/types";

function createDragEngine(optsRef: { readonly current: DragEngineOpts }) {
  const s: Shared = {
    drag: null,
    raf: 0,
    pointer: { x: 0, y: 0 },
    lastPointer: { x: 0, y: 0, t: 0 },
    velocity: 0,
    vx: 0,
    vy: 0,
    altHeld: false,
    reduced: false,
    pointerType: "mouse",
    press: null,
    pressMode: null,
    holdSpan: 0,
    scale: 0,
    refused: false,
    refusedSaid: false,
    alignCands: null,
  };

  const vc = () => optsRef.current.view.dayCount;

  const g = () => optsRef.current.settings;

  // -- geometry ------------------------------------------------------------

  const geom = () => {
    const canvas = optsRef.current.canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const colWidth = rect.width / vc();
    return { canvas, rect, colWidth };
  };

  const laneGeom = () => {
    const lane = optsRef.current.laneRef.current!;
    const rect = lane.getBoundingClientRect();
    const colWidth = rect.width / vc();
    return { lane, rect, colWidth };
  };

  const dayFromX = (x: number, rect: DOMRect, colWidth: number) =>
    Math.max(0, Math.min(vc() - 1, Math.floor((x - rect.left) / colWidth)));

  const spanPx = (startDay: number, endDay: number, colWidth: number) => ({
    left: startDay * colWidth + 2,
    width: (endDay - startDay + 1) * colWidth - 5,
  });

  /** the React-managed calc() styles a chip must be restored to */
  const chipStyles = (startDay: number, endDay: number) => ({
    left: `calc(${(startDay / vc()) * 100}% + 2px)`,
    width: `calc(${((endDay - startDay + 1) / vc()) * 100}% - 5px)`,
  });

  // -- constraints: a refused candidate just isn't written to d.target*; the eased snap holds the block

  const cs = () => optsRef.current.constraints ?? NO_CONSTRAINTS;

  // memoised on the snapped target, so the host's predicate runs on boundary crossings only
  const probe = { key: "", ok: true };

  function askAllowed(
    key: string,
    gesture: ConstraintGesture,
    target: () => { start: Date; end: Date; allDay: boolean },
    origin?: () => { start: Date; end: Date; allDay: boolean },
    event?: PlacedEvent,
  ): boolean {
    if (probe.key === key) return probe.ok;
    probe.key = key;
    probe.ok = allows(cs(), {
      gesture,
      target: target(),
      origin: origin?.(),
      event: event?.source,
    });
    return probe.ok;
  }

  const tSlot = (col: number, startMin: number, endMin: number) =>
    timedSlot(optsRef.current.view, col, startMin, endMin, g().fromDisplay);

  const aSlot = (startCol: number, endCol: number) =>
    allDaySlot(optsRef.current.view, startCol, endCol);

  // the cursor flips every time; the sentence is said once per gesture
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

  // the release backstop: runs off the memo so a stale probe can never answer it
  function releaseRefused(req: DropRequest): boolean {
    return cs().active && !allows(cs(), req);
  }

  const snapStep = () => (s.altHeld ? g().snapFineMinutes : g().snapMinutes);

  const isTouch = () => wantsLongPress(s.pointerType);

  const threshold = () => (isTouch() ? TOUCH_THRESHOLD_PX : DRAG_THRESHOLD_PX);

  // "create" cancels at the engine's 4px (a scroll); "yield" at base-ui's 10px so both let go together
  function beginPress(e: React.PointerEvent, mode: PressMode) {
    s.pointerType = e.pointerType || "mouse";
    s.holdSpan = 0;
    s.scale = g().hourHeight;
    if (!isTouch()) {
      s.press = null;
      s.pressMode = null;
      return;
    }
    s.pressMode = mode;
    s.press = beginLongPress(e.clientX, e.clientY, performance.now(), {
      delayMs: LONG_PRESS_MS,
      movePx: mode === "yield" ? BASEUI_LONG_PRESS_MOVE_PX : DRAG_THRESHOLD_PX,
    });
  }

  // -- shared frame helpers ------------------------------------------------

  function trackVelocity(x: number, y: number) {
    const now = performance.now();
    const lp = s.lastPointer;
    if (lp.t > 0) {
      const dt = Math.max(1, now - lp.t);
      const dist = Math.hypot(x - lp.x, y - lp.y);
      const inst = (dist / dt) * 1000;
      s.velocity = s.velocity * 0.8 + inst * 0.2;
      s.vx = s.vx * 0.8 + ((x - lp.x) / dt) * 1000 * 0.2;
      s.vy = s.vy * 0.8 + ((y - lp.y) / dt) * 1000 * 0.2;
    }
    s.lastPointer = { x, y, t: now };
    s.pointer = { x, y };
  }

  function publish(type: "drag:start" | "drag:frame", frame: DragFrame) {
    craftBus.emit({ type, frame });
  }

  function endPublish(frame: DragFrame, cancelled: boolean) {
    craftBus.emit({ type: "drag:end", frame, cancelled });
  }

  function autoScroll() {
    const scroll = optsRef.current.scrollRef.current;
    if (!scroll) return;
    const r = scroll.getBoundingClientRect();
    const dv = autoScrollDelta(r, s.pointer, "y", EDGE_ZONE, EDGE_MAX_V);
    if (dv !== 0) scroll.scrollTop += dv;
  }

  // -- create flow ---------------------------------------------------------

  function createFrame(d: CreateDrag): DragFrame {
    if (d.mode === "allday") {
      const lo = Math.min(d.dayIndex, d.curDay);
      const hi = Math.max(d.dayIndex, d.curDay);
      return {
        kind: "create" as DragKind,
        id: "draft",
        velocity: s.velocity,
        rect: { x: d.vLeft, y: 0, width: d.vWidth, height: LANE_ROW_H },
        startMin: 0,
        endMin: 0,
        dayIndex: lo,
        endDayIndex: hi,
        pointer: { ...s.pointer },
      };
    }
    const { colWidth } = geom();
    const startMin = g().pxToMinutes(d.vTop);
    return {
      kind: "create" as DragKind,
      id: "draft",
      velocity: s.velocity,
      rect: { x: d.dayIndex * colWidth, y: d.vTop, width: colWidth, height: d.vHeight },
      startMin: Math.round(startMin),
      endMin: Math.round(startMin + g().pxToDuration(d.vHeight)),
      dayIndex: d.dayIndex,
      pointer: { ...s.pointer },
    };
  }

  function createTargets(d: CreateDrag) {
    const { rect } = geom();
    const rawY = s.pointer.y - rect.top;
    const step = snapStep();
    const anchorMin = g().clampMinutes(snapMinutes(g().pxToMinutes(d.anchorRawY), step));
    // dayDelta carries the growing edge across midnight: 5am in tomorrow's column is minute 1740
    const curMin =
      g().clampMinutes(snapMinutes(g().pxToMinutes(rawY), step)) + d.dayDelta * MINUTES_PER_DAY;
    let startMin = Math.min(anchorMin, curMin);
    let endMin = Math.max(anchorMin, curMin);
    const floor = Math.max(g().minEventMinutes, s.holdSpan);
    if (endMin - startMin < floor) {
      // minimum block, anchored in the drag direction
      if (curMin < anchorMin) startMin = endMin - floor;
      else endMin = startMin + floor;
    }
    const inverted = curMin < anchorMin;
    if (d.dayDelta === 0) {
      startMin = g().clampMinutes(startMin);
      endMin = g().clampMinutes(endMin);
    }

    // whole-body rule: the growing edge stops at the first refused minute
    if (cs().active) {
      const ok = askAllowed(`create|${d.dayIndex}|${startMin}|${endMin}`, "create", () =>
        tSlot(d.dayIndex, startMin, endMin),
      );
      if (ok) {
        d.okStart = startMin;
        d.okEnd = endMin;
        d.everOk = true;
        setRefused(false, "create");
      } else {
        setRefused(true, "create");
        if (d.everOk) return { startMin: d.okStart, endMin: d.okEnd, inverted };
      }
    }
    return { startMin, endMin, inverted };
  }

  function laneCreateAllowed(
    d: CreateDrag | LaneCreateDrag,
    anchor: number,
    cand: number,
  ): boolean {
    if (!cs().active) return true;
    const lo = Math.min(anchor, cand);
    const hi = Math.max(anchor, cand);
    const ok = askAllowed(`lane-create|${lo}|${hi}`, "create", () => aSlot(lo, hi));
    if (ok) d.everOk = true;
    setRefused(!ok, "create");
    return ok;
  }

  function guardLaneCreate(d: CreateDrag | LaneCreateDrag, anchor: number, cand: number): number {
    if (laneCreateAllowed(d, anchor, cand)) return cand;
    return d.everOk ? d.curDay : cand;
  }

  function renderDraft(d: CreateDrag) {
    const draft = optsRef.current.draftRef.current;
    if (!draft) return;

    // into the lane promotes to all-day; crossing columns inside the grid means "on into that day"
    const { rect: canvasRect, colWidth } = geom();
    const overDay = dayFromX(s.pointer.x, canvasRect, colWidth);
    d.curDay = d.mode === "allday" ? guardLaneCreate(d, d.dayIndex, overDay) : overDay;
    const lane = optsRef.current.laneRef.current;
    const inLane = lane ? s.pointer.y < lane.getBoundingClientRect().bottom : false;
    if (d.mode === "timed" && inLane) {
      if (laneCreateAllowed(d, d.dayIndex, d.curDay)) {
        dropCreateOverflow(d, draft);
        d.dayDelta = 0;
        promoteDraft(d);
      }
    } else if (d.mode === "allday" && !inLane) demoteDraft(d);

    if (d.mode === "allday") {
      renderLaneDraft(d);
      return;
    }

    // midnight crossing: full-day grids only, no active constraints, one column at a time
    const crossable = g().dayStartMin === 0 && g().dayEndMin === MINUTES_PER_DAY && !cs().active;
    d.dayDelta = crossable ? Math.max(-1, Math.min(1, d.curDay - d.dayIndex)) : 0;

    const t = createTargets(d);
    const targetTop = g().minutesToPx(t.startMin);
    const targetH = g().durationToPx(t.endMin - t.startMin);
    if (s.reduced) {
      d.vTop = targetTop;
      d.vHeight = targetH;
    } else {
      d.vTop += (targetTop - d.vTop) * EASE;
      d.vHeight += (targetH - d.vHeight) * EASE;
      if (Math.abs(targetTop - d.vTop) < 0.5) d.vTop = targetTop;
      if (Math.abs(targetH - d.vHeight) < 0.5) d.vHeight = targetH;
    }
    draft.style.left = `${d.dayIndex * (100 / vc())}%`;
    draft.style.width = `calc(${100 / vc()}% - 5px)`;
    // past midnight the draft pins to its day's edge; the remainder is a ghost in the next column
    const over =
      t.endMin > MINUTES_PER_DAY ? t.endMin - MINUTES_PER_DAY : t.startMin < 0 ? -t.startMin : 0;
    if (over > 0) {
      const topMin = Math.max(0, t.startMin);
      const botMin = Math.min(MINUTES_PER_DAY, t.endMin);
      const topPx = g().minutesToPx(topMin);
      draft.style.translate = `0 ${topPx}px`;
      draft.style.height = `${Math.max(6, g().minutesToPx(botMin) - topPx)}px`;
      setCutCorners(draft, t.endMin > MINUTES_PER_DAY ? "end" : "start", true);
      if (!d.overflow) {
        const c = draft.cloneNode(true) as HTMLElement;
        c.setAttribute("aria-hidden", "true");
        c.style.pointerEvents = "none";
        c.querySelector<HTMLElement>("[data-slot=draft-label]")?.remove();
        draft.parentElement?.appendChild(c);
        d.overflow = c;
      }
      const c = d.overflow;
      const dir = t.endMin > MINUTES_PER_DAY ? 1 : -1;
      c.style.left = `${(d.dayIndex + dir) * (100 / vc())}%`;
      c.style.width = `calc(${100 / vc()}% - 5px)`;
      c.style.translate = `0 ${dir === 1 ? 0 : g().minutesToPx(MINUTES_PER_DAY - over)}px`;
      c.style.height = `${Math.max(6, g().durationToPx(over))}px`;
      c.removeAttribute("hidden");
      setCutCorners(c, dir === 1 ? "start" : "end", true);
    } else {
      dropCreateOverflow(d, draft);
      // `translate`, not `transform`: WAAPI morphs animate `transform` and the two compose
      draft.style.translate = `0 ${d.vTop}px`;
      draft.style.height = `${Math.max(6, d.vHeight)}px`;
    }
    showGuides([t.startMin, t.endMin]);
    const label = draft.querySelector<HTMLElement>("[data-slot=draft-label]");
    if (label) {
      label.textContent = g().formatRange(t.startMin, t.endMin);
      const outside = targetH < LABEL_FLIP_H ? (t.inverted ? "top" : "bottom") : "";
      if (outside) draft.setAttribute("data-label-outside", outside);
      else draft.removeAttribute("data-label-outside");
    }
  }

  function dropCreateOverflow(d: CreateDrag, draft: HTMLElement | null) {
    if (d.overflow) {
      d.overflow.remove();
      d.overflow = null;
    }
    if (draft) {
      setCutCorners(draft, "start", false);
      setCutCorners(draft, "end", false);
    }
  }

  function renderLaneDraft(d: CreateDrag | LaneCreateDrag) {
    const laneDraft = optsRef.current.laneDraftRef.current;
    if (!laneDraft) return;
    const { colWidth } = laneGeom();
    const anchor = d.kind === "create" ? d.dayIndex : d.anchorDay;
    const lo = Math.min(anchor, d.curDay);
    const hi = Math.max(anchor, d.curDay);
    const t = spanPx(lo, hi, colWidth);
    if (s.reduced) {
      d.vLeft = t.left;
      d.vWidth = t.width;
    } else {
      d.vLeft += (t.left - d.vLeft) * EASE;
      d.vWidth += (t.width - d.vWidth) * EASE;
      if (Math.abs(t.left - d.vLeft) < 0.5) d.vLeft = t.left;
      if (Math.abs(t.width - d.vWidth) < 0.5) d.vWidth = t.width;
    }
    laneDraft.style.left = `${d.vLeft}px`;
    laneDraft.style.width = `${d.vWidth}px`;
    const label = laneDraft.querySelector<HTMLElement>("[data-slot=draft-label]");
    if (label) label.textContent = formatDaySpan(lo, hi, optsRef.current.view.namesShort);
  }

  // grid draft → lane chip: FLIP from the grid draft's rect while the grid draft hides
  function promoteDraft(d: CreateDrag) {
    const draft = optsRef.current.draftRef.current;
    const laneDraft = optsRef.current.laneDraftRef.current;
    if (!draft || !laneDraft) return;
    const fromRect = draft.getBoundingClientRect();
    d.mode = "allday";
    draft.setAttribute("hidden", "");

    const { rect: laneRect, colWidth } = laneGeom();
    const lo = Math.min(d.dayIndex, d.curDay);
    const hi = Math.max(d.dayIndex, d.curDay);
    const t = spanPx(lo, hi, colWidth);
    d.vLeft = t.left;
    d.vWidth = t.width;
    laneDraft.style.left = `${t.left}px`;
    laneDraft.style.width = `${t.width}px`;
    laneDraft.removeAttribute("hidden");

    if (!s.reduced) {
      // the draft chip sits at top: 3px (see [data-cal-lane-draft] css)
      const toRect = {
        x: laneRect.left + t.left,
        y: laneRect.top + 3,
        w: t.width,
        h: LANE_ROW_H,
      };
      laneDraft.style.transformOrigin = "top left";
      laneDraft.animate(
        [
          {
            transform: `translate(${fromRect.left - toRect.x}px, ${fromRect.top - toRect.y}px) scale(${fromRect.width / toRect.w}, ${fromRect.height / toRect.h})`,
          },
          { transform: "none" },
        ],
        { duration: ms(200), easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" },
      );
    }
  }

  function demoteDraft(d: CreateDrag) {
    const draft = optsRef.current.draftRef.current;
    const laneDraft = optsRef.current.laneDraftRef.current;
    if (!draft || !laneDraft) return;
    const fromRect = laneDraft.getBoundingClientRect();
    d.mode = "timed";
    laneDraft.setAttribute("hidden", "");

    // seed at the snapped geometry so the morph lands where per-frame tracking resumes
    const t = createTargets(d);
    d.vTop = g().minutesToPx(t.startMin);
    d.vHeight = g().durationToPx(t.endMin - t.startMin);
    draft.style.left = `${d.dayIndex * (100 / vc())}%`;
    draft.style.width = `calc(${100 / vc()}% - 5px)`;
    draft.style.translate = `0 ${d.vTop}px`;
    draft.style.height = `${Math.max(6, d.vHeight)}px`;
    draft.removeAttribute("hidden");

    if (!s.reduced) {
      const toRect = draft.getBoundingClientRect();
      draft.style.transformOrigin = "top left";
      draft.animate(
        [
          {
            transform: `translate(${fromRect.left - toRect.left}px, ${fromRect.top - toRect.top}px) scale(${fromRect.width / Math.max(1, toRect.width)}, ${fromRect.height / Math.max(1, toRect.height)})`,
          },
          { transform: "none" },
        ],
        { duration: ms(200), easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" },
      );
    }
  }

  // -- long-press affordance: the slot that will be created, outlined and filling in over the hold

  const pressElRef = { current: null as HTMLElement | null };
  const cancelRef = { current: (() => {}) as () => void };

  function pressEl(host: HTMLElement): HTMLElement {
    let el = pressElRef.current;
    if (!el) {
      el = document.createElement("div");
      el.className = "cal-press";
      el.setAttribute("aria-hidden", "true");
      pressElRef.current = el;
    }
    if (el.parentElement !== host) host.appendChild(el);
    return el;
  }

  function hidePress() {
    const el = pressElRef.current;
    if (el) el.setAttribute("hidden", "");
  }

  function renderPress(d: Drag) {
    const p = s.press;
    if (!p || p.phase !== "pending") return;
    const progress = longPressProgress(p, performance.now());

    let el: HTMLElement | null = null;
    if (d.kind === "create") {
      const canvas = optsRef.current.canvasRef.current;
      if (!canvas) return;
      const { colWidth } = geom();
      const step = snapStep();
      const startMin = g().clampMinutes(snapMinutes(g().pxToMinutes(d.anchorRawY), step));
      const span = Math.max(g().minEventMinutes, TOUCH_CREATE_MIN);
      // never outline a slot that will refuse the create; leaves everOk and refusal state untouched
      if (
        cs().active &&
        !askAllowed(`press|${d.dayIndex}|${startMin}|${span}`, "create", () =>
          tSlot(d.dayIndex, startMin, startMin + span),
        )
      ) {
        hidePress();
        return;
      }
      el = pressEl(canvas);
      el.style.left = `${d.dayIndex * colWidth + 1}px`;
      el.style.width = `${colWidth - 5}px`;
      el.style.top = `${g().minutesToPx(startMin)}px`;
      el.style.height = `${g().durationToPx(span)}px`;
    } else if (d.kind === "lane-create") {
      const lane = optsRef.current.laneRef.current;
      if (!lane) return;
      if (
        cs().active &&
        !askAllowed(`press-lane|${d.anchorDay}`, "create", () => aSlot(d.anchorDay, d.anchorDay))
      ) {
        hidePress();
        return;
      }
      el = pressEl(lane);
      const { colWidth } = laneGeom();
      const t = spanPx(d.anchorDay, d.anchorDay, colWidth);
      el.style.left = `${t.left}px`;
      el.style.width = `${t.width}px`;
      el.style.top = "3px";
      el.style.height = `${LANE_ROW_H}px`;
    } else {
      return;
    }

    el.removeAttribute("hidden");
    if (s.reduced) {
      el.style.opacity = progress < 0.35 ? "0" : "1";
      el.style.transform = "none";
    } else {
      el.style.opacity = String(progress);
      el.style.transform = `scale(${0.94 + 0.06 * progress})`;
    }
  }

  function armPress(d: Drag) {
    hidePress();
    if (s.pressMode === "yield") {
      // the context menu owns it; forgetting the drag stops pointerup firing openEditor behind the menu
      cleanup(d);
      return;
    }
    s.holdSpan = TOUCH_CREATE_MIN;
    engage(d);
    if (!s.reduced) {
      try {
        navigator.vibrate?.(8);
      } catch {
        /* unsupported */
      }
    }
  }

  // a scroll must leave nothing behind: no draft, no drag:end, no onCanvasClick
  function abandonPress(d: Drag) {
    hidePress();
    cleanup(d);
    optsRef.current.draftRef.current?.setAttribute("hidden", "");
    optsRef.current.laneDraftRef.current?.setAttribute("hidden", "");
  }

  // hourHeight changed mid-drag (⇧⌘. is live): rebase the values captured at pointerdown
  function rebaseScale(d: Drag, ratio: number) {
    if (d.kind === "create") {
      d.anchorRawY *= ratio;
      d.vTop *= ratio;
      d.vHeight *= ratio;
    } else if (d.kind === "move") {
      d.grabOffsetY *= ratio;
      d.originTop = g().minutesToPx(d.event.startMin);
      d.vDy = g().minutesToPx(d.targetStartMin) - d.originTop;
    } else if (d.kind === "resize") {
      d.vTop = g().minutesToPx(d.targetStartMin);
      d.vHeight = g().durationToPx(d.targetEndMin - d.targetStartMin);
    }
  }

  // -- edge markers: engine-owned pooled carets in the gutter, written in the rAF loop

  const guideEls: HTMLElement[] = [];

  function guideEl(i: number): HTMLElement | null {
    const canvas = optsRef.current.canvasRef.current;
    if (!canvas) return null;
    while (guideEls.length <= i) {
      const el = document.createElement("div");
      el.className = "cal-align-guide";
      el.setAttribute("hidden", "");
      el.setAttribute("aria-hidden", "true");
      canvas.appendChild(el);
      guideEls.push(el);
    }
    // survive canvas remounts (view switches)
    if (guideEls[i].parentElement !== canvas) canvas.appendChild(guideEls[i]);
    return guideEls[i];
  }

  function showGuides(mins: number[], candidates: readonly number[] = []) {
    clearTimeout(flashTimer.current);
    const shown = mins.filter((m) => m >= g().dayStartMin && m <= g().dayEndMin);
    for (let i = 0; i < 2; i++) {
      const el = guideEl(i);
      if (!el) continue;
      if (i < shown.length) {
        const m = shown[i];
        el.style.top = `${g().minutesToPx(m)}px`;
        el.setAttribute("data-time", g().formatMinutes(m));
        if (candidates.includes(m)) el.setAttribute("data-aligned", "");
        else el.removeAttribute("data-aligned");
        el.removeAttribute("hidden");
      } else {
        el.setAttribute("hidden", "");
      }
    }
  }

  const flashTimer = { current: undefined as ReturnType<typeof setTimeout> | undefined };
  /** Keyboard nudges have no release: show the edge markers, then let go. */
  function flashEdges(mins: number[], holdMs = 900) {
    if (s.drag) return;
    showGuides(mins);
    flashTimer.current = setTimeout(() => {
      if (!s.drag) showGuides([]);
    }, holdMs);
  }

  function alignCandidates(excludeId: string): number[] {
    if (s.alignCands) return s.alignCands;
    const out: number[] = [];
    for (const e of optsRef.current.getTimedEvents()) {
      if (e.id === excludeId) continue;
      out.push(e.startMin, e.endMin);
    }
    s.alignCands = out;
    return out;
  }

  function nearestAligned(min: number, candidates: number[]): number | null {
    const win = g().pxToDuration(ALIGN_PX);
    let best: number | null = null;
    let bestD = Infinity;
    for (const c of candidates) {
      const dist = Math.abs(c - min);
      if (dist <= win && dist < bestD) {
        best = c;
        bestD = dist;
      }
    }
    return best;
  }

  // -- move flow -----------------------------------------------------------

  function moveFrame(d: MoveDrag): DragFrame {
    const { colWidth } = geom();
    const duration = d.event.endMin - d.event.startMin;
    return {
      kind: "move",
      id: d.event.id,
      velocity: s.velocity,
      rect: {
        x: d.originLeft + d.vDx,
        y: d.originTop + d.vDy,
        width: colWidth,
        height: g().durationToPx(duration),
      },
      startMin: d.targetStartMin,
      endMin: d.targetStartMin + duration,
      dayIndex: d.targetDayIndex,
      pointer: { ...s.pointer },
    };
  }

  function moveTargets(d: MoveDrag) {
    const { rect, colWidth } = geom();
    const duration = d.event.endMin - d.event.startMin;
    const pointerY = s.pointer.y - rect.top;
    const pointerX = s.pointer.x - rect.left;
    const rawTop = pointerY - d.grabOffsetY;
    // ⌥ on a move means duplicate, not fine snap
    const rawStart = g().pxToMinutes(rawTop);
    let startMin = Math.max(
      g().dayStartMin,
      Math.min(g().dayEndMin - duration, snapMinutes(rawStart, g().snapMinutes)),
    );
    // either edge landing near another event's edge wins over the grid snap
    const candidates = alignCandidates(d.event.id);
    const aStart = nearestAligned(rawStart, candidates);
    const aEnd = nearestAligned(rawStart + duration, candidates);
    if (aStart !== null || aEnd !== null) {
      const dStart = aStart !== null ? Math.abs(aStart - rawStart) : Infinity;
      const dEnd = aEnd !== null ? Math.abs(aEnd - (rawStart + duration)) : Infinity;
      const aligned = dStart <= dEnd ? aStart! : aEnd! - duration;
      startMin = Math.max(g().dayStartMin, Math.min(g().dayEndMin - duration, aligned));
    }
    let dayIndex = Math.max(0, Math.min(vc() - 1, Math.floor(pointerX / colWidth)));

    if (cs().active) {
      const gesture: ConstraintGesture = d.dup ? "duplicate" : "move";
      const ok = askAllowed(
        `${gesture}|${dayIndex}|${startMin}|${duration}|${d.event.id}`,
        gesture,
        () => tSlot(dayIndex, startMin, startMin + duration),
        () => tSlot(d.event.dayIndex, d.event.startMin, d.event.endMin),
        d.event,
      );
      if (ok) {
        setRefused(false, d.dup ? "duplicate" : "move", d.event);
      } else {
        setRefused(true, d.dup ? "duplicate" : "move", d.event);
        startMin = d.targetStartMin;
        dayIndex = d.targetDayIndex;
      }
    }

    showGuides([startMin, startMin + duration], candidates);
    d.targetStartMin = startMin;
    d.targetDayIndex = dayIndex;
    return {
      dx: dayIndex * colWidth - d.originLeft,
      dy: g().minutesToPx(startMin) - d.originTop,
    };
  }

  function stepLift(d: MoveDrag | LaneMoveDrag, tilt: boolean): string {
    const now = performance.now();
    const dt = d.jiggleT ? (now - d.jiggleT) / 1000 : 1 / 60;
    d.jiggleT = now;
    stepJiggle(d.jiggle, { vx: s.vx, vy: s.vy, dt, tilt });
    const lift = liftOf(d.jiggle).toFixed(3);
    d.node.style.setProperty("--kloq-lift", lift);
    if (d.kind === "move") for (const sib of d.siblings) sib.style.setProperty("--kloq-lift", lift);
    return jiggleTransform(d.jiggle);
  }

  function fadeGhostIn(ghost: HTMLElement) {
    if (s.reduced) return;
    ghost.animate([{ opacity: 0 }, { opacity: 0.4 }], { duration: ms(160), easing: "ease-out" });
  }

  function renderMove(d: MoveDrag) {
    const wasDay = d.targetDayIndex;
    const wasMin = d.targetStartMin;
    const t = moveTargets(d);
    // the detent tick on a snap change
    if (!s.reduced && (d.targetDayIndex !== wasDay || d.targetStartMin !== wasMin))
      kickJiggle(d.jiggle);
    if (s.reduced) {
      d.vDx = t.dx;
      d.vDy = t.dy;
    } else {
      d.vDx += (t.dx - d.vDx) * EASE;
      d.vDy += (t.dy - d.vDy) * EASE;
      if (Math.abs(t.dx - d.vDx) < 0.5) d.vDx = t.dx;
      if (Math.abs(t.dy - d.vDy) < 0.5) d.vDy = t.dy;
    }
    let t3 = `translate(${d.vDx}px, ${d.vDy}px)`;
    if (!s.reduced) t3 += stepLift(d, true);
    d.node.style.transform = t3;
    for (const sib of d.siblings) sib.style.transform = t3;
    if (d.timeEl) {
      const duration = d.event.endMin - d.event.startMin;
      d.timeEl.textContent = g().formatRange(d.targetStartMin, d.targetStartMin + duration);
    }
  }

  // -- resize flow ---------------------------------------------------------

  function resizeFrame(d: ResizeDrag): DragFrame {
    const { colWidth } = geom();
    return {
      kind: (d.edge === "start" ? "resize-start" : "resize-end") as DragKind,
      id: d.event.id,
      velocity: s.velocity,
      rect: {
        x: d.event.dayIndex * colWidth,
        y: d.vTop,
        width: colWidth,
        height: d.vHeight,
      },
      startMin: d.targetStartMin,
      endMin: d.targetEndMin,
      dayIndex: d.event.dayIndex,
      pointer: { ...s.pointer },
    };
  }

  function resizeTargets(d: ResizeDrag) {
    const { rect, colWidth } = geom();
    const pointerY = s.pointer.y - rect.top;
    const step = snapStep();
    const raw = g().pxToMinutes(pointerY);
    // midnight crossing: full-day grids only, no active constraints, one column at a time
    const crossable = g().dayStartMin === 0 && g().dayEndMin === MINUTES_PER_DAY && !cs().active;
    const rawDelta = crossable ? dayFromX(s.pointer.x, rect, colWidth) - d.event.dayIndex : 0;
    const dayDelta =
      d.edge === "end" ? Math.max(0, Math.min(1, rawDelta)) : Math.min(0, Math.max(-1, rawDelta));
    let min = dayDelta * MINUTES_PER_DAY + g().clampMinutes(snapMinutes(raw, step));
    const aligned = dayDelta === 0 ? nearestAligned(raw, alignCandidates(d.event.id)) : null;
    if (aligned !== null) min = g().clampMinutes(aligned);
    let nextStart: number;
    let nextEnd: number;
    if (d.edge === "start") {
      nextStart = Math.min(min, d.event.endMin - g().minEventMinutes);
      nextEnd = d.event.endMin;
    } else {
      nextStart = d.event.startMin;
      nextEnd = Math.max(min, d.event.startMin + g().minEventMinutes);
    }

    // judged on the swept delta (`newlyOccupied` in lib/constraints): shrinking is always allowed
    if (cs().active) {
      const ok = askAllowed(
        `resize|${d.event.id}|${nextStart}|${nextEnd}`,
        "resize",
        () => tSlot(d.event.dayIndex, nextStart, nextEnd),
        () => tSlot(d.event.dayIndex, d.event.startMin, d.event.endMin),
        d.event,
      );
      if (ok) {
        setRefused(false, "resize", d.event);
      } else {
        setRefused(true, "resize", d.event);
        nextStart = d.targetStartMin;
        nextEnd = d.targetEndMin;
      }
    }
    d.targetStartMin = nextStart;
    d.targetEndMin = nextEnd;

    showGuides(
      [d.edge === "start" ? d.targetStartMin : d.targetEndMin],
      alignCandidates(d.event.id),
    );
    return {
      top: g().minutesToPx(d.targetStartMin),
      height: g().durationToPx(d.targetEndMin - d.targetStartMin),
    };
  }

  function setCutCorners(el: HTMLElement, edge: "start" | "end", cut: boolean) {
    const v = cut ? "0px" : "";
    if (edge === "end") {
      el.style.borderBottomLeftRadius = v;
      el.style.borderBottomRightRadius = v;
    } else {
      el.style.borderTopLeftRadius = v;
      el.style.borderTopRightRadius = v;
    }
  }

  function dropResizeOverflow(d: ResizeDrag) {
    if (!d.overflow) return;
    d.overflow.remove();
    d.overflow = null;
    setCutCorners(d.node, d.edge, false);
  }

  function renderResize(d: ResizeDrag) {
    const t = resizeTargets(d);
    if (s.reduced) {
      d.vTop = t.top;
      d.vHeight = t.height;
    } else {
      d.vTop += (t.top - d.vTop) * EASE;
      d.vHeight += (t.height - d.vHeight) * EASE;
      if (Math.abs(t.top - d.vTop) < 0.5) d.vTop = t.top;
      if (Math.abs(t.height - d.vHeight) < 0.5) d.vHeight = t.height;
    }
    // past midnight the block pins to its day's edge; the ghost is driven from the snapped target
    const over =
      d.edge === "end"
        ? Math.max(0, d.targetEndMin - MINUTES_PER_DAY)
        : Math.max(0, -d.targetStartMin);
    if (over > 0) {
      const top = d.edge === "end" ? g().minutesToPx(Math.max(0, d.targetStartMin)) : 0;
      const bottom =
        d.edge === "end"
          ? g().minutesToPx(MINUTES_PER_DAY)
          : g().minutesToPx(Math.min(MINUTES_PER_DAY, d.targetEndMin));
      d.node.style.top = `${top}px`;
      d.node.style.height = `${Math.max(bottom - top - 2, 14)}px`;
      setCutCorners(d.node, d.edge, true);
      if (!d.overflow) {
        const c = d.node.cloneNode(true) as HTMLElement;
        c.removeAttribute("data-cal-event");
        c.setAttribute("aria-hidden", "true");
        c.style.pointerEvents = "none";
        d.node.parentElement?.appendChild(c);
        d.overflow = c;
      }
      const { colWidth } = geom();
      const c = d.overflow;
      const dir = d.edge === "end" ? 1 : -1;
      c.style.left = `${d.node.offsetLeft + dir * colWidth}px`;
      c.style.width = `${d.node.offsetWidth}px`;
      c.style.top = `${d.edge === "end" ? 0 : g().minutesToPx(MINUTES_PER_DAY - over)}px`;
      c.style.height = `${Math.max(g().durationToPx(over) - 2, 4)}px`;
      setCutCorners(c, d.edge === "end" ? "start" : "end", true);
      const ghostTime = c.querySelector<HTMLElement>("[data-slot=event-time]");
      if (ghostTime) ghostTime.textContent = g().formatRange(d.targetStartMin, d.targetEndMin);
    } else {
      dropResizeOverflow(d);
      d.node.style.top = `${d.vTop}px`;
      d.node.style.height = `${Math.max(d.vHeight - 2, 14)}px`;
    }
    if (d.timeEl) d.timeEl.textContent = g().formatRange(d.targetStartMin, d.targetEndMin);
  }

  // -- lane flows (all coords in lane px) ----------------------------------

  function laneCreateFrame(d: LaneCreateDrag): DragFrame {
    const lo = Math.min(d.anchorDay, d.curDay);
    const hi = Math.max(d.anchorDay, d.curDay);
    return {
      kind: "create",
      id: "draft",
      velocity: s.velocity,
      rect: { x: d.vLeft, y: 0, width: d.vWidth, height: LANE_ROW_H },
      startMin: 0,
      endMin: 0,
      dayIndex: lo,
      endDayIndex: hi,
      pointer: { ...s.pointer },
    };
  }

  function laneMoveFrame(d: LaneMoveDrag): DragFrame {
    const { colWidth } = laneGeom();
    const span = d.event.endDayIndex - d.event.dayIndex;
    const t = spanPx(d.targetStartDay, d.targetStartDay + span, colWidth);
    return {
      kind: "move",
      id: d.event.id,
      velocity: s.velocity,
      rect: { x: t.left, y: 0, width: t.width, height: LANE_ROW_H },
      startMin: 0,
      endMin: 0,
      dayIndex: d.targetStartDay,
      endDayIndex: d.targetStartDay + span,
      pointer: { ...s.pointer },
    };
  }

  function laneResizeFrame(d: LaneResizeDrag): DragFrame {
    return {
      kind: d.edge === "left" ? "resize-start" : "resize-end",
      id: d.event.id,
      velocity: s.velocity,
      rect: { x: d.vLeft, y: 0, width: d.vWidth, height: LANE_ROW_H },
      startMin: 0,
      endMin: 0,
      dayIndex: d.targetStartDay,
      endDayIndex: d.targetEndDay,
      pointer: { ...s.pointer },
    };
  }

  function renderLaneMove(d: LaneMoveDrag) {
    const { rect, colWidth } = laneGeom();
    const span = d.event.endDayIndex - d.event.dayIndex;
    const pointerDay = dayFromX(s.pointer.x, rect, colWidth);
    let startDay = Math.max(0, Math.min(vc() - 1 - span, pointerDay - d.grabOffsetDays));
    if (cs().active) {
      const ok = askAllowed(
        `lane-move|${d.event.id}|${startDay}`,
        "lane-move",
        () => aSlot(startDay, startDay + span),
        () => aSlot(d.event.dayIndex, d.event.endDayIndex),
        d.event,
      );
      if (ok) {
        setRefused(false, "span", d.event);
      } else {
        setRefused(true, "span", d.event);
        startDay = d.targetStartDay;
      }
    }
    d.targetStartDay = startDay;
    const dx = (d.targetStartDay - d.event.dayIndex) * colWidth;
    if (s.reduced) d.vDx = dx;
    else {
      d.vDx += (dx - d.vDx) * EASE;
      if (Math.abs(dx - d.vDx) < 0.5) d.vDx = dx;
    }
    let t3 = `translateX(${d.vDx}px)`;
    if (!s.reduced) t3 += stepLift(d, false);
    d.node.style.transform = t3;
  }

  function renderLaneResize(d: LaneResizeDrag) {
    const { rect, colWidth } = laneGeom();
    const pointerDay = dayFromX(s.pointer.x, rect, colWidth);
    let nextStart: number;
    let nextEnd: number;
    if (d.edge === "left") {
      nextStart = Math.min(pointerDay, d.event.endDayIndex);
      nextEnd = d.event.endDayIndex;
    } else {
      nextStart = d.event.dayIndex;
      nextEnd = Math.max(pointerDay, d.event.dayIndex);
    }
    if (cs().active) {
      const ok = askAllowed(
        `lane-resize|${d.event.id}|${nextStart}|${nextEnd}`,
        "lane-resize",
        () => aSlot(nextStart, nextEnd),
        () => aSlot(d.event.dayIndex, d.event.endDayIndex),
        d.event,
      );
      if (ok) {
        setRefused(false, "span", d.event);
      } else {
        setRefused(true, "span", d.event);
        nextStart = d.targetStartDay;
        nextEnd = d.targetEndDay;
      }
    }
    d.targetStartDay = nextStart;
    d.targetEndDay = nextEnd;
    const t = spanPx(d.targetStartDay, d.targetEndDay, colWidth);
    if (s.reduced) {
      d.vLeft = t.left;
      d.vWidth = t.width;
    } else {
      d.vLeft += (t.left - d.vLeft) * EASE;
      d.vWidth += (t.width - d.vWidth) * EASE;
      if (Math.abs(t.left - d.vLeft) < 0.5) d.vLeft = t.left;
      if (Math.abs(t.width - d.vWidth) < 0.5) d.vWidth = t.width;
    }
    d.node.style.left = `${d.vLeft}px`;
    d.node.style.width = `${d.vWidth}px`;
  }

  // -- rAF loop ------------------------------------------------------------

  function tick() {
    const d = s.drag;
    if (!d) return;

    // a live zoom is detected here, not in an effect: the loop runs before the next visible frame
    const scale = g().hourHeight;
    if (s.scale !== 0 && scale !== s.scale) {
      rebaseScale(d, scale / s.scale);
      s.scale = scale;
    }

    // the long-press clock rides the rAF loop so the affordance and the arming read the same instant
    if (s.press) {
      const next = longPressTick(s.press, performance.now());
      if (next !== s.press) {
        s.press = next;
        if (next.phase === "armed") {
          armPress(d);
          if (!s.drag) return;
        }
      } else {
        renderPress(d);
      }
    }

    // lane drags (and promoted creates) never scroll the grid
    const inLane =
      d.kind === "lane-create" ||
      d.kind === "lane-move" ||
      d.kind === "lane-resize" ||
      (d.kind === "create" && d.mode === "allday");
    if (d.moved && !inLane) autoScroll();
    s.velocity *= 0.92;
    s.vx *= 0.92;
    s.vy *= 0.92;
    if (d.moved) {
      if (d.kind === "create") {
        renderDraft(d);
        publish("drag:frame", createFrame(d));
      } else if (d.kind === "move") {
        renderMove(d);
        publish("drag:frame", moveFrame(d));
      } else if (d.kind === "resize") {
        renderResize(d);
        publish("drag:frame", resizeFrame(d));
      } else if (d.kind === "lane-create") {
        const { rect, colWidth } = laneGeom();
        d.curDay = guardLaneCreate(d, d.anchorDay, dayFromX(s.pointer.x, rect, colWidth));
        renderLaneDraft(d);
        publish("drag:frame", laneCreateFrame(d));
      } else if (d.kind === "lane-move") {
        renderLaneMove(d);
        publish("drag:frame", laneMoveFrame(d));
      } else {
        renderLaneResize(d);
        publish("drag:frame", laneResizeFrame(d));
      }
    }
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

  // -- lifecycle: create ---------------------------------------------------

  const onCanvasPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // ctrlKey: macOS ctrl+click fires contextmenu AND pointerdown with button 0
    if (e.button !== 0 || e.ctrlKey || s.drag) return;
    if ((e.target as HTMLElement).closest("[data-cal-event]")) return;
    const { rect } = geom();
    const el = e.currentTarget;
    // explicit capture on touch too: implicit capture dies when the canvas is rebuilt on a view switch
    capturePointer(el, e.pointerId);
    s.reduced = prefersReducedMotion();
    s.velocity = 0;
    s.vx = 0;
    s.vy = 0;
    s.lastPointer = { x: e.clientX, y: e.clientY, t: 0 };
    s.pointer = { x: e.clientX, y: e.clientY };
    s.altHeld = e.altKey;
    beginPress(e, "create");
    const colWidth = rect.width / vc();
    const day = dayFromX(e.clientX, rect, colWidth);
    const d: CreateDrag = {
      kind: "create",
      pointerId: e.pointerId,
      captureEl: el,
      downX: e.clientX,
      downY: e.clientY,
      dayIndex: day,
      anchorRawY: e.clientY - rect.top,
      moved: false,
      mode: "timed",
      curDay: day,
      dayDelta: 0,
      overflow: null,
      vTop: 0,
      vHeight: 0,
      vLeft: 0,
      vWidth: 0,
      okStart: 0,
      okEnd: 0,
      everOk: false,
    };
    s.drag = d;
    startLoop();
  };

  // -- lifecycle: lane create ----------------------------------------------

  const onLanePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || e.ctrlKey || s.drag) return;
    if ((e.target as HTMLElement).closest("[data-cal-event], [data-cal-more]")) return;
    const { rect, colWidth } = laneGeom();
    const el = e.currentTarget;
    capturePointer(el, e.pointerId);
    s.reduced = prefersReducedMotion();
    s.velocity = 0;
    s.vx = 0;
    s.vy = 0;
    s.lastPointer = { x: e.clientX, y: e.clientY, t: 0 };
    s.pointer = { x: e.clientX, y: e.clientY };
    s.altHeld = e.altKey;
    beginPress(e, "create");
    const day = dayFromX(e.clientX, rect, colWidth);
    const d: LaneCreateDrag = {
      kind: "lane-create",
      pointerId: e.pointerId,
      captureEl: el,
      downX: e.clientX,
      downY: e.clientY,
      anchorDay: day,
      curDay: day,
      moved: false,
      everOk: false,
      vLeft: 0,
      vWidth: 0,
    };
    s.drag = d;
    startLoop();
  };

  // -- lifecycle: move -----------------------------------------------------

  const onEventPointerDown = (e: React.PointerEvent<HTMLElement>, event: PlacedEvent) => {
    if (e.button !== 0 || e.ctrlKey || s.drag) return;
    // read-only: run the click half by hand so the event stays selectable, skip the drag half
    if (event.readOnly) {
      e.stopPropagation();
      const el = e.currentTarget as HTMLElement;
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
    e.stopPropagation();
    const node = e.currentTarget as HTMLElement;
    capturePointer(node, e.pointerId);
    const { rect } = geom();
    s.reduced = prefersReducedMotion();
    s.velocity = 0;
    s.vx = 0;
    s.vy = 0;
    s.lastPointer = { x: e.clientX, y: e.clientY, t: 0 };
    s.pointer = { x: e.clientX, y: e.clientY };
    s.altHeld = e.altKey;
    beginPress(e, "yield");

    if (event.allDay) {
      const laneEdge = (e.target as HTMLElement).closest<HTMLElement>("[data-lane-edge]")?.dataset
        .laneEdge as "left" | "right" | undefined;
      const { rect, colWidth } = laneGeom();
      if (laneEdge) {
        const t = spanPx(event.dayIndex, event.endDayIndex, colWidth);
        const d: LaneResizeDrag = {
          kind: "lane-resize",
          edge: laneEdge,
          pointerId: e.pointerId,
          captureEl: node,
          downX: e.clientX,
          downY: e.clientY,
          event,
          node,
          moved: false,
          cancelled: false,
          vLeft: t.left,
          vWidth: t.width,
          targetStartDay: event.dayIndex,
          targetEndDay: event.endDayIndex,
        };
        s.drag = d;
      } else {
        const d: LaneMoveDrag = {
          kind: "lane-move",
          pointerId: e.pointerId,
          captureEl: node,
          downX: e.clientX,
          downY: e.clientY,
          event,
          node,
          ghost: null,
          grabOffsetDays: dayFromX(e.clientX, rect, colWidth) - event.dayIndex,
          moved: false,
          cancelled: false,
          vDx: 0,
          jiggle: createJiggle(),
          jiggleT: 0,
          targetStartDay: event.dayIndex,
        };
        s.drag = d;
      }
      startLoop();
      return;
    }

    const edge = (e.target as HTMLElement).closest<HTMLElement>("[data-resize-edge]")?.dataset
      .resizeEdge as "start" | "end" | undefined;
    if (edge) {
      const d: ResizeDrag = {
        kind: "resize",
        edge,
        pointerId: e.pointerId,
        captureEl: node,
        downX: e.clientX,
        downY: e.clientY,
        event,
        node,
        timeEl: node.querySelector<HTMLElement>("[data-slot=event-time]"),
        moved: false,
        cancelled: false,
        vTop: g().minutesToPx(event.startMin),
        vHeight: g().durationToPx(event.endMin - event.startMin),
        targetStartMin: event.startMin,
        targetEndMin: event.endMin,
        overflow: null,
      };
      s.drag = d;
      startLoop();
      return;
    }
    const colWidth = rect.width / vc();
    const originTop = g().minutesToPx(event.startMin);
    const originLeft = event.dayIndex * colWidth;
    const d: MoveDrag = {
      kind: "move",
      pointerId: e.pointerId,
      captureEl: node,
      downX: e.clientX,
      downY: e.clientY,
      event,
      node,
      siblings: segmentSiblings(event, node),
      ghost: null,
      timeEl: node.querySelector<HTMLElement>("[data-slot=event-time]"),
      originTop,
      originLeft,
      grabOffsetY: e.clientY - rect.top - originTop,
      moved: false,
      cancelled: false,
      dup: false,
      vDx: 0,
      vDy: 0,
      jiggle: createJiggle(),
      jiggleT: 0,
      targetDayIndex: event.dayIndex,
      targetStartMin: event.startMin,
    };
    s.drag = d;
    startLoop();
  };

  // -- engage (threshold crossed) -----------------------------------------

  // a create refused at the threshold: nothing written yet, so no draft, no drag:start, no drag:end
  function standDownCreate(d: CreateDrag | LaneCreateDrag) {
    if (!s.refusedSaid) optsRef.current.announce?.(announceRefused("create"));
    cleanup(d);
    optsRef.current.draftRef.current?.setAttribute("hidden", "");
    optsRef.current.laneDraftRef.current?.setAttribute("hidden", "");
  }

  function engage(d: Drag) {
    d.moved = true;
    if (d.kind === "create") {
      const t = createTargets(d);
      if (cs().active && !d.everOk) {
        standDownCreate(d);
        return;
      }
      const draft = optsRef.current.draftRef.current;
      if (draft) {
        d.vTop = g().minutesToPx(t.startMin);
        d.vHeight = g().durationToPx(t.endMin - t.startMin);
        draft.removeAttribute("hidden");
      }
      publish("drag:start", createFrame(d));
    } else if (d.kind === "lane-create") {
      if (!laneCreateAllowed(d, d.anchorDay, d.anchorDay)) {
        standDownCreate(d);
        return;
      }
      const laneDraft = optsRef.current.laneDraftRef.current;
      if (laneDraft) {
        const { colWidth } = laneGeom();
        const t = spanPx(d.anchorDay, d.anchorDay, colWidth);
        d.vLeft = t.left;
        d.vWidth = t.width;
        laneDraft.style.left = `${t.left}px`;
        laneDraft.style.width = `${t.width}px`;
        laneDraft.removeAttribute("hidden");
      }
      publish("drag:start", laneCreateFrame(d));
    } else if (d.kind === "lane-resize") {
      d.node.setAttribute("data-resizing", "");
      document.body.setAttribute("data-cal-resizing", "");
      publish("drag:start", laneResizeFrame(d));
    } else if (d.kind === "lane-move") {
      const node = d.node;
      const ghost = node.cloneNode(true) as HTMLElement;
      ghost.removeAttribute("data-cal-event");
      ghost.setAttribute("data-cal-ghost", "");
      // the clone carries role="button" and the aria-label — hide it or a reader sees two events
      ghost.setAttribute("aria-hidden", "true");
      ghost.tabIndex = -1;
      ghost.style.pointerEvents = "none";
      ghost.style.opacity = "0.4";
      node.parentElement?.insertBefore(ghost, node);
      fadeGhostIn(ghost);
      d.ghost = ghost;
      node.setAttribute("data-dragging", "");
      if (!s.reduced) node.style.setProperty("--kloq-lift", "0");
      document.body.setAttribute("data-cal-grabbing", "");
      publish("drag:start", laneMoveFrame(d));
    } else if (d.kind === "resize") {
      d.node.setAttribute("data-resizing", "");
      document.body.setAttribute("data-cal-resizing", "");
      publish("drag:start", resizeFrame(d));
    } else {
      const node = d.node;
      const ghost = node.cloneNode(true) as HTMLElement;
      ghost.removeAttribute("data-cal-event");
      ghost.setAttribute("data-cal-ghost", "");
      ghost.setAttribute("aria-hidden", "true");
      ghost.tabIndex = -1;
      ghost.style.pointerEvents = "none";
      ghost.style.opacity = "0.4";
      node.parentElement?.insertBefore(ghost, node);
      fadeGhostIn(ghost);
      d.ghost = ghost;
      node.setAttribute("data-dragging", "");
      if (!s.reduced) node.style.setProperty("--kloq-lift", "0");
      // siblings take the drag treatment too, but get no ghost of their own
      for (const sib of d.siblings) {
        sib.setAttribute("data-dragging", "");
        if (!s.reduced) sib.style.setProperty("--kloq-lift", "0");
      }
      document.body.setAttribute("data-cal-grabbing", "");
      if (s.altHeld) setDup(d, true);
      publish("drag:start", moveFrame(d));
    }
  }

  // ⌥ mid-move toggles duplicate; the ghost solidifying to full opacity is the tell
  function setDup(d: MoveDrag, dup: boolean) {
    if (d.dup === dup) return;
    d.dup = dup;
    if (d.ghost) {
      const to = dup ? "1" : "0.4";
      if (!s.reduced)
        d.ghost.animate([{ opacity: d.ghost.style.opacity || "0.4" }, { opacity: to }], {
          duration: ms(140),
          easing: "ease-out",
        });
      d.ghost.style.opacity = to;
    }
    if (dup) {
      d.node.setAttribute("data-duplicating", "");
      for (const sib of d.siblings) sib.setAttribute("data-duplicating", "");
      document.body.setAttribute("data-cal-duplicating", "");
    } else {
      d.node.removeAttribute("data-duplicating");
      for (const sib of d.siblings) sib.removeAttribute("data-duplicating");
      document.body.removeAttribute("data-cal-duplicating");
    }
  }

  // -- finish --------------------------------------------------------------

  function cleanup(d: Drag) {
    stopLoop();
    s.drag = null;
    s.press = null;
    s.pressMode = null;
    s.holdSpan = 0;
    s.scale = 0;
    s.refused = false;
    s.refusedSaid = false;
    s.alignCands = null;
    probe.key = "";
    hidePress();
    showGuides([]);
    document.body.removeAttribute("data-cal-grabbing");
    document.body.removeAttribute("data-cal-resizing");
    document.body.removeAttribute("data-cal-duplicating");
    document.body.removeAttribute("data-cal-refused");
    try {
      d.captureEl.releasePointerCapture(d.pointerId);
    } catch {
      /* already released */
    }
  }

  function finishCreate(d: CreateDrag, commitIn: boolean) {
    let commit = commitIn;
    const draft = optsRef.current.draftRef.current;
    const laneDraft = optsRef.current.laneDraftRef.current;

    if (d.mode === "allday") {
      const frame = createFrame(d);
      const lo = Math.min(d.dayIndex, d.curDay);
      const hi = Math.max(d.dayIndex, d.curDay);
      cleanup(d);
      if (commit && releaseRefused({ gesture: "create", target: aSlot(lo, hi) })) {
        refuseRelease("create");
        commit = false;
      }
      if (!commit) {
        laneDraft?.setAttribute("hidden", "");
        draft?.setAttribute("hidden", "");
        endPublish(frame, true);
        return;
      }
      const id = optsRef.current.commitCreate({
        dayIndex: lo,
        endDayIndex: hi,
        startMin: 0,
        endMin: 0,
        allDay: true,
      });
      endPublish(frame, false);
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          laneDraft?.setAttribute("hidden", "");
          optsRef.current.openEditor(id);
        }),
      );
      return;
    }

    const frame = createFrame(d);
    if (!commit) {
      cleanup(d);
      draft?.setAttribute("hidden", "");
      endPublish(frame, true);
      if (!d.moved)
        optsRef.current.onCanvasClick?.({
          clientX: s.pointer.x,
          clientY: s.pointer.y,
        });
      return;
    }
    const t = createTargets(d);
    cleanup(d);
    if (
      releaseRefused({
        gesture: "create",
        target: tSlot(d.dayIndex, t.startMin, t.endMin),
      })
    ) {
      refuseRelease("create");
      commit = false;
    }
    if (!commit || t.endMin - t.startMin < g().minEventMinutes) {
      draft?.setAttribute("hidden", "");
      dropCreateOverflow(d, draft);
      endPublish(frame, true);
      return;
    }
    const id = optsRef.current.commitCreate({
      dayIndex: d.dayIndex,
      startMin: t.startMin,
      endMin: t.endMin,
    });
    endPublish(frame, false);
    // let the real block paint before the draft disappears
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        draft?.setAttribute("hidden", "");
        dropCreateOverflow(d, draft);
        optsRef.current.openEditor(id);
      }),
    );
  }

  function finishLaneCreate(d: LaneCreateDrag, commitIn: boolean) {
    let commit = commitIn;
    const laneDraft = optsRef.current.laneDraftRef.current;
    const frame = laneCreateFrame(d);
    const lo = Math.min(d.anchorDay, d.curDay);
    const hi = Math.max(d.anchorDay, d.curDay);
    cleanup(d);
    if (commit && releaseRefused({ gesture: "create", target: aSlot(lo, hi) })) {
      refuseRelease("create");
      commit = false;
    }
    if (!commit || !d.moved) {
      laneDraft?.setAttribute("hidden", "");
      endPublish(frame, true);
      if (!d.moved)
        optsRef.current.onCanvasClick?.({
          clientX: s.pointer.x,
          clientY: s.pointer.y,
        });
      return;
    }
    const id = optsRef.current.commitCreate({
      dayIndex: lo,
      endDayIndex: hi,
      startMin: 0,
      endMin: 0,
      allDay: true,
    });
    endPublish(frame, false);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        laneDraft?.setAttribute("hidden", "");
        optsRef.current.openEditor(id);
      }),
    );
  }

  function finishLaneMove(d: LaneMoveDrag, cancelledIn: boolean) {
    let cancelled = cancelledIn;
    if (
      !cancelled &&
      d.moved &&
      releaseRefused({
        gesture: "lane-move",
        target: aSlot(
          d.targetStartDay,
          d.targetStartDay + (d.event.endDayIndex - d.event.dayIndex),
        ),
        origin: aSlot(d.event.dayIndex, d.event.endDayIndex),
        event: d.event.source,
      })
    ) {
      refuseRelease("span", d.event);
      cancelled = true;
    }
    const node = d.node;
    const frame = laneMoveFrame(d);
    cleanup(d);
    const done = () => {
      node.removeAttribute("data-dragging");
      node.style.removeProperty("--kloq-lift");
      d.ghost?.remove();
    };

    if (cancelled) {
      endPublish(frame, true);
      if (s.reduced) {
        node.style.transform = "";
        done();
        return;
      }
      const anim = node.animate(
        [
          {
            transform: `translateX(${d.vDx}px)${jiggleTransform(d.jiggle)}`,
            ...liftFrom(d.jiggle),
          },
          { transform: `translateX(0px)${JIGGLE_REST}`, ...LIFT_REST },
        ],
        { duration: SPRING_MS, easing: SPRING },
      );
      anim.onfinish = () => {
        node.style.transform = "";
        done();
      };
      return;
    }

    const { colWidth } = laneGeom();
    const span = d.event.endDayIndex - d.event.dayIndex;
    const finalDx = (d.targetStartDay - d.event.dayIndex) * colWidth;
    const commit = () => {
      const result = optsRef.current.commitSpan(d.event.id, {
        dayIndex: d.targetStartDay,
        endDayIndex: d.targetStartDay + span,
      });
      landCommit(
        result,
        () => {
          node.style.transform = "";
          done();
        },
        () => springHomeFrom(node, `translate(${d.vDx}px, 0)${jiggleTransform(d.jiggle)}`, done),
      );
    };
    endPublish(frame, false);
    if (s.reduced || (Math.abs(finalDx - d.vDx) < 1 && jiggleAtRest(d.jiggle))) {
      commit();
      return;
    }
    const anim = node.animate(
      [
        { transform: `translateX(${d.vDx}px)${jiggleTransform(d.jiggle)}`, ...liftFrom(d.jiggle) },
        { transform: `translateX(${finalDx}px)${JIGGLE_REST}`, ...LIFT_REST },
      ],
      { duration: SPRING_MS * 0.6, easing: SPRING },
    );
    anim.onfinish = commit;
  }

  function finishLaneResize(d: LaneResizeDrag, cancelledIn: boolean) {
    let cancelled = cancelledIn;
    if (
      !cancelled &&
      d.moved &&
      releaseRefused({
        gesture: "lane-resize",
        target: aSlot(d.targetStartDay, d.targetEndDay),
        origin: aSlot(d.event.dayIndex, d.event.endDayIndex),
        event: d.event.source,
      })
    ) {
      refuseRelease("span", d.event);
      cancelled = true;
    }
    const node = d.node;
    const frame = laneResizeFrame(d);
    cleanup(d);
    const done = () => node.removeAttribute("data-resizing");

    // left/width are React-managed styles — restore concrete values, never ""
    const restore = (startDay: number, endDay: number) => {
      const cs = chipStyles(startDay, endDay);
      node.style.left = cs.left;
      node.style.width = cs.width;
    };

    if (!d.moved) {
      endPublish(frame, true);
      done();
      return;
    }

    if (cancelled) {
      endPublish(frame, true);
      const { colWidth } = laneGeom();
      const orig = spanPx(d.event.dayIndex, d.event.endDayIndex, colWidth);
      if (s.reduced) {
        restore(d.event.dayIndex, d.event.endDayIndex);
        done();
        return;
      }
      const anim = node.animate(
        [
          { left: `${d.vLeft}px`, width: `${d.vWidth}px` },
          { left: `${orig.left}px`, width: `${orig.width}px` },
        ],
        { duration: SPRING_MS, easing: SPRING },
      );
      anim.onfinish = () => {
        restore(d.event.dayIndex, d.event.endDayIndex);
        done();
      };
      return;
    }

    const { colWidth } = laneGeom();
    const final = spanPx(d.targetStartDay, d.targetEndDay, colWidth);
    const commit = () => {
      const result = optsRef.current.commitSpan(d.event.id, {
        dayIndex: d.targetStartDay,
        endDayIndex: d.targetEndDay,
      });
      landCommit(
        result,
        () => {
          restore(d.targetStartDay, d.targetEndDay);
          done();
        },
        () => {
          restore(d.event.dayIndex, d.event.endDayIndex);
          done();
        },
      );
    };
    endPublish(frame, false);
    if (s.reduced || (Math.abs(final.left - d.vLeft) < 1 && Math.abs(final.width - d.vWidth) < 1)) {
      commit();
      return;
    }
    const anim = node.animate(
      [
        { left: `${d.vLeft}px`, width: `${d.vWidth}px` },
        { left: `${final.left}px`, width: `${final.width}px` },
      ],
      { duration: SPRING_MS * 0.6, easing: SPRING },
    );
    anim.onfinish = commit;
  }

  function finishMove(d: MoveDrag, cancelledIn: boolean) {
    let cancelled = cancelledIn;
    const moveGesture: ConstraintGesture = d.dup ? "duplicate" : "move";
    const moveDuration = d.event.endMin - d.event.startMin;
    if (
      !cancelled &&
      d.moved &&
      releaseRefused({
        gesture: moveGesture,
        target: tSlot(d.targetDayIndex, d.targetStartMin, d.targetStartMin + moveDuration),
        origin: tSlot(d.event.dayIndex, d.event.startMin, d.event.endMin),
        event: d.event.source,
      })
    ) {
      refuseRelease(d.dup ? "duplicate" : "move", d.event);
      cancelled = true;
    }
    const node = d.node;
    const sibs = d.siblings;
    const frame = moveFrame(d);
    cleanup(d);

    const done = () => {
      node.removeAttribute("data-dragging");
      node.removeAttribute("data-duplicating");
      node.style.removeProperty("--kloq-lift");
      for (const sib of sibs) {
        sib.removeAttribute("data-dragging");
        sib.removeAttribute("data-duplicating");
        sib.style.removeProperty("--kloq-lift");
      }
      d.ghost?.remove();
    };

    // ⌥-drop: settle the carried copy into the target, commit a clone, hand the node back to origin
    if (d.dup && !cancelled && d.moved) {
      const { colWidth } = geom();
      const finalDx = d.targetDayIndex * colWidth - d.originLeft;
      const finalDy = g().minutesToPx(d.targetStartMin) - d.originTop;
      const commit = () => {
        flushSync(() =>
          optsRef.current.commitDuplicate(d.event.id, {
            dayIndex: d.targetDayIndex,
            startMin: d.targetStartMin,
          }),
        );
        setTransformAll(node, sibs, "");
        if (d.timeEl) d.timeEl.textContent = g().formatRange(d.event.startMin, d.event.endMin);
        done();
      };
      endPublish(frame, false);
      if (
        s.reduced ||
        (Math.abs(finalDx - d.vDx) < 1 && Math.abs(finalDy - d.vDy) < 1 && jiggleAtRest(d.jiggle))
      ) {
        commit();
        return;
      }
      const anim = animateAll(
        node,
        sibs,
        [
          {
            transform: `translate(${d.vDx}px, ${d.vDy}px)${jiggleTransform(d.jiggle)}`,
            ...liftFrom(d.jiggle),
          },
          { transform: `translate(${finalDx}px, ${finalDy}px)${JIGGLE_REST}`, ...LIFT_REST },
        ],
        { duration: SPRING_MS * 0.6, easing: SPRING },
      );
      anim.onfinish = commit;
      return;
    }

    if (cancelled) {
      // restore the label the engine overwrote — React's vdom didn't change, so it won't
      const from = `translate(${d.vDx}px, ${d.vDy}px)${jiggleTransform(d.jiggle)}`;
      const restoreLabel = () => {
        if (d.timeEl) d.timeEl.textContent = g().formatRange(d.event.startMin, d.event.endMin);
      };
      endPublish(frame, true);
      if (s.reduced) {
        setTransformAll(node, sibs, "");
        restoreLabel();
        done();
        return;
      }
      const anim = animateAll(
        node,
        sibs,
        [
          { transform: from, ...liftFrom(d.jiggle) },
          { transform: `translate(0px, 0px)${JIGGLE_REST}`, ...LIFT_REST },
        ],
        { duration: SPRING_MS, easing: SPRING },
      );
      anim.onfinish = () => {
        setTransformAll(node, sibs, "");
        restoreLabel();
        done();
      };
      return;
    }

    const { colWidth } = geom();
    const finalDx = d.targetDayIndex * colWidth - d.originLeft;
    const finalDy = g().minutesToPx(d.targetStartMin) - d.originTop;
    const commit = () => {
      const result = optsRef.current.commitMove(d.event.id, {
        dayIndex: d.targetDayIndex,
        startMin: d.targetStartMin,
      });
      landCommit(
        result,
        () => {
          setTransformAll(node, sibs, "");
          done();
        },
        () =>
          springHomeFrom(
            node,
            `translate(${d.vDx}px, ${d.vDy}px)${jiggleTransform(d.jiggle)}`,
            done,
            sibs,
          ),
      );
    };
    endPublish(frame, false);
    if (
      s.reduced ||
      (Math.abs(finalDx - d.vDx) < 1 && Math.abs(finalDy - d.vDy) < 1 && jiggleAtRest(d.jiggle))
    ) {
      commit();
      return;
    }
    const anim = animateAll(
      node,
      sibs,
      [
        {
          transform: `translate(${d.vDx}px, ${d.vDy}px)${jiggleTransform(d.jiggle)}`,
          ...liftFrom(d.jiggle),
        },
        { transform: `translate(${finalDx}px, ${finalDy}px)${JIGGLE_REST}`, ...LIFT_REST },
      ],
      { duration: SPRING_MS * 0.6, easing: SPRING },
    );
    anim.onfinish = commit;
  }

  function finishResize(d: ResizeDrag, cancelledIn: boolean) {
    let cancelled = cancelledIn;
    if (
      !cancelled &&
      d.moved &&
      releaseRefused({
        gesture: "resize",
        target: tSlot(d.event.dayIndex, d.targetStartMin, d.targetEndMin),
        origin: tSlot(d.event.dayIndex, d.event.startMin, d.event.endMin),
        event: d.event.source,
      })
    ) {
      refuseRelease("resize", d.event);
      cancelled = true;
    }
    const node = d.node;
    const frame = resizeFrame(d);
    cleanup(d);

    const crossed = d.overflow !== null;
    const done = () => {
      node.removeAttribute("data-resizing");
      dropResizeOverflow(d);
    };

    // top/height are React-managed styles — restore concrete values, never "" (block jumps to y=0)
    const restore = (startMin: number, endMin: number) => {
      node.style.top = `${g().minutesToPx(startMin)}px`;
      node.style.height = `${Math.max(g().durationToPx(endMin - startMin) - 2, 14)}px`;
      if (d.timeEl) d.timeEl.textContent = g().formatRange(startMin, endMin);
    };

    if (!d.moved) {
      endPublish(frame, true);
      done();
      return;
    }

    if (cancelled) {
      endPublish(frame, true);
      dropResizeOverflow(d);
      const origTop = g().minutesToPx(d.event.startMin);
      const origH = Math.max(g().durationToPx(d.event.endMin - d.event.startMin) - 2, 14);
      if (s.reduced) {
        restore(d.event.startMin, d.event.endMin);
        done();
        return;
      }
      const anim = node.animate(
        [
          { top: `${d.vTop}px`, height: `${Math.max(d.vHeight - 2, 14)}px` },
          { top: `${origTop}px`, height: `${origH}px` },
        ],
        { duration: SPRING_MS, easing: SPRING },
      );
      anim.onfinish = () => {
        restore(d.event.startMin, d.event.endMin);
        done();
      };
      return;
    }

    const finalTop = g().minutesToPx(d.targetStartMin);
    const finalH = Math.max(g().durationToPx(d.targetEndMin - d.targetStartMin) - 2, 14);
    const commit = () => {
      const result = optsRef.current.commitResize(d.event.id, {
        startMin: d.targetStartMin,
        endMin: d.targetEndMin,
      });
      landCommit(
        result,
        () => {
          restore(d.targetStartMin, d.targetEndMin);
          done();
        },
        () => {
          restore(d.event.startMin, d.event.endMin);
          done();
        },
      );
    };
    endPublish(frame, false);
    // a cross-midnight result has nothing to tween toward — the re-render replaces it with segments
    if (
      s.reduced ||
      crossed ||
      (Math.abs(finalTop - d.vTop) < 1 &&
        Math.abs(finalH - (d.vHeight - 2)) < 1 &&
        Math.abs(s.vy * RESIZE_PUSH) < 1)
    ) {
      commit();
      return;
    }
    // rubber-band from the release velocity; skipped when there's no room to overshoot
    const push = s.reduced ? 0 : Math.max(-10, Math.min(10, s.vy * RESIZE_PUSH));
    const overTop = d.edge === "start" ? finalTop + push : finalTop;
    const overH = d.edge === "start" ? finalH - push : finalH + push;
    const bounce = Math.abs(push) >= 1 && overH >= 14 && overTop >= 0;
    const anim = node.animate(
      bounce
        ? [
            { top: `${d.vTop}px`, height: `${Math.max(d.vHeight - 2, 14)}px`, easing: "ease-out" },
            { top: `${overTop}px`, height: `${overH}px`, offset: 0.35, easing: RESIZE_SPRING },
            { top: `${finalTop}px`, height: `${finalH}px` },
          ]
        : [
            { top: `${d.vTop}px`, height: `${Math.max(d.vHeight - 2, 14)}px` },
            { top: `${finalTop}px`, height: `${finalH}px` },
          ],
      { duration: SPRING_MS * (bounce ? 0.9 : 0.6), easing: SPRING },
    );
    anim.onfinish = commit;
  }

  // -- global listeners ----------------------------------------------------

  const attach = () => {
    function onMove(e: PointerEvent) {
      const d = s.drag;
      if (!d || e.pointerId !== d.pointerId) return;
      s.altHeld = e.altKey;
      trackVelocity(e.clientX, e.clientY);

      // the press is asked before the threshold: on touch they use different radii
      if (s.press) {
        const next = longPressMove(s.press, e.clientX, e.clientY);
        if (next !== s.press) {
          s.press = next;
          if (s.pressMode === "create" && d.kind === "create") {
            // moved before the hold matured on the scrollable grid — that was a scroll
            abandonPress(d);
            return;
          }
          // the lane has nothing to scroll; "yield" just saw base-ui let go — ours from here
          s.press = null;
          s.pressMode = null;
          hidePress();
        } else if (s.press.phase === "armed" && s.holdSpan > 0) {
          // the finger moved after a long-press create — back to the normal snap floor
          if (Math.hypot(e.clientX - s.press.x, e.clientY - s.press.y) >= DRAG_THRESHOLD_PX)
            s.holdSpan = 0;
        }
      }

      if (!d.moved) {
        const dist = Math.hypot(e.clientX - d.downX, e.clientY - d.downY);
        if (dist >= threshold()) engage(d);
      }
    }

    function onUp(e: PointerEvent) {
      const d = s.drag;
      if (!d || e.pointerId !== d.pointerId) return;
      if (d.kind === "create") {
        finishCreate(d, d.moved);
      } else if (d.kind === "lane-create") {
        finishLaneCreate(d, d.moved);
      } else if (d.kind === "resize") {
        const wasClick = !d.moved;
        finishResize(d, d.cancelled);
        if (wasClick) optsRef.current.openEditor(d.event.id);
      } else if (d.kind === "lane-resize") {
        const wasClick = !d.moved;
        finishLaneResize(d, d.cancelled);
        if (wasClick) optsRef.current.openEditor(d.event.id);
      } else if (d.kind === "lane-move") {
        const wasClick = !d.moved;
        finishLaneMove(d, d.cancelled || !d.moved);
        if (wasClick) optsRef.current.openEditor(d.event.id);
      } else {
        const wasClick = !d.moved;
        finishMove(d, d.cancelled || !d.moved);
        if (wasClick) optsRef.current.openEditor(d.event.id);
      }
    }

    function cancelDrag(d: Drag) {
      if (d.kind === "create") finishCreate(d, false);
      else if (d.kind === "lane-create") finishLaneCreate(d, false);
      else if (d.kind === "resize") finishResize(d, true);
      else if (d.kind === "lane-resize") finishLaneResize(d, true);
      else if (d.kind === "lane-move") finishLaneMove(d, true);
      else finishMove(d, true);
    }

    function onCancel(e: PointerEvent) {
      const d = s.drag;
      if (!d || e.pointerId !== d.pointerId) return;
      // pre-threshold must not run the click half: on touch, pointercancel means "I took this as a scroll"
      if (!d.moved) abandonPress(d);
      else cancelDrag(d);
    }

    function onKey(e: KeyboardEvent) {
      const d = s.drag;
      if (e.key === "Alt") {
        s.altHeld = e.type === "keydown";
        if (d?.kind === "move" && d.moved) setDup(d, s.altHeld);
      }
      if (!d) return;
      if (e.key === "Escape" && e.type === "keydown") {
        e.preventDefault();
        e.stopImmediatePropagation();
        cancelDrag(d);
      }
    }

    // capture-phase stopPropagation keeps base-ui's long-press timer from starting on empty grid/lane
    function onTouchStartCapture(e: TouchEvent) {
      const t = e.target as HTMLElement | null;
      if (!t?.closest) return;
      if (t.closest("[data-cal-event]")) return;
      const canvas = optsRef.current.canvasRef.current;
      const lane = optsRef.current.laneRef.current;
      if (!(canvas?.contains(t) || lane?.contains(t))) return;
      e.stopPropagation();
    }

    // touch-action can't change for a touch in flight; a non-passive touchmove preventDefault can
    function onTouchMove(e: TouchEvent) {
      const d = s.drag;
      if (!d || !isTouch()) return;
      if (s.press?.phase === "pending") return;
      if (d.moved && e.cancelable) e.preventDefault();
    }

    document.addEventListener("touchstart", onTouchStartCapture, {
      capture: true,
    });
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    // capture phase: the engine must see Escape before a focused element can swallow it
    window.addEventListener("keydown", onKey, { capture: true });
    window.addEventListener("keyup", onKey, { capture: true });
    cancelRef.current = () => {
      const d = s.drag;
      if (!d) return;
      if (d.moved) cancelDrag(d);
      else abandonPress(d);
    };

    return () => {
      cancelRef.current = () => {};
      document.removeEventListener("touchstart", onTouchStartCapture, {
        capture: true,
      });
      document.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      window.removeEventListener("keydown", onKey, { capture: true });
      window.removeEventListener("keyup", onKey, { capture: true });
      stopLoop();
      pressElRef.current?.remove();
      pressElRef.current = null;
      for (const el of guideEls) el.remove();
      guideEls.length = 0;
    };
  };

  /** An engaged drag springs home as Escape would; a pre-threshold one is forgotten. Idempotent. */
  const cancelActiveDrag = () => cancelRef.current();

  return {
    onCanvasPointerDown,
    onEventPointerDown,
    onLanePointerDown,
    cancelActiveDrag,
    flashEdges,
    attach,
  };
}

export type DragEngine = ReturnType<typeof createDragEngine>;

/** One engine per mount; options are read through a ref, so nothing here re-renders or re-binds. */
export function useDragEngine(opts: DragEngineOpts) {
  const optsRef = useLatest(opts);
  const [engine] = useState(() => createDragEngine(optsRef));
  useEffect(() => engine.attach(), [engine]);
  return engine;
}
