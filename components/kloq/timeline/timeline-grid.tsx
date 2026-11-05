"use client";

/** timeline-grid — the canvas: one labeled group per lane, a sticky resource gutter beside each track. */

import type React from "react";
import { useMemo } from "react";
import { useSlots } from "../calendar/slots";
import type { WorkingHours } from "../calendar/time-shade";
import { useKloqSelection } from "../calendar/use-selection";
import type { PlacedEvent } from "../lib/calendar-types";
import { bucketByLane, type Lane } from "../lib/lane";
import type { PlacedOccurrence } from "../lib/projection";
import { createHorizontalAxis, majorRules, type TimelineWindow } from "../lib/timeline-window";
import { ContextMenu, ContextMenuTrigger } from "../ui/context-menu";
import {
  TimelineEventContextMenu,
  TimelineSlotContextMenu,
  useTimelineContextMenu,
} from "./timeline-context-menu";
import { TimelineNow } from "./timeline-now";
import { DEFAULT_WORKING_HOURS, offHoursBands } from "./timeline-shade";
import type { TimelineCreateInput } from "./use-timeline-drag";

/** the gutter's default width; `gutterWidth` overrides it on narrow hosts */
export const GUTTER_WIDTH = 160;

const NO_EVENTS: PlacedOccurrence[] = [];

export interface TimelineGridProps {
  lanes: readonly Lane[];
  /** first lane to render, inclusive */
  from: number;
  /** last lane to render, exclusive */
  to: number;
  events: PlacedOccurrence[];
  window: TimelineWindow;
  rowHeight: number;
  barHeight: number;
  canvasRef: React.RefObject<HTMLDivElement | null>;
  /**
   * the drag engine's horizontal origin — see `TimelineDragOpts.trackRef`'s
   * doc (`use-timeline-drag.ts`). Optional: a host measuring geometry itself
   * (or a test rendering the grid in isolation) doesn't need it. Forwarded to
   * the first rendered row, whose left edge is the same as every other row's.
   */
  trackRef?: React.RefObject<HTMLDivElement | null>;
  registerNode: (id: string, node: HTMLElement | null) => void;
  onCanvasPointerDown?: (e: React.PointerEvent<HTMLDivElement>) => void;
  onCanvasDoubleClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onEventPointerDown?: (e: React.PointerEvent<HTMLElement>, event: PlacedEvent) => void;
  onEventActivate?: (event: PlacedEvent) => void;
  selectedId: string | null;
  /** false = no working-hours tint, mirroring `WeekGrid`'s `workingHours` prop */
  workingHours?: WorkingHours | false;
  /** the one event carrying `tabIndex={0}` — see `lib/roving.ts` */
  rovingId?: string | null;
  /** Select an event, or a freshly created bar (`isNew` marks a draft) — what the context menu's Edit/New booking items call. */
  onSelect?: (id: string | null, opts?: { isNew?: boolean }) => void;
  /** the SAME create the drag engine and double-click use — the "New booking here" menu item calls it too. */
  commitCreate?: (input: TimelineCreateInput) => string;
  /** px width of the sticky gutter; defaults to `GUTTER_WIDTH` */
  gutterWidth?: number;
  /** the gutter is squeezed: names wrap, sublabels move to the tooltip */
  gutterNarrow?: boolean;
}

