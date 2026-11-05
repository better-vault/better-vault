"use client";

/** event-overflow — the "+N more" trigger and the popover listing what a cap hid. */

import type React from "react";
import { useState } from "react";
import type { PlacedEvent } from "../lib/calendar-types";
import { EVENT_COLORS } from "../lib/event-palette";
import { eventTitle } from "../lib/event-text";
import { cn } from "../lib/utils";
import { Button } from "../ui/button";
import { Popover, PopoverPopup, PopoverTrigger } from "../ui/popover";
import { CELL_HOVER, FOCUS_RING } from "./cell-classes";

export interface EventOverflowProps<E extends PlacedEvent = PlacedEvent> {
  /** how many events are hidden; nothing renders at 0 */
  count: number;
  /** the hidden events, or a thunk evaluated only while the popover is open */
  events: readonly E[] | (() => readonly E[]);
  /** the trigger's accessible name, e.g. "Show 3 more events on Monday, October 12" */
  label: string;
  /** the popover's heading */
  heading: string;
  onSelect?: (event: E) => void;
  /** accessible name for a row; defaults to the title */
  rowLabel?: (event: E) => string;
  /** trailing text for a row, e.g. the start time */
  rowMeta?: (event: E) => string | null | undefined;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
  tabIndex?: number;
  /** positions the trigger inside its cell */
  className?: string;
  style?: React.CSSProperties;
}

export function EventOverflow<E extends PlacedEvent = PlacedEvent>({
  count,
  events,
  label,
  heading,
  onSelect,
  rowLabel,
  rowMeta,
  side = "bottom",
  align = "center",
  tabIndex,
  className,
  style,
}: EventOverflowProps<E>) {
  const [open, setOpen] = useState(false);
  if (count <= 0) return null;
  const hidden = open ? (typeof events === "function" ? events() : events) : [];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        data-cal-more
        tabIndex={tabIndex}
        aria-label={label}
        className={cn(
          // touch: the trigger itself is the 24px target, so the shared `::before` hit area is not needed
          "z-20 flex h-4.5 cursor-pointer items-center rounded-xs px-1 text-2xs leading-none text-muted-foreground hover:text-foreground data-popup-open:bg-accent data-popup-open:text-foreground pointer-coarse:h-6 pointer-coarse:before:hidden",
          CELL_HOVER,
          FOCUS_RING,
          className,
        )}
        style={style}
      >
        +{count} more
      </PopoverTrigger>
      <PopoverPopup className="w-56" padding="sm" side={side} align={align}>
        <div className="flex w-full flex-col gap-0.5">
          <div className="px-1.5 py-1 text-xs font-medium text-muted-foreground">{heading}</div>
          {hidden.map((event) => {
            const meta = rowMeta?.(event);
            return (
              <Button
                key={event.id}
                variant="ghost"
                size="xs"
                aria-label={rowLabel?.(event)}
                className="w-full justify-start gap-1.5"
                onClick={() => {
                  setOpen(false);
                  onSelect?.(event);
                }}
              >
                <span
                  aria-hidden
                  className={cn("size-1.5 shrink-0 rounded-full", EVENT_COLORS[event.color].bar)}
                />
                <span className="min-w-0 flex-1 truncate text-start">{eventTitle(event)}</span>
                {meta ? (
                  <span className="shrink-0 font-normal text-muted-foreground">{meta}</span>
                ) : null}
              </Button>
            );
          })}
        </div>
      </PopoverPopup>
    </Popover>
  );
}
