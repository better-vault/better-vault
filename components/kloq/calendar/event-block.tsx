"use client";

import type React from "react";
import { memo } from "react";
import {
  continuesAfter,
  continuesBefore,
  displayDate,
  isBusy,
  minutesOfDate,
  type PlacedEvent,
  parseInstant,
  wallMinutesBetween,
} from "../lib/calendar-types";
import { EVENT_COLORS, EVENT_TEXT_CSS, EVENT_TIME_CSS } from "../lib/event-palette";
import { eventTitle } from "../lib/event-text";
import type { PlacedOccurrence } from "../lib/projection";
import { cn } from "../lib/utils";
import { FOCUS_RING } from "./cell-classes";
import { useKloqSettings } from "./settings-context";

export { EVENT_COLORS };

export interface EventLayout {
  /** column within an overlap cluster */
  col: number;
  cols: number;
}

export interface EventBlockProps {
  event: PlacedEvent;
  /** visible column count from the view descriptor */
  dayCount: number;
  /** short day name per visible column (`view.namesShort`) */
  dayNamesShort: string[];
  layout: EventLayout;
  selected: boolean;
  /** multi-selection context; the accessible name carries "n of m selected" */
  selection?: { index: number; count: number };
  /** roving tabindex from the owning grid; defaults to `selected ? 0 : -1` */
  tabIndex?: number;
  registerNode: (id: string, node: HTMLElement | null) => void;
  onPointerDown: (e: React.PointerEvent<HTMLElement>, event: PlacedEvent) => void;
  /** keyboard/AT activation — Enter, Space, synthesised clicks; never pointer gestures */
  onActivate?: (event: PlacedEvent) => void;
}

const sameShallow = (a: unknown, b: unknown): boolean => {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  if (Array.isArray(a) || Array.isArray(b)) return false;
  const ra = a as Record<string, unknown>;
  const rb = b as Record<string, unknown>;
  const keys = Object.keys(ra);
  return keys.length === Object.keys(rb).length && keys.every((k) => Object.is(ra[k], rb[k]));
};

/** Field-equal placements: a re-projection hands every block a new object for the same event. */
export function samePlacement(a: PlacedEvent, b: PlacedEvent): boolean {
  if (a === b) return true;
  const ra = a as unknown as Record<string, unknown>;
  const rb = b as unknown as Record<string, unknown>;
  const keys = Object.keys(ra);
  return keys.length === Object.keys(rb).length && keys.every((k) => sameShallow(ra[k], rb[k]));
}

function sameBlock(a: EventBlockProps, b: EventBlockProps): boolean {
  return (
    samePlacement(a.event, b.event) &&
    sameShallow(a.layout, b.layout) &&
    sameShallow(a.selection, b.selection) &&
    a.dayCount === b.dayCount &&
    a.dayNamesShort === b.dayNamesShort &&
    a.selected === b.selected &&
    a.tabIndex === b.tabIndex &&
    a.registerNode === b.registerNode &&
    a.onPointerDown === b.onPointerDown &&
    a.onActivate === b.onActivate
  );
}

