"use client";

/** timeline-row — one lane's strip of canvas, with its bars stacked into sub-rows. */

import type React from "react";
import { memo, useMemo } from "react";
import { samePlacement } from "../calendar/event-block";
import { EventOverflow } from "../calendar/event-overflow";
import { useKloqSettings } from "../calendar/settings-context";
import { useSlots } from "../calendar/slots";
import type { KloqAxis } from "../lib/axis";
import type { PlacedEvent } from "../lib/calendar-types";
import { plural } from "../lib/event-text";
import type { Lane } from "../lib/lane";
import type { PlacedOccurrence } from "../lib/projection";
import { rovingTab } from "../lib/roving";
import { layoutLane, maxSubRows } from "../lib/timeline-layout";
import type { TimelineWindow } from "../lib/timeline-window";
import { ALL_DAY_LABEL, formatBarRange } from "./timeline-block";

export interface TimelineRowProps {
  lane: Lane;
  events: PlacedOccurrence[];
  axis: KloqAxis;
  /** the window `events`' `startMin`/`endMin` are measured from */
  window: TimelineWindow;
  rowHeight: number;
  barHeight: number;
  selectedId: string | null;
  /** every selected bar, when several can be; omit and `selectedId` alone decides */
  selectedIds?: ReadonlySet<string>;
  registerNode: (id: string, node: HTMLElement | null) => void;
  onEventPointerDown?: (e: React.PointerEvent<HTMLElement>, event: PlacedEvent) => void;
  onEventActivate?: (event: PlacedEvent) => void;
  /** the one event carrying `tabIndex={0}` — see `lib/roving.ts` */
  rovingId?: string | null;
  /** the drag engine's horizontal origin; passed only on the first rendered row */
  trackRef?: React.RefObject<HTMLDivElement | null>;
}

/** Runs of overlapping bars that contain at least one hidden one. */
function hiddenClusters(
  events: readonly PlacedOccurrence[],
  isHidden: (id: string) => boolean,
): { endMin: number; hidden: PlacedOccurrence[] }[] {
  const sorted = [...events].sort((a, b) => a.startMin - b.startMin);
  const out: { endMin: number; hidden: PlacedOccurrence[] }[] = [];
  let cur: { endMin: number; hidden: PlacedOccurrence[] } | null = null;
  for (const e of sorted) {
    if (!cur || e.startMin >= cur.endMin) {
      if (cur?.hidden.length) out.push(cur);
      cur = { endMin: e.endMin, hidden: [] };
    } else cur.endMin = Math.max(cur.endMin, e.endMin);
    if (isHidden(e.id)) cur.hidden.push(e);
  }
  if (cur?.hidden.length) out.push(cur);
  return out;
}

const CHIP_WIDTH = 64;

const isSelected = (p: TimelineRowProps, id: string) =>
  p.selectedIds ? p.selectedIds.has(id) : id === p.selectedId;

/** A store write hands every row a fresh bucket; only the row whose bars changed renders. */
function sameRow(a: TimelineRowProps, b: TimelineRowProps): boolean {
  if (
    a.lane !== b.lane ||
    a.axis !== b.axis ||
    a.window !== b.window ||
    a.rowHeight !== b.rowHeight ||
    a.barHeight !== b.barHeight ||
    a.registerNode !== b.registerNode ||
    a.onEventPointerDown !== b.onEventPointerDown ||
    a.onEventActivate !== b.onEventActivate ||
    a.trackRef !== b.trackRef ||
    a.events.length !== b.events.length
  )
    return false;
  const multi = (p: TimelineRowProps) => (p.selectedIds?.size ?? 0) > 1;
  if (multi(a) !== multi(b)) return false;
  return a.events.every((e, i) => {
    const o = b.events[i];
    return (
      samePlacement(e, o) &&
      isSelected(a, e.id) === isSelected(b, o.id) &&
      rovingTab(a.rovingId, e.id) === rovingTab(b.rovingId, o.id)
    );
  });
}

export const TimelineRow = memo(function TimelineRow({
  lane,
  events,
  axis,
  window,
  rowHeight,
  barHeight,
  selectedId,
  selectedIds,
  registerNode,
  onEventPointerDown,
  onEventActivate,
  rovingId,
  trackRef,
}: TimelineRowProps) {
  const C = useSlots();
  const g = useKloqSettings();
  const height = lane.height ?? rowHeight;
  const cap = maxSubRows(lane, rowHeight, barHeight);
  const layout = useMemo(() => layoutLane(events, cap), [events, cap]);
  const clusters = useMemo(
    () => hiddenClusters(events, (id) => layout.get(id)?.hidden === true),
    [events, layout],
  );
  const many = (selectedIds?.size ?? 0) > 1;

  return (
    <div
      ref={trackRef}
      className="relative shrink-0 border-b border-border"
      style={{ width: axis.extentPx, height }}
      data-slot="timeline-row"
      data-lane={lane.id}
    >
      {events.map((event) => {
        const slot = layout.get(event.id);
        if (!slot || slot.hidden) return null;
        const inSelection = selectedIds ? selectedIds.has(event.id) : event.id === selectedId;
        return (
          <C.TimelineBlock
            key={event.id}
            event={event}
            window={window}
            left={axis.toPx(event.startMin)}
            width={Math.max(2, axis.durationToPx(event.endMin - event.startMin))}
            top={slot.row * barHeight}
            height={barHeight - 2}
            selected={inSelection}
            multi={many && inSelection}
            tabIndex={rovingTab(rovingId, event.id)}
            registerNode={registerNode}
            onPointerDown={onEventPointerDown}
            onActivate={onEventActivate}
          />
        );
      })}
      {clusters.map((cluster) => {
        const n = cluster.hidden.length;
        return (
          <EventOverflow
            key={cluster.hidden[0].id}
            count={n}
            events={cluster.hidden}
            label={`Show ${plural(n, "more booking")} on ${lane.label}`}
            heading={plural(n, "more booking")}
            onSelect={onEventActivate}
            rowMeta={(e) =>
              e.allDay ? ALL_DAY_LABEL : formatBarRange(window, g, e.startMin, e.endMin)
            }
            side="top"
            align="start"
            className="absolute bottom-1 bg-background after:absolute after:inset-x-0 after:-inset-y-0.75"
            style={{
              left: Math.max(
                2,
                Math.min(axis.extentPx - CHIP_WIDTH, axis.toPx(cluster.endMin) + 4),
              ),
            }}
          />
        );
      })}
    </div>
  );
}, sameRow);
