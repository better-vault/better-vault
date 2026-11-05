"use client";

/** all-day-lane — the banner strip between the day headers and the scrollable grid. */

import type React from "react";
import { useCallback, useMemo } from "react";
import type { PlacedEvent } from "../lib/calendar-types";
import { disabledAllDayColumns } from "../lib/constraints";
import { plural } from "../lib/event-text";
import { rovingTab } from "../lib/roving";
import { useLatest } from "../lib/use-latest";
import { ContextMenu, ContextMenuTrigger } from "../ui/context-menu";
import { useConstraints } from "./constraints-context";
import {
  EventContextMenu,
  fallbackDays,
  GridContextMenu,
  useCalendarContextMenu,
} from "./event-context-menu";
import { EventOverflow } from "./event-overflow";
import { useSlots } from "./slots";
import { useCoarsePointer } from "./use-responsive";

const ROW_H = 24; // chip height (22) + 2px gap
const ROW_H_TOUCH = 26; // the 24px touch minimum + the same gap
const MAX_ROWS = 3;
const MORE_H = 18;

/** Greedy row assignment — first row whose last chip ends before this one starts. */
function layoutRows(events: PlacedEvent[]): Map<string, number> {
  const rows: number[] = []; // last occupied day per row
  const out = new Map<string, number>();
  const sorted = [...events].sort(
    (a, b) => a.dayIndex - b.dayIndex || b.endDayIndex - a.endDayIndex,
  );
  for (const e of sorted) {
    let row = rows.findIndex((last) => last < e.dayIndex);
    if (row === -1) {
      row = rows.length;
      rows.push(e.endDayIndex);
    } else {
      rows[row] = e.endDayIndex;
    }
    out.set(e.id, row);
  }
  return out;
}

const LANE_LABEL =
  "flex w-(--kloq-gutter-width,4rem) shrink-0 items-center justify-end pr-2.5 text-2xs text-muted-foreground select-none";

/** The lane before the calendar knows its date: the strip at its resting height, no columns. */
export function AllDayLaneFrame() {
  return (
    <div className="flex shrink-0 border-b">
      <div className={LANE_LABEL}>All day</div>
      <div className="h-7.5 min-w-0 flex-1 pointer-coarse:h-8" />
    </div>
  );
}

interface AllDayLaneProps {
  events: PlacedEvent[];
  /** visible column count from the view descriptor */
  dayCount: number;
  /** short day name per visible column (`view.namesShort`) — accessible names */
  dayNamesShort: string[];
  laneRef: React.RefObject<HTMLDivElement | null>;
  laneDraftRef: React.RefObject<HTMLDivElement | null>;
  selectedId: string | null;
  registerNode: (id: string, node: HTMLElement | null) => void;
  onLanePointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onEventPointerDown: (e: React.PointerEvent<HTMLElement>, event: PlacedEvent) => void;
  /** real date per visible column (`view.days`); see `fallbackDays` */
  days?: Date[];
  /** Select an event / a freshly created chip; this is what opens the panel. */
  onSelect?: (id: string | null, opts?: { isNew?: boolean }) => void;
  /** roving tabindex shared with the grid — see `lib/roving.ts` */
  rovingId?: string | null;
  /** columns under ~64px: chips show a title only */
  cramped?: boolean;
}

/** A `listitem` that adds semantics and no box. */
const CONTENTS: React.CSSProperties = { display: "contents" };

