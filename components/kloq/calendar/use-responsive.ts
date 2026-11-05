"use client";

/**
 * use-responsive — measure the calendar's own box (not the viewport), resolve the effective view.
 * The decision lives in `lib/responsive.ts`; render from `effective`, not the view setting.
 */

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import type { KloqView } from "../lib/calendar-types";
import {
  type EffectiveView,
  effectiveView,
  isNarrow,
  type ResolvedResponsive,
  type ResponsiveSetting,
  reconcileIntent,
  resolveResponsive,
} from "../lib/responsive";

interface UseResponsiveViewOptions {
  hostRef: React.RefObject<HTMLElement | null>;
  view: KloqView;
  /** `<Kloq responsive>`; on by default, `false` opts out entirely */
  responsive?: ResponsiveSetting;
  /** report a view change; MUST be the same function the switcher uses */
  onRequestView: (view: KloqView) => void;
}

export interface ResponsiveState extends EffectiveView {
  /** measured width of the host box, or 0 before the first observation */
  readonly width: number;
  readonly narrow: boolean;
  readonly config: ResolvedResponsive;
}

export function useResponsiveView({
  hostRef,
  view,
  responsive,
  onRequestView,
}: UseResponsiveViewOptions): ResponsiveState {
  const config = resolveResponsive(responsive);
  const [width, setWidth] = useState(0);

  const resolved = effectiveView(width, view, config);

  // held in a ref: the effect must re-run on width only, or the collapse fights the host
  const live = useRef({ view, onRequestView, config });
  useEffect(() => {
    // declared first so the width effect reads a current intent
    live.current = { view, onRequestView, config };
  });

  const collapsed = useRef<{ from: KloqView; to: KloqView } | null>(null);

  // a layout effect: the first frame painted on the client is already the view that fits
  useLayoutEffect(() => {
    const el = hostRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      // `contentRect.width`: the root's own padding is not room for columns
      setWidth(entries[0]?.contentRect.width ?? el.clientWidth);
    });
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, [hostRef]);

  useEffect(() => {
    const { view: intent, onRequestView: request, config: cfg } = live.current;
    if (!cfg.enabled || width <= 0) return;

    const memo = collapsed.current;
    if (memo && intent === memo.to) {
      // we're driving: re-resolve from the original intent across the tiers
      const back = reconcileIntent(width, intent, memo.from, memo.to, cfg);
      if (back === null) return;
      if (back === memo.from) collapsed.current = null;
      else memo.to = back;
      request(back);
      return;
    }

    const next = effectiveView(width, intent, cfg);
    if (next.collapsed) {
      collapsed.current = { from: intent, to: next.effective };
      request(next.effective);
    } else {
      collapsed.current = null;
    }
  }, [width]);

  return { ...resolved, width, narrow: isNarrow(width, config), config };
}

const COARSE = "(pointer: coarse)";
const watchCoarse = (onChange: () => void) => {
  const mq = matchMedia(COARSE);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
};
const isCoarse = () => matchMedia(COARSE).matches;
const notCoarse = () => false;

/** True on touch-first devices, where chips sit on a 24px pitch instead of the pointer one. */
export function useCoarsePointer(): boolean {
  return useSyncExternalStore(
    typeof matchMedia === "undefined" ? () => () => {} : watchCoarse,
    typeof matchMedia === "undefined" ? notCoarse : isCoarse,
    notCoarse,
  );
}
