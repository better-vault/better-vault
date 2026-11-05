import { type RefObject, useEffect, useLayoutEffect, useRef } from "react";
import { EASE_OUT, prefersReducedMotion } from "../lib/springs";
import { useLatest } from "../lib/use-latest";

export const PANEL_WIDTH = 320;
const GAP = 10;
const MARGIN = 8;
// matches --overlay-enter
const ENTER_MS = 150;
// longest a slow page takes to deliver the opening tap's trailing events
const GHOST_CLICK_MS = 700;
const SHEET_BELOW = 640;
const SIDE_BY_SIDE_FROM = 1024;

interface Pos {
  x: number;
  y: number;
  /** which side of the block the panel sits on */
  side: "right" | "left";
}

/**
 * A bottom sheet on phones, and on tablets whenever the panel could not sit beside a
 * column this wide without covering it.
 */
function wantsSheet(anchor: DOMRect): boolean {
  const w = window.innerWidth;
  if (w < SHEET_BELOW) return true;
  if (w >= SIDE_BY_SIDE_FROM) return false;
  return w < anchor.width + 2 * (PANEL_WIDTH + GAP + MARGIN);
}

/**
 * The tap that opened the sheet is still in flight: its touchend and the mouse events the
 * browser synthesises from it arrive after the sheet has risen under the finger, and would
 * focus whatever is there. Swallow exactly those — the next touch is the user's own.
 */
function swallowGhostClick(wrap: HTMLElement) {
  if (!window.matchMedia("(pointer: coarse)").matches) return;
  const swallow = (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "click") stop();
  };
  const types = ["mousedown", "mouseup", "click"] as const;
  const stop = () => {
    window.clearTimeout(timer);
    for (const t of types) wrap.removeEventListener(t, swallow, true);
    document.removeEventListener("touchstart", stop, true);
  };
  for (const t of types) wrap.addEventListener(t, swallow, true);
  document.addEventListener("touchstart", stop, true);
  const timer = window.setTimeout(stop, GHOST_CLICK_MS);
}

/** Scroll the grid so the block being edited sits above the sheet rather than under it. */
function liftAnchorAbove(anchor: HTMLElement, sheet: HTMLElement) {
  let scroller: HTMLElement | null = anchor.parentElement;
  while (scroller && !/(auto|scroll)/.test(getComputedStyle(scroller).overflowY))
    scroller = scroller.parentElement;
  if (!scroller) return;
  const rect = anchor.getBoundingClientRect();
  const top = scroller.getBoundingClientRect().top;
  const sheetTop = window.innerHeight - sheet.offsetHeight;
  // as far as needed to clear the sheet, never so far that the block leaves by the top
  const by = Math.min(rect.bottom - (sheetTop - 12), rect.top - (top + 8));
  if (by <= 0) return;
  scroller.scrollBy({ top: by, behavior: prefersReducedMotion() ? "auto" : "smooth" });
}

/** Fixed-position the panel beside its anchor block: entrance on mount, morph on re-anchor, re-clamp on scroll/resize. */
export function useAnchoredPanel(
  wrapRef: RefObject<HTMLDivElement | null>,
  getAnchor: (id: string) => HTMLElement | null,
  eventId: string,
) {
  const posRef = useRef<Pos>({ x: 0, y: 0, side: "right" });
  const mountedRef = useRef(false);

  const computePos = (anchor: DOMRect): Pos => {
    const wrap = wrapRef.current;
    const h = wrap?.offsetHeight ?? 200;
    let side: Pos["side"] = "right";
    let x = anchor.right + GAP;
    if (x + PANEL_WIDTH > window.innerWidth - MARGIN) {
      side = "left";
      x = anchor.left - GAP - PANEL_WIDTH;
      if (x < MARGIN) x = MARGIN; // a column wider than the room beside it: best effort
    }
    const y = Math.min(
      Math.max(anchor.top, MARGIN),
      Math.max(MARGIN, window.innerHeight - h - MARGIN),
    );
    return { x, y, side };
  };

  /** Returns whether the panel is (now) a sheet, which has no position to apply. */
  const applySheet = (anchor: DOMRect): boolean => {
    const wrap = wrapRef.current;
    if (!wrap) return false;
    const sheet = wantsSheet(anchor);
    if (sheet === (wrap.dataset.sheet !== undefined)) return sheet;
    if (sheet) {
      wrap.dataset.sheet = "";
      wrap.style.transform = "";
      delete wrap.dataset.side;
    } else {
      delete wrap.dataset.sheet;
    }
    return sheet;
  };

  const applyPos = (p: Pos) => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    posRef.current = p;
    wrap.style.transform = `translate(${p.x}px, ${p.y}px)`;
    wrap.dataset.side = p.side;
  };

  const reanchor = (animate: boolean) => {
    const anchor = getAnchor(eventId);
    const wrap = wrapRef.current;
    if (!anchor || !wrap) return;
    const rect = anchor.getBoundingClientRect();
    if (applySheet(rect)) return;
    const prev = posRef.current;
    const next = computePos(rect);
    if (animate && !prefersReducedMotion()) {
      wrap.animate(
        [
          { transform: `translate(${prev.x}px, ${prev.y}px)` },
          { transform: `translate(${next.x}px, ${next.y}px)` },
        ],
        { duration: ENTER_MS, easing: EASE_OUT },
      );
    }
    applyPos(next);
  };

  // entrance on first mount, morph on anchor change
  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const anchor = getAnchor(eventId);
    if (!wrap || !anchor) return;
    const card = wrap.querySelector<HTMLElement>("[data-slot=card]");

    if (!mountedRef.current) {
      mountedRef.current = true;
      const rect = anchor.getBoundingClientRect();
      const sheet = applySheet(rect);
      let from = "translateY(1rem)";
      if (sheet) {
        swallowGhostClick(wrap);
        liftAnchorAbove(anchor, wrap);
      } else {
        const p = computePos(rect);
        applyPos(p);
        if (card) card.style.transformOrigin = p.side === "right" ? "left top" : "right top";
        from = "scale(0.98)";
      }
      card?.animate(
        prefersReducedMotion()
          ? [{ opacity: 0 }, { opacity: 1 }]
          : [
              { opacity: 0, transform: from },
              { opacity: 1, transform: "none" },
            ],
        { duration: ENTER_MS, easing: EASE_OUT },
      );
    } else {
      reanchor(true);
      card?.animate([{ opacity: 0.5 }, { opacity: 1 }], {
        duration: ENTER_MS,
        easing: EASE_OUT,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  useEffect(() => {
    let frame = 0;
    const onShift = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        reanchor(false);
      });
    };
    window.addEventListener("scroll", onShift, { capture: true, passive: true });
    window.addEventListener("resize", onShift, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onShift, { capture: true });
      window.removeEventListener("resize", onShift);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  // re-anchor on resize so the y clamp sees the new height; skipped while a drag drives position.
  // A sheet that grew (a row was added) may have risen over the block again, so lift it once more;
  // never on scroll, which would fight the user.
  const latest = useLatest({ reanchor, getAnchor, eventId });
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || typeof ResizeObserver === "undefined") return;
    let first = true;
    const ro = new ResizeObserver(() => {
      if (first) {
        first = false;
        return;
      }
      if (wrap.dataset.following !== undefined) return;
      latest.current.reanchor(false);
      const anchor = latest.current.getAnchor(latest.current.eventId);
      if (anchor && wrap.dataset.sheet !== undefined) liftAnchorAbove(anchor, wrap);
    });
    ro.observe(wrap);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { reanchor };
}