export function TimelineGrid({
  lanes,
  from,
  to,
  events,
  window,
  rowHeight,
  barHeight,
  canvasRef,
  trackRef,
  registerNode,
  onCanvasPointerDown,
  onCanvasDoubleClick,
  onEventPointerDown,
  onEventActivate,
  selectedId,
  workingHours = DEFAULT_WORKING_HOURS,
  rovingId,
  onSelect,
  commitCreate,
  gutterWidth = GUTTER_WIDTH,
  gutterNarrow = false,
}: TimelineGridProps) {
  const C = useSlots();
  const selection = useKloqSelection();
  const selectedIds = useMemo(
    () => (selection ? new Set(selection.ids) : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selection?.ids],
  );
  const axis = useMemo(() => createHorizontalAxis(window), [window]);
  const majors = useMemo(() => majorRules(window), [window]);
  // every off-hours stretch in one mask over one tinted layer
  const offHours = useMemo(() => {
    if (!workingHours) return null;
    const stops = offHoursBands(window, workingHours).map((b) => {
      const from = `${axis.toPx(b.startMin)}px`;
      const to = `${axis.toPx(b.endMin)}px`;
      return `transparent ${from}, #000 ${from}, #000 ${to}, transparent ${to}`;
    });
    return stops.length ? `linear-gradient(to right, ${stops.join(", ")})` : null;
  }, [window, workingHours, axis]);
  const buckets = useMemo(() => bucketByLane(events, lanes.length), [events, lanes.length]);
  const slice = lanes.slice(from, to);

  const menu = useTimelineContextMenu({ hostRef: canvasRef, events, window, trackRef });

  return (
    <ContextMenu open={menu.open} onOpenChange={menu.onOpenChange}>
      <ContextMenuTrigger
        onContextMenuCapture={menu.onContextMenuCapture}
        render={
          <div
            ref={canvasRef}
            role="group"
            aria-label="Timeline"
            className="relative flex flex-col"
            onPointerDown={onCanvasPointerDown}
            onDoubleClick={onCanvasDoubleClick}
            data-slot="timeline-canvas"
            data-window-start={window.start.getTime()}
            data-slot-minutes={window.slotMinutes}
            data-slot-px={window.pxPerSlot}
          />
        }
      >
        <div
          aria-hidden
          className="tl-slot-lines pointer-events-none absolute inset-y-0"
          data-dated={window.slotMinutes >= 1440 || undefined}
          style={
            {
              left: gutterWidth,
              width: axis.extentPx,
              "--kloq-slot-width": `${window.pxPerSlot}px`,
            } as React.CSSProperties
          }
        >
          {majors.map((min) => (
            <div
              key={min}
              className="absolute inset-y-0 border-s border-border"
              style={{ left: axis.toPx(min) }}
            />
          ))}
        </div>

        {offHours ? (
          <div
            aria-hidden
            className="cal-offhours inset-y-0"
            data-slot="timeline-offhours"
            style={{
              left: gutterWidth,
              width: axis.extentPx,
              maskImage: offHours,
              WebkitMaskImage: offHours,
            }}
          />
        ) : null}

        {slice.map((lane, i) => (
          <div
            key={lane.id}
            role="group"
            aria-label={lane.label}
            className="flex"
            data-slot="timeline-lane"
          >
            <C.ResourceGutter
              lane={lane}
              height={lane.height ?? rowHeight}
              width={gutterWidth}
              narrow={gutterNarrow}
            />
            <C.TimelineRow
              lane={lane}
              events={buckets[from + i] ?? NO_EVENTS}
              axis={axis}
              window={window}
              rowHeight={rowHeight}
              barHeight={barHeight}
              selectedId={selectedId}
              selectedIds={selectedIds}
              registerNode={registerNode}
              onEventPointerDown={onEventPointerDown}
              onEventActivate={onEventActivate}
              rovingId={rovingId}
              trackRef={i === 0 ? trackRef : undefined}
            />
            <div aria-hidden className="min-w-0 flex-1 border-b border-border" />
          </div>
        ))}

        <TimelineNow window={window} axis={axis} gutterWidth={gutterWidth} />
      </ContextMenuTrigger>

      {menu.target?.kind === "event" ? (
        <TimelineEventContextMenu
          event={menu.target.event}
          selected={menu.target.event.id === selectedId}
          window={window}
          host={canvasRef}
          onSelect={onSelect}
          close={menu.close}
        />
      ) : menu.target?.kind === "slot" && commitCreate ? (
        <TimelineSlotContextMenu
          slot={menu.target}
          window={window}
          commitCreate={commitCreate}
          host={canvasRef}
          onSelect={onSelect}
          close={menu.close}
        />
      ) : null}
    </ContextMenu>
  );
}
