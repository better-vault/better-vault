"use client";

import * as React from "react";
import { useKloqSettings } from "../calendar/settings-context";
import { useOptionalKloqStore } from "../calendar/store-context";
import { useDesignMode } from "./design-mode-provider";
import { InspectLayer, InspectSection } from "./inspect";
import { MotionSection } from "./motion";
import { NetworkSection } from "./network";
import { OverlayLayers, OverlaysSection } from "./overlays";
import { Panel } from "./panel";
import { usePanelState } from "./panel-state";
import { ThemeSection } from "./theme";

/** Keeps the overlay's frame on the visible part of the calendar it belongs to, or the viewport when unscoped. */
function useScopeFrame(scopeRef: React.RefObject<HTMLElement | null> | null) {
  const frameRef = React.useRef<HTMLDivElement>(null);
  React.useLayoutEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const root = scopeRef?.current ?? null;
    let raf = 0;
    const place = () => {
      const r = root?.getBoundingClientRect() ?? new DOMRect(0, 0, innerWidth, innerHeight);
      const top = Math.max(0, r.top);
      const left = Math.max(0, r.left);
      el.style.top = `${top}px`;
      el.style.left = `${left}px`;
      el.style.width = `${Math.max(0, Math.min(innerWidth, r.right) - left)}px`;
      el.style.height = `${Math.max(0, Math.min(innerHeight, r.bottom) - top)}px`;
    };
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(place);
    };
    place();
    window.addEventListener("scroll", schedule, { capture: true, passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    const ro = root && typeof ResizeObserver !== "undefined" ? new ResizeObserver(schedule) : null;
    if (root) ro?.observe(root);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", schedule, { capture: true });
      window.removeEventListener("resize", schedule);
      ro?.disconnect();
    };
  }, [scopeRef]);
  return frameRef;
}

export const DesignModeOverlay = React.memo(
  function DesignModeOverlay(): React.ReactElement | null {
    const { enabled } = useDesignMode();
    return enabled ? <Overlay /> : null;
  },
);

function Overlay(): React.ReactElement {
  const { setEnabled, scopeRef } = useDesignMode();
  const [state, patch] = usePanelState();
  const store = useOptionalKloqStore();
  const settings = useKloqSettings();
  const frameRef = useScopeFrame(scopeRef);
  return (
    // not aria-hidden: the panel holds real controls; decorative layers opt out individually
    <div ref={frameRef} data-design-overlay className="pointer-events-none fixed z-50">
      <OverlayLayers overlays={state.overlays} width={state.width} settings={settings} />
      <InspectLayer store={store} settings={settings} />
      <Panel state={state} patch={patch} onClose={() => setEnabled(false)}>
        <InspectSection />
        <MotionSection settings={settings} />
        <OverlaysSection state={state} patch={patch} />
        <ThemeSection />
        <NetworkSection />
      </Panel>
    </div>
  );
}
