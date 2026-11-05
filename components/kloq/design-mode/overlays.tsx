"use client";

import * as React from "react";
import type { KloqSettings } from "../lib/calendar-config";
import { Button } from "../ui/button";
import { ToggleGroup, ToggleGroupItem } from "../ui/toggle-group";
import { useDesignMode } from "./design-mode-provider";
import { Range, Section, Toggle } from "./panel";
import type { Overlays, PanelState } from "./panel-state";
import { timelineAxisOf } from "./timeline-axis";

const scopeOf = (ref: React.RefObject<HTMLElement | null> | null) =>
  ref?.current ?? document.querySelector<HTMLElement>("[data-kloq-root]");

/** Fixed layer over the visible part of the grid, ruled at the snap step: down a time grid, across a timeline. */
function SnapLines({ settings }: { settings: KloqSettings }) {
  const { scopeRef } = useDesignMode();
  const ref = React.useRef<HTMLDivElement>(null);
  const step =
    settings.minutesToPx(settings.dayStartMin + settings.snapMinutes) -
    settings.minutesToPx(settings.dayStartMin);
  const latest = React.useRef(step);
  React.useEffect(() => {
    latest.current = step;
  });
  React.useEffect(() => {
    const el = ref.current!;
    let raf = 0;
    const hide = () => {
      el.style.display = "none";
    };
    const show = (left: number, top: number, width: number, height: number) => {
      el.style.display = "";
      el.style.transform = `translate(${left}px, ${top}px)`;
      el.style.width = `${width}px`;
      el.style.height = `${height}px`;
    };
    const place = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const scope = scopeOf(scopeRef);
        const canvas = scope?.querySelector<HTMLElement>("[data-cal-canvas]");
        if (canvas) {
          const r = canvas.getBoundingClientRect();
          const clip =
            canvas.closest<HTMLElement>("[data-cal-scroll]")?.getBoundingClientRect() ??
            new DOMRect(0, 0, innerWidth, innerHeight);
          const top = Math.max(r.top, clip.top);
          const bottom = Math.min(r.bottom, clip.bottom);
          if (bottom <= top) return hide();
          el.dataset.axis = "y";
          el.style.backgroundSize = `100% ${latest.current}px`;
          el.style.backgroundPosition = `0 ${r.top - top}px`;
          return show(r.left, top, r.width, bottom - top);
        }
        const axis = timelineAxisOf(scope);
        const track = axis?.canvas.querySelector<HTMLElement>('[data-slot="timeline-row"]');
        const gutter = axis?.canvas.querySelector<HTMLElement>('[data-slot="resource-gutter"]');
        if (!axis || !track) return hide();
        const t = track.getBoundingClientRect();
        const c = axis.canvas.getBoundingClientRect();
        const clip =
          axis.canvas
            .closest<HTMLElement>('[data-slot="timeline-scroll"]')
            ?.getBoundingClientRect() ?? new DOMRect(0, 0, innerWidth, innerHeight);
        const left = Math.max(t.left, gutter?.getBoundingClientRect().right ?? clip.left);
        const right = Math.min(t.right, clip.right);
        const top = Math.max(c.top, clip.top);
        const bottom = Math.min(c.bottom, clip.bottom);
        if (right <= left || bottom <= top) return hide();
        el.dataset.axis = "x";
        el.style.backgroundSize = `${axis.slotPx}px 100%`;
        el.style.backgroundPosition = `${t.left - left}px 0`;
        show(left, top, right - left, bottom - top);
      });
    };
    place();
    window.addEventListener("scroll", place, { capture: true, passive: true });
    window.addEventListener("resize", place, { passive: true });
    const scope = scopeOf(scopeRef);
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(place);
    const mo = new MutationObserver(place);
    if (scope) {
      ro?.observe(scope);
      // a view switch swaps the canvas and zoom rescales it: watch those, not every style write
      mo.observe(scope, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ["data-slot-px", "data-window-start"],
      });
    }
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", place, { capture: true });
      window.removeEventListener("resize", place);
      ro?.disconnect();
      mo.disconnect();
    };
  }, [scopeRef, step]);
  return <div ref={ref} className="dm-snap-lines" aria-hidden />;
}