export const EventBlock = memo(function EventBlock({
  event,
  dayCount,
  dayNamesShort,
  layout,
  selected,
  selection,
  tabIndex,
  registerNode,
  onPointerDown,
  onActivate,
}: EventBlockProps) {
  const g = useKloqSettings();
  const c = EVENT_COLORS[event.color];
  const title = eventTitle(event);
  const dayName = dayNamesShort[event.dayIndex] ?? `Day ${event.dayIndex + 1}`;
  const multi = selected && selection !== undefined && selection.count > 1;
  // a cross-midnight event is one block per day (`segment`)
  const before = continuesBefore(event);
  const after = continuesAfter(event);
  // a segment's minutes are the clipped slice; the label shows the event's real span
  const own = event as Partial<PlacedOccurrence>;
  const timeText =
    event.segment.n > 1 && own.start && own.end
      ? (() => {
          const s = minutesOfDate(displayDate(parseInstant(own.start!), g.displayZone));
          return g.formatRange(s, s + wallMinutesBetween(own.start!, own.end!, g.displayZone));
        })()
      : g.formatRange(event.startMin, event.endMin);
  // title then time, in the order the block renders them: a labelled widget
  // whose visible text isn't part of its accessible name breaks speech input
  // (and trips axe's label-content-name-mismatch)
  const label =
    `${title}, ${timeText}, ${dayName}` +
    (before ? ", continued from the previous day" : "") +
    (after ? ", continues" : "") +
    (multi ? `, ${selection!.index} of ${selection!.count} selected` : "");
  const top = g.minutesToPx(event.startMin);
  const height = g.durationToPx(event.endMin - event.startMin);
  const dayPct = 100 / dayCount;
  const slice = dayPct / layout.cols;
  const left = event.dayIndex * dayPct + layout.col * slice;
  const width = slice;
  const compact = height < 40;

  return (
    <div
      data-cal-event={event.id}
      data-day={event.dayIndex}
      data-col={layout.col}
      data-cols={layout.cols}
      ref={(node) => registerNode(event.id, node)}
      onPointerDown={(e) => onPointerDown(e, event)}
      // `detail === 0` marks a click no pointer produced (AT activation)
      onClick={(e) => {
        if (e.detail === 0) onActivate?.(event);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onActivate?.(event);
        }
      }}
      data-selected={selected || undefined}
      data-multi-selected={multi || undefined}
      // absent `busy` means busy; "free" is hatched in chrono.css
      data-free={isBusy(event) ? undefined : ""}
      data-continues-before={before || undefined}
      data-continues-after={after || undefined}
      role="button"
      // aria-pressed: role="button" doesn't support aria-selected
      aria-pressed={selected}
      aria-label={label}
      tabIndex={tabIndex ?? (selected ? 0 : -1)}
      className={cn(
        "group absolute z-10 flex cursor-grab touch-none select-none flex-col rounded-md ps-2.5 pe-2 transition-[background-color,box-shadow] duration-150",
        before && "rounded-t-none",
        after && "rounded-b-none",
        // the per-column list is `pointer-events-none`
        "pointer-events-auto",
        "focus-visible:z-20",
        FOCUS_RING,
        compact ? "justify-center py-0" : "gap-0.5 py-1.5",
        c.tint,
        c.ink,
        selected && cn("z-20 shadow-(--shadow-lg) ring-2", c.ring),
        multi && "ring-ring ring-offset-1 ring-offset-background",
      )}
      style={{
        top,
        height: Math.max(height - 2, 14),
        left: `calc(${left}% + 2px)`,
        width: `calc(${width}% - 5px)`,
        color: EVENT_TEXT_CSS,
      }}
    >
      <span
        aria-hidden
        data-slot="event-bar"
        className={cn("absolute inset-y-1 start-1 w-0.75 rounded-full", c.bar)}
      />
      {/* text clips here, not on the block — resize zones extend past its bounds */}
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col overflow-hidden",
          compact ? "justify-center" : "gap-0.5",
        )}
      >
        {compact ? (
          <span className="truncate text-xs font-medium leading-none">
            {title}{" "}
            <span className="ms-0.5" style={{ color: EVENT_TIME_CSS }} data-slot="event-time">
              {timeText}
            </span>
          </span>
        ) : (
          <>
            <span className="truncate text-(length:--kloq-event-font-size) font-medium leading-tight">
              {title}
            </span>{" "}
            <span
              className="truncate text-(length:--kloq-event-time-font-size) leading-tight"
              style={{ color: EVENT_TIME_CSS }}
              data-slot="event-time"
            >
              {timeText}
            </span>
          </>
        )}
      </div>

      {/* no resize edge at a midnight cut — it isn't the event's edge */}
      {before ? null : (
        <div
          aria-hidden
          data-resize-edge="start"
          // coarse pointers get a 24px hit zone (WCAG 2.2 target minimum)
          className="absolute -top-1 start-0 end-0 h-2 cursor-ns-resize pointer-coarse:-top-3 pointer-coarse:h-6"
        />
      )}
      {after ? null : (
        <div
          aria-hidden
          data-resize-edge="end"
          className="absolute -bottom-1 start-0 end-0 flex h-2 cursor-ns-resize items-center justify-center pointer-coarse:-bottom-3 pointer-coarse:h-6"
        >
          <span
            className={cn(
              "h-0.75 w-6 rounded-full opacity-0 transition-opacity duration-150 group-hover:opacity-60",
              c.bar,
            )}
          />
        </div>
      )}
    </div>
  );
}, sameBlock);
