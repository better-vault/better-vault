"use client";

/**
 * timeline-block — one bar. Same engine contract as the calendar's EventBlock:
 * `data-cal-event`, a registered node, forwarded pointerdown, a
 * `[data-slot="event-time"]` node and `[data-resize-edge]` zones.
 */

import type React from "react";
import { memo, useCallback } from "react";
import { FOCUS_RING } from "../calendar/cell-classes";
import { samePlacement } from "../calendar/event-block";
import { useKloqSettings } from "../calendar/settings-context";
import type { KloqSettings } from "../lib/calendar-config";
import type { PlacedEvent } from "../lib/calendar-types";
import { EVENT_COLORS, EVENT_TEXT_CSS, EVENT_TIME_CSS } from "../lib/event-palette";
import { eventTitle } from "../lib/event-text";
import { isBusy } from "../lib/event-types";
import { displayDate, minutesOfDate } from "../lib/instant";
import { instantAtMinute, type TimelineWindow } from "../lib/timeline-window";
import { cn } from "../lib/utils";

const MS_PER_DAY = 86_400_000;

/** Below this a bar has no room for its colour rule and padding: the title alone, edge to edge. */
export const CRAMPED_BAR_PX = 40;

/** The drag engine resizes a bar without React; it keeps the cramped treatment in step through this. */
export function setCramped(node: HTMLElement, widthPx: number): void {
  node.toggleAttribute("data-cramped", widthPx < CRAMPED_BAR_PX);
}

export const ALL_DAY_LABEL = "All day";

/** Window-relative minutes → the time-range label the calendar prints; shared with the drag engine's live label. */
export function formatBarRange(
  window: TimelineWindow,
  g: Pick<KloqSettings, "displayZone" | "formatRange">,
  startMin: number,
  endMin: number,
): string {
  const startOfDay = minutesOfDate(displayDate(instantAtMinute(window, startMin), g.displayZone));
  return g.formatRange(startOfDay, startOfDay + (endMin - startMin));
}

export interface TimelineBlockProps {
  event: PlacedEvent;
  /** the window the bar's `startMin`/`endMin` are measured from (window origin, not midnight) */
  window: TimelineWindow;
  left: number;
  width: number;
  top: number;
  height: number;
  selected: boolean;
  /** part of a selection of several bars */
  multi?: boolean;
  /** roving tabindex from the owning grid; defaults to -1 (no default focus stop) */
  tabIndex?: number;
  registerNode: (id: string, node: HTMLElement | null) => void;
  onPointerDown?: (e: React.PointerEvent<HTMLElement>, event: PlacedEvent) => void;
  /** keyboard/AT activation — Enter, Space, synthesised clicks; never pointer gestures */
  onActivate?: (event: PlacedEvent) => void;
}

function sameBar(a: TimelineBlockProps, b: TimelineBlockProps): boolean {
  return (
    samePlacement(a.event, b.event) &&
    a.window === b.window &&
    a.left === b.left &&
    a.width === b.width &&
    a.top === b.top &&
    a.height === b.height &&
    a.selected === b.selected &&
    a.multi === b.multi &&
    a.tabIndex === b.tabIndex &&
    a.registerNode === b.registerNode &&
    a.onPointerDown === b.onPointerDown &&
    a.onActivate === b.onActivate
  );
}

export const TimelineBlock = memo(function TimelineBlock({
  event,
  window,
  left,
  width,
  top,
  height,
  selected,
  multi = false,
  tabIndex,
  registerNode,
  onPointerDown,
  onActivate,
}: TimelineBlockProps) {
  const g = useKloqSettings();
  const c = EVENT_COLORS[event.color];
  const title = eventTitle(event);
  const timeText = event.allDay
    ? ALL_DAY_LABEL
    : formatBarRange(window, g, event.startMin, event.endMin);
  const manyDays = window.end.getTime() - window.start.getTime() > MS_PER_DAY;
  const day = manyDays
    ? displayDate(instantAtMinute(window, event.startMin), g.displayZone).toLocaleDateString(
        g.locale,
        { weekday: "long" },
      )
    : null;
  const label = `${title}, ${timeText}` + (day ? `, ${day}` : "") + (multi ? ", selected" : "");

  const id = event.id;
  const ref = useCallback((node: HTMLElement | null) => registerNode(id, node), [registerNode, id]);

  return (
    <div
      ref={ref}
      data-cal-event={event.id}
      role="button"
      tabIndex={tabIndex ?? -1}
      aria-pressed={selected}
      aria-label={label}
      title={`${title}, ${timeText}`}
      data-all-day={event.allDay || undefined}
      data-cramped={width < CRAMPED_BAR_PX || undefined}
      data-selected={selected || undefined}
      data-multi-selected={multi || undefined}
      data-free={isBusy(event) ? undefined : ""}
      onPointerDown={(e) => onPointerDown?.(e, event)}
      onClick={(e) => {
        if (e.detail === 0) onActivate?.(event);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onActivate?.(event);
        }
      }}
      className={cn(
        "group absolute z-10 flex cursor-grab touch-none select-none items-center overflow-hidden rounded-md ps-2.5 pe-2 transition-[background-color,box-shadow] duration-150",
        "focus-visible:z-20",
        FOCUS_RING,
        c.tint,
        c.ink,
        selected && cn("z-20 shadow-lg ring-2", c.ring),
        multi && "ring-ring ring-offset-1 ring-offset-background",
      )}
      style={{ left, width, top, height, color: EVENT_TEXT_CSS }}
    >
      <span
        aria-hidden
        data-slot="event-bar"
        className={cn("absolute inset-y-1 start-1 w-0.75 rounded-full", c.bar)}
      />
      {/* one line tall and wrapping: a time that does not fit beside the title drops out whole */}
      <div className="flex h-lh min-w-0 flex-1 flex-wrap items-baseline gap-x-1 overflow-hidden text-(length:--kloq-event-font-size) leading-tight">
        <span className="max-w-full truncate text-(length:--kloq-event-font-size) font-medium leading-tight">
          {title}
        </span>
        <span
          className="whitespace-nowrap text-(length:--kloq-event-time-font-size) leading-tight"
          style={{ color: EVENT_TIME_CSS }}
          data-slot="event-time"
        >
          {timeText}
        </span>
      </div>

      <div
        aria-hidden
        data-resize-edge="start"
        className="absolute inset-y-0 -start-1 w-2 cursor-ew-resize pointer-coarse:-start-3 pointer-coarse:w-6"
      />
      <div
        aria-hidden
        data-resize-edge="end"
        className="absolute inset-y-0 -end-1 flex w-2 cursor-ew-resize items-center justify-center pointer-coarse:-end-3 pointer-coarse:w-6"
      >
        <span
          className={cn(
            "h-6 w-0.75 rounded-full opacity-0 transition-opacity duration-150 group-hover:opacity-60",
            c.bar,
          )}
        />
      </div>
    </div>
  );
}, sameBar);
