"use client";

/**
 * use-marquee — ⌘/Ctrl-drag a box to select events (⇧ keeps the existing selection).
 * `week-grid` offers pointerdown here first and only arms the drag engine if declined.
 */

import type React from "react";
import type { RefObject } from "react";
import { useCallback, useEffect, useRef } from "react";
import { DRAG_THRESHOLD_PX, type PlacedEvent } from "../lib/calendar-types";
import { eventsInMarquee, type MarqueeRect } from "../lib/selection";
import { ms, prefersReducedMotion } from "../lib/springs";
import { useLatest } from "../lib/use-latest";
import { useKloqSettings } from "./settings-context";
import { isToggleModifier } from "./use-selection";

const EDGE_ZONE = 56;
const EDGE_MAX_V = 14;

interface MarqueeOptions {
  canvasRef: RefObject<HTMLElement | null>;
  boxRef: RefObject<HTMLElement | null>;
  scrollRef?: RefObject<HTMLElement | null>;
  dayCount: number;
  /** read per frame — must be cheap */
  getEvents: () => readonly PlacedEvent[];
  registry?: Map<string, HTMLElement>;
  onCommit: (ids: string[], additive: boolean) => void;
}

interface MarqueeState {
  pointerId: number;
  captureEl: HTMLElement;
  /** canvas coordinates, so scrolling mid-drag doesn't move it */
  anchorX: number;
  anchorY: number;
  clientX: number;
  clientY: number;
  additive: boolean;
  moved: boolean;
  cancelled: boolean;
  raf: number;
  painted: Map<string, { outline: string; outlineOffset: string }>;
  hits: string[];
}

interface MarqueeHandle {
  /** Returns `true` when it took the gesture — the caller must then not arm the drag engine. */
  tryStart(e: React.PointerEvent<HTMLElement>): boolean;
  isActive(): boolean;
}

const HIT_OUTLINE = "2px solid var(--ring)";

