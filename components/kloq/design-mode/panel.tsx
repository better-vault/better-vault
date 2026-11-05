"use client";

import { ChevronDown, ChevronsDownUp, ChevronsUpDown, GripHorizontal, Move, X } from "@/components/kloq/lib/icons";
import * as React from "react";
import { cn } from "../lib/utils";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { SegmentedControl, SegmentedControlItem } from "../ui/segmented-control";
import { Slider } from "../ui/slider";
import { Switch } from "../ui/switch";
import type { Corner, PanelState } from "./panel-state";

interface PanelContextValue {
  open: Record<string, boolean>;
  toggle: (id: string) => void;
}
const PanelContext = React.createContext<PanelContextValue | null>(null);

const CORNER_CLASS: Record<Corner, string> = {
  tl: "items-start justify-start",
  tr: "items-start justify-end",
  bl: "items-end justify-start",
  br: "items-end justify-end",
};
const NEXT_CORNER: Record<Corner, Corner> = { tl: "tr", tr: "br", br: "bl", bl: "tl" };

interface PanelProps {
  state: PanelState;
  patch: (p: Partial<PanelState>) => void;
  onClose: () => void;
  children: React.ReactNode;
}

export const Panel = React.forwardRef<HTMLDivElement, PanelProps>(function Panel(
  { state, patch, onClose, children },
  ref,
) {
  const innerRef = React.useRef<HTMLDivElement>(null);
  React.useImperativeHandle(ref, () => innerRef.current!);
  const [drag, setDrag] = React.useState<{ dx: number; dy: number } | null>(null);

  const onHandleDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || (e.target as Element).closest("button")) return;
    e.preventDefault();
    const el = innerRef.current!;
    const frame = el.parentElement!.getBoundingClientRect();
    const start = { x: e.clientX, y: e.clientY };
    const rect = el.getBoundingClientRect();
    el.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) =>
      setDrag({ dx: ev.clientX - start.x, dy: ev.clientY - start.y });
    const up = (ev: PointerEvent) => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      const cx = rect.left + rect.width / 2 + (ev.clientX - start.x);
      const cy = rect.top + rect.height / 2 + (ev.clientY - start.y);
      const corner =
        `${cy < frame.top + frame.height / 2 ? "t" : "b"}${cx < frame.left + frame.width / 2 ? "l" : "r"}` as Corner;
      setDrag(null);
      patch({ corner });
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
  };

  const ctx = React.useMemo<PanelContextValue>(
    () => ({
      open: state.open,
      toggle: (id) => patch({ open: { ...state.open, [id]: !state.open[id] } }),
    }),
    [state.open, patch],
  );
  const allOpen = Object.values(state.open).every(Boolean);

  return (
    <PanelContext.Provider value={ctx}>
      <div
        className={cn(
          // clear of the calendar's own toolbar row at the top and the hint bar at the bottom
          "pointer-events-none absolute inset-x-4 top-14 bottom-12 z-20 flex max-sm:inset-x-2 max-sm:items-end",
          CORNER_CLASS[state.corner],
        )}
      >
        <div
          ref={innerRef}
          data-dm-panel
          role="region"
          aria-label="Design mode"
          className="pointer-events-auto flex max-h-full w-72 flex-col overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-lg max-sm:max-h-3/5 max-sm:w-full"
          style={drag ? { transform: `translate(${drag.dx}px, ${drag.dy}px)` } : undefined}
        >
          <div
            className="flex shrink-0 cursor-grab select-none items-center gap-1 border-b py-1 pe-1 ps-2 active:cursor-grabbing"
            onPointerDown={onHandleDown}
          >
            <GripHorizontal className="size-3.5 text-muted-foreground" aria-hidden />
            <span className="ms-1 flex-1 font-sans text-sm font-semibold">Design</span>
            <Button
              variant="ghost"
              size="icon-xs"
              className="max-sm:hidden"
              aria-label="Move panel to the next corner"
              onClick={() => patch({ corner: NEXT_CORNER[state.corner] })}
            >
              <Move />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={allOpen ? "Collapse all sections" : "Expand all sections"}
              onClick={() =>
                patch({
                  open: Object.fromEntries(Object.keys(state.open).map((k) => [k, !allOpen])),
                })
              }
            >
              {allOpen ? <ChevronsDownUp /> : <ChevronsUpDown />}
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={state.collapsed ? "Expand panel" : "Collapse panel"}
              aria-expanded={!state.collapsed}
              onClick={() => patch({ collapsed: !state.collapsed })}
            >
              <ChevronDown
                className={cn("transition-transform", state.collapsed && "-rotate-90")}
              />
            </Button>
            <Button variant="ghost" size="icon-xs" aria-label="Close design mode" onClick={onClose}>
              <X />
            </Button>
          </div>
          {state.collapsed ? null : (
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain font-mono text-xs">
              {children}
            </div>
          )}
        </div>
      </div>
    </PanelContext.Provider>
  );
});

export function Section({
  id,
  title,
  summary,
  children,
}: {
  id: string;
  title: string;
  /** shown in the header while closed */
  summary?: React.ReactNode;
  children: React.ReactNode;
}) {
  const ctx = React.useContext(PanelContext)!;
  const open = ctx.open[id] ?? false;
  const bodyId = `dm-section-${id}`;
  return (
    <section className="border-b last:border-b-0">
      <div className="p-1">
        <Button
          variant="ghost"
          size="sm"
          aria-expanded={open}
          aria-controls={open ? bodyId : undefined}
          onClick={() => ctx.toggle(id)}
          className="w-full justify-start"
        >
          <ChevronDown
            className={cn("text-muted-foreground transition-transform", !open && "-rotate-90")}
            aria-hidden
          />
          <span className="font-semibold">{title}</span>
          {!open && summary ? (
            <span className="ms-auto min-w-0 truncate font-mono text-xs font-normal text-muted-foreground tabular-nums">
              {summary}
            </span>
          ) : null}
        </Button>
      </div>
      {open ? (
        <div id={bodyId} className="flex flex-col gap-2 px-3 pb-3">
          {children}
        </div>
      ) : null}
    </section>
  );
}

export function Row({
  label,
  children,
  className,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 items-baseline justify-between gap-3", className)}>
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate text-end tabular-nums">{children}</span>
    </div>
  );
}

export function Toggle({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: React.ReactNode;
  checked: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <div className="flex min-h-6 items-center justify-between gap-3">
      <Label htmlFor={id} size="sm" className="cursor-pointer font-normal">
        {label}
      </Label>
      <Switch id={id} checked={checked} onCheckedChange={(v) => onChange(v === true)} />
    </div>
  );
}

export function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <SegmentedControl<T>
      size="sm"
      aria-label={label}
      value={value}
      onValueChange={(v) => onChange(v as T)}
    >
      {options.map((o) => (
        <SegmentedControlItem<T> key={String(o.value)} value={o.value}>
          {o.label}
        </SegmentedControlItem>
      ))}
    </SegmentedControl>
  );
}

export function Range({
  label,
  value,
  min,
  max,
  step = 1,
  unit = "",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
}) {
  const id = React.useId();
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span id={id} className="text-muted-foreground">
          {label}
        </span>
        <span className="tabular-nums">
          {value}
          {unit}
        </span>
      </div>
      <Slider
        aria-labelledby={id}
        value={value}
        min={min}
        max={max}
        step={step}
        onValueChange={(v) => onChange(Array.isArray(v) ? v[0] : v)}
      />
    </div>
  );
}