export function AllDayLane({
  events,
  dayCount,
  dayNamesShort,
  laneRef,
  laneDraftRef,
  selectedId,
  registerNode,
  onLanePointerDown,
  onEventPointerDown,
  days,
  onSelect,
  rovingId,
  cramped = false,
}: AllDayLaneProps) {
  const C = useSlots();
  const rowH = useCoarsePointer() ? ROW_H_TOUCH : ROW_H;
  const onSelectRef = useLatest(onSelect);
  const onChipActivate = useCallback((ev: PlacedEvent) => onSelectRef.current?.(ev.id), []);
  const { allDay, rows, rowCount, hidden, visible } = useMemo(() => {
    const allDay = events.filter((e) => e.allDay);
    const rows = layoutRows(allDay);
    const usedRows = rows.size ? Math.max(...rows.values()) + 1 : 1;
    const rowCount = Math.max(1, Math.min(MAX_ROWS, usedRows));
    const hidden = allDay.filter((e) => (rows.get(e.id) ?? 0) >= MAX_ROWS);
    const visible = allDay.filter((e) => (rows.get(e.id) ?? 0) < MAX_ROWS);
    return { allDay, rows, rowCount, hidden, visible };
  }, [events]);

  const columns = days ?? fallbackDays(dayCount, -1);
  const { constraints } = useConstraints();
  const blockedCols = useMemo(
    () => disabledAllDayColumns({ days: columns }, constraints),
    [columns, constraints],
  );
  const menu = useCalendarContextMenu({
    hostRef: laneRef,
    events: allDay,
    dayCount,
    allDay: true,
  });

  return (
    <div className="flex shrink-0 border-b">
      {/* gutter width grows with `timeZones`, hence the custom property */}
      <div className={LANE_LABEL}>All day</div>
      <ContextMenu open={menu.open} onOpenChange={menu.onOpenChange}>
        <ContextMenuTrigger
          onContextMenuCapture={menu.onContextMenuCapture}
          render={
            <div
              ref={laneRef}
              data-cal-lane
              data-cramped={cramped || undefined}
              data-craft="allday-promote"
              onPointerDown={onLanePointerDown}
              className="relative min-w-0 flex-1 touch-none select-none"
              style={{
                height: rowCount * rowH + 6 + (hidden.length > 0 ? rowH - ROW_H + MORE_H : 0),
              }}
            />
          }
        >
          {Array.from({ length: dayCount }, (_, i) => (
            <div
              key={i}
              aria-hidden
              className="pointer-events-none absolute inset-y-0 border-s border-border/70"
              style={{ left: `${(i / dayCount) * 100}%` }}
            />
          ))}

          {blockedCols.map((col) => (
            <div
              key={col}
              aria-hidden
              className="cal-blocked inset-y-0"
              style={{ left: `${(col / dayCount) * 100}%`, width: `${100 / dayCount}%` }}
            />
          ))}

          {/* one list for the lane; `pointer-events-none` keeps drag-create working between chips */}
          <div
            role="list"
            aria-label={`All-day events, ${allDay.length === 1 ? "1 event" : `${allDay.length} events`}`}
            className="pointer-events-none absolute inset-0"
          >
            {visible.map((event) => (
              <div key={event.id} role="listitem" style={CONTENTS}>
                <C.AllDayChip
                  event={event}
                  dayCount={dayCount}
                  dayNamesShort={dayNamesShort}
                  row={rows.get(event.id) ?? 0}
                  rowHeight={rowH}
                  selected={event.id === selectedId}
                  tabIndex={rovingTab(rovingId, event.id)}
                  registerNode={registerNode}
                  onPointerDown={onEventPointerDown}
                  onActivate={onChipActivate}
                />
              </div>
            ))}
          </div>

          <EventOverflow
            count={hidden.length}
            events={hidden}
            label={`Show ${plural(hidden.length, "more all-day event")}`}
            heading="All day"
            onSelect={onChipActivate}
            align="end"
            className="absolute end-1 bottom-0.5"
          />

          <div ref={laneDraftRef} hidden data-cal-lane-draft className="absolute z-30">
            <span data-slot="draft-label" />
          </div>
        </ContextMenuTrigger>

        {menu.target?.kind === "event" ? (
          <EventContextMenu
            event={menu.target.event}
            selected={menu.target.event.id === selectedId}
            host={laneRef}
            days={columns}
            onSelect={onSelect}
            close={menu.close}
          />
        ) : menu.target ? (
          <GridContextMenu
            slot={menu.target}
            host={laneRef}
            days={columns}
            todayIndex={-1}
            onSelect={onSelect}
            close={menu.close}
          />
        ) : null}
      </ContextMenu>
    </div>
  );
}