export function useMarquee(opts: MarqueeOptions): MarqueeHandle {
  const g = useKloqSettings();
  const o = useLatest(opts);
  const gRef = useLatest(g);
  const s = useRef<MarqueeState | null>(null);

  const nodeFor = useCallback((id: string): HTMLElement | null => {
    const fromRegistry = o.current.registry?.get(id);
    if (fromRegistry) return fromRegistry;
    const canvas = o.current.canvasRef.current;
    return canvas?.querySelector<HTMLElement>(`[data-cal-event="${CSS.escape(id)}"]`) ?? null;
  }, []);

  const paint = useCallback(
    (ids: string[]) => {
      const st = s.current;
      if (!st) return;
      const next = new Set(ids);
      for (const [id, prev] of st.painted) {
        if (next.has(id)) continue;
        const el = nodeFor(id);
        if (el) {
          el.style.outline = prev.outline;
          el.style.outlineOffset = prev.outlineOffset;
        }
        st.painted.delete(id);
      }
      for (const id of ids) {
        if (st.painted.has(id)) continue;
        const el = nodeFor(id);
        if (!el) continue;
        st.painted.set(id, {
          outline: el.style.outline,
          outlineOffset: el.style.outlineOffset,
        });
        el.style.outline = HIT_OUTLINE;
        el.style.outlineOffset = "1px";
      }
    },
    [nodeFor],
  );

  const unpaint = useCallback(() => {
    const st = s.current;
    if (!st) return;
    for (const [id, prev] of st.painted) {
      const el = nodeFor(id);
      if (el) {
        el.style.outline = prev.outline;
        el.style.outlineOffset = prev.outlineOffset;
      }
    }
    st.painted.clear();
  }, [nodeFor]);

  const teardown = useCallback(() => {
    const st = s.current;
    if (!st) return;
    cancelAnimationFrame(st.raf);
    unpaint();
    const box = o.current.boxRef.current;
    if (box) box.hidden = true;
    try {
      st.captureEl.releasePointerCapture(st.pointerId);
    } catch {}
    s.current = null;
  }, [unpaint]);

  const frame = useCallback(() => {
    const st = s.current;
    const canvas = o.current.canvasRef.current;
    const box = o.current.boxRef.current;
    if (!st || !canvas || !box) return;

    const scroller = o.current.scrollRef?.current;
    if (scroller && st.moved) {
      const r = scroller.getBoundingClientRect();
      const above = st.clientY - r.top;
      const below = r.bottom - st.clientY;
      if (above < EDGE_ZONE) scroller.scrollTop -= ((EDGE_ZONE - above) / EDGE_ZONE) * EDGE_MAX_V;
      else if (below < EDGE_ZONE)
        scroller.scrollTop += ((EDGE_ZONE - below) / EDGE_ZONE) * EDGE_MAX_V;
    }

    const rect = canvas.getBoundingClientRect();
    const x = st.clientX - rect.left;
    const y = st.clientY - rect.top;
    const m: MarqueeRect = { x1: st.anchorX, y1: st.anchorY, x2: x, y2: y };

    const left = Math.min(m.x1, m.x2);
    const top = Math.min(m.y1, m.y2);
    box.style.transform = `translate(${left}px, ${top}px)`;
    box.style.width = `${Math.abs(m.x2 - m.x1)}px`;
    box.style.height = `${Math.abs(m.y2 - m.y1)}px`;

    st.hits = eventsInMarquee(m, o.current.getEvents(), {
      dayCount: o.current.dayCount,
      width: rect.width,
      minutesToPx: gRef.current.minutesToPx,
    });
    paint(st.hits);
    st.raf = requestAnimationFrame(frame);
  }, [paint]);

  const engage = useCallback(() => {
    const st = s.current;
    const box = o.current.boxRef.current;
    if (!st || !box) return;
    st.moved = true;
    box.hidden = false;
    if (!prefersReducedMotion())
      box.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: ms(90),
        easing: "ease-out",
      });
  }, []);

  const tryStart = useCallback(
    (e: React.PointerEvent<HTMLElement>): boolean => {
      if (e.button !== 0) return false;
      // ⇧ alone does not arm: a bare ⇧-drag on empty grid must keep creating an event
      if (!isToggleModifier(e)) return false;
      if (s.current) return false;
      const canvas = o.current.canvasRef.current;
      if (!canvas) return false;
      const rect = canvas.getBoundingClientRect();
      const el = e.currentTarget;
      el.setPointerCapture(e.pointerId);
      s.current = {
        pointerId: e.pointerId,
        captureEl: el,
        anchorX: e.clientX - rect.left,
        anchorY: e.clientY - rect.top,
        clientX: e.clientX,
        clientY: e.clientY,
        additive: e.shiftKey,
        moved: false,
        cancelled: false,
        raf: 0,
        painted: new Map(),
        hits: [],
      };
      // the loop runs from the start but writes nothing until `moved`
      s.current.raf = requestAnimationFrame(frame);
      return true;
    },
    [frame],
  );

  useEffect(() => {
    function onMove(e: PointerEvent) {
      const st = s.current;
      if (!st || e.pointerId !== st.pointerId) return;
      st.clientX = e.clientX;
      st.clientY = e.clientY;
      if (st.moved) return;
      const canvas = o.current.canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const dist = Math.hypot(
        e.clientX - rect.left - st.anchorX,
        e.clientY - rect.top - st.anchorY,
      );
      if (dist >= DRAG_THRESHOLD_PX) engage();
    }

    function onUp(e: PointerEvent) {
      const st = s.current;
      if (!st || e.pointerId !== st.pointerId) return;
      const { moved, cancelled, hits, additive } = st;
      teardown();
      // a ⌘-click that never crossed the threshold is the grid's click, not a clear
      if (moved && !cancelled) o.current.onCommit(hits, additive);
    }

    function onCancel(e: PointerEvent) {
      const st = s.current;
      if (!st || e.pointerId !== st.pointerId) return;
      teardown();
    }

    function onKey(e: KeyboardEvent) {
      const st = s.current;
      if (!st || e.key !== "Escape") return;
      // capture phase: nothing focused may swallow the cancel
      e.preventDefault();
      e.stopImmediatePropagation();
      st.cancelled = true;
      teardown();
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    window.addEventListener("keydown", onKey, { capture: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      window.removeEventListener("keydown", onKey, { capture: true });
      teardown();
    };
  }, [engage, teardown]);

  return {
    tryStart,
    isActive: () => s.current !== null,
  };
}
