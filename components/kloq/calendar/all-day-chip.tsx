"use client";

import type React from "react";
import { memo } from "react";
import { formatDaySpan, type PlacedEvent } from "../lib/calendar-types";
import { EVENT_COLORS, EVENT_TEXT_CSS } from "../lib/event-palette";
import { eventTitle } from "../lib/event-text";
import { cn } from "../lib/utils";
import { FOCUS_RING } from "./cell-classes";
import { samePlacement } from "./event-block";

export interface AllDayChipProps {
  event: PlacedEvent;
  /** visible column count from the view descriptor */
  dayCount: number;
  /** short day name per visible column (`view.namesShort`) */
  dayNamesShort: string[];
  /** stacking row within the lane */
  row: number;
  rowHeight: number;
  selected: boolean;
  /** roving tabindex from the owning lane; defaults to `selected ? 0 : -1` */
  tabIndex?: number;
  /** drag-engine contract: a custom chip must register its root and forward pointerdown */
  registerNode: (id: string, node: HTMLElement | null) => void;
  onPointerDown: (e: React.PointerEvent<HTMLElement>, event: PlacedEvent) => void;
  /** keyboard/AT activation — Enter, Space, synthesised clicks; never pointer gestures */
  onActivate?: (event: PlacedEvent) => void;
}

export const AllDayChip = memo(
  function AllDayChip({
    event,
    dayCount,
    dayNamesShort,
    row,
    rowHeight,
    selected,
    tabIndex,
    registerNode,
    onPointerDown,
    onActivate,
  }: AllDayChipProps) {
    const c = EVENT_COLORS[event.color];
    const startDay = event.dayIndex;
    const endDay = event.endDayIndex;
    const title = eventTitle(event);
    const label = `${title}, ${formatDaySpan(startDay, endDay, dayNamesShort)}, all day`;
    return (
      <div
        data-cal-event={event.id}
        data-day={startDay}
        data-end-day={endDay}
        data-selected={selected || undefined}
        role="button"
        // aria-pressed: role="button" doesn't support aria-selected
        aria-pressed={selected}
        aria-label={label}
        tabIndex={tabIndex ?? (selected ? 0 : -1)}
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
        className={cn(
          "group absolute flex h-5.5 cursor-grab items-center overflow-hidden rounded-md ps-2.5 pe-2 transition-[background-color,box-shadow] duration-150",
          // the list wrapper is `pointer-events-none`
          "pointer-events-auto",
          "focus-visible:z-20",
          FOCUS_RING,
          c.tint,
          c.ink,
          selected && cn("z-20 shadow-(--shadow-md) ring-2", c.ring),
        )}
        style={{
          top: row * rowHeight + 3,
          left: `calc(${(startDay / dayCount) * 100}% + 2px)`,
          width: `calc(${((endDay - startDay + 1) / dayCount) * 100}% - 5px)`,
          color: EVENT_TEXT_CSS,
        }}
      >
        <span aria-hidden className={cn("absolute inset-y-1 start-1 w-0.75 rounded-full", c.bar)} />
        <span className="truncate text-xs font-medium leading-none">{title}</span>

        <div
          aria-hidden
          data-lane-edge="left"
          className="absolute -start-1 top-0 bottom-0 flex w-2 cursor-ew-resize items-center justify-center pointer-coarse:-start-3 pointer-coarse:w-6"
        >
          <span
            className={cn(
              "h-3 w-0.75 rounded-full opacity-0 transition-opacity duration-150 group-hover:opacity-60",
              c.bar,
            )}
          />
        </div>
        <div
          aria-hidden
          data-lane-edge="right"
          className="absolute -end-1 top-0 bottom-0 flex w-2 cursor-ew-resize items-center justify-center pointer-coarse:-end-3 pointer-coarse:w-6"
        >
          <span
            className={cn(
              "h-3 w-0.75 rounded-full opacity-0 transition-opacity duration-150 group-hover:opacity-60",
              c.bar,
            )}
          />
        </div>
      </div>
    );
  },
  (a, b) =>
    samePlacement(a.event, b.event) &&
    a.dayCount === b.dayCount &&
    a.dayNamesShort === b.dayNamesShort &&
    a.row === b.row &&
    a.rowHeight === b.rowHeight &&
    a.selected === b.selected &&
    a.tabIndex === b.tabIndex &&
    a.registerNode === b.registerNode &&
    a.onPointerDown === b.onPointerDown &&
    a.onActivate === b.onActivate,
);