export function OverlayLayers({
  overlays,
  width,
  settings,
}: {
  overlays: Overlays;
  width: number | null;
  settings: KloqSettings;
}) {
  const { scopeRef } = useDesignMode();

  React.useEffect(() => {
    const root = document.documentElement;
    if (overlays.hitAreas) root.setAttribute("data-dm-hit", "");
    else root.removeAttribute("data-dm-hit");
    return () => root.removeAttribute("data-dm-hit");
  }, [overlays.hitAreas]);

  React.useEffect(() => {
    const root = scopeOf(scopeRef);
    if (!root) return;
    if (width) {
      root.style.width = `${width}px`;
      root.style.maxWidth = "100%";
      root.style.marginInline = "auto";
      root.style.outline = "1px dashed var(--brand)";
      root.style.outlineOffset = "-1px";
    }
    return () => {
      root.style.width = "";
      root.style.maxWidth = "";
      root.style.marginInline = "";
      root.style.outline = "";
      root.style.outlineOffset = "";
    };
  }, [width, scopeRef]);

  return (
    <>
      {overlays.dim ? <div className="dm-backdrop" aria-hidden /> : null}
      {overlays.grid ? <div className="dm-grid" aria-hidden /> : null}
      {overlays.snapLines ? <SnapLines settings={settings} /> : null}
    </>
  );
}

const WIDTHS = [
  { at: 375, label: "phone" },
  { at: 640, label: "narrow breakpoint" },
  { at: 768, label: "tablet" },
  { at: 1024, label: "laptop" },
];

export function OverlaysSection({
  state,
  patch,
}: {
  state: PanelState;
  patch: (p: Partial<PanelState>) => void;
}) {
  const o = state.overlays;
  const set = (k: keyof Overlays) => (v: boolean) => patch({ overlays: { ...o, [k]: v } });
  const on = Object.values(o).filter(Boolean).length + (state.width ? 1 : 0);
  return (
    <Section id="overlays" title="Overlays" summary={on ? `${on} on` : "off"}>
      <Toggle id="dm-grid" label="8pt grid" checked={o.grid} onChange={set("grid")} />
      <Toggle id="dm-snap" label="Snap lines" checked={o.snapLines} onChange={set("snapLines")} />
      <Toggle
        id="dm-hit"
        label="Hit areas (resize handles)"
        checked={o.hitAreas}
        onChange={set("hitAreas")}
      />
      <Toggle id="dm-dim" label="Dim page" checked={o.dim} onChange={set("dim")} />
      <div className="flex flex-col gap-2 border-t pt-2">
        <div className="flex items-center justify-between">
          <span className="font-sans text-xs font-medium">Host width</span>
          <Button
            variant="ghost"
            size="xs"
            disabled={!state.width}
            onClick={() => patch({ width: null })}
          >
            {state.width ? "Fill" : "Filling"}
          </Button>
        </div>
        <Range
          label="width"
          value={state.width ?? Math.round(innerWidth)}
          min={320}
          max={Math.max(1600, Math.round(innerWidth))}
          step={8}
          unit="px"
          onChange={(width) => patch({ width })}
        />
        <ToggleGroup
          size="xs"
          variant="outline"
          aria-label="Host width presets"
          value={state.width ? [String(state.width)] : []}
          onValueChange={(v) => patch({ width: v.length ? Number(v[v.length - 1]) : null })}
        >
          {WIDTHS.map((w) => (
            <ToggleGroupItem
              key={w.at}
              value={String(w.at)}
              aria-label={`${w.at}px, ${w.label}`}
              className="tabular-nums"
            >
              {w.at}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
    </Section>
  );
}
