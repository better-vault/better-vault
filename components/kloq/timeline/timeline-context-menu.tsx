"use client";

/**
 * timeline-context-menu — the right-click layer for the resource timeline.
 * Event items are the calendar's own (`EventMenuItems`); only duplicate and the
 * slot menu are lane-shaped. Paste is left out: its target is day-column math
 * that would not reassign the lane under the pointer.
 */

import { CalendarPlus } from "@/components/kloq/lib/icons";
import type React from "react";
import { useMemo, useRef, useState } from "react";
import { EventMenuItems, Hint, POPUP_MOTION, popIn } from "../calendar/context-menu-shared";
import { DEFAULT_QUICK_ADD_MIN } from "../calendar/kloq-command";
import { useKloqSettings } from "../calendar/settings-context";
import { useKloqStore } from "../calendar/store-context";
import { formatInstant } from "../lib/calendar-types";
import type { PlacedOccurrence } from "../lib/projection";
import {
  createHorizontalAxis,
  defaultBookingSpan,
  instantAtMinute,
  minutesFromStart,
  type TimelineWindow,
} from "../lib/timeline-window";
import { ContextMenuItem, ContextMenuPopup } from "../ui/context-menu";
import type { TimelineCreateInput } from "./use-timeline-drag";

export type TimelineMenuTarget =
  | { kind: "event"; event: PlacedOccurrence }
  | { kind: "slot"; laneId: string; startMin: number };

interface TimelineContextMenuOptions {
  hostRef: React.RefObject<HTMLElement | null>;
  events: PlacedOccurrence[];
  window: TimelineWindow;
  /** the drag engine's horizontal origin; falls back to the clicked row */
  trackRef?: React.RefObject<HTMLElement | null>;
}

interface TimelineContextMenuState {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  close: () => void;
  target: TimelineMenuTarget | null;
  onContextMenuCapture: (e: React.MouseEvent) => void;
}

/**
 * Resolves the right-click target in the capture phase, before the trigger
 * opens the menu. A click outside any row (the gutter) has no target, and the
 * menu refuses to open.
 */
export function useTimelineContextMenu({
  hostRef,
  events,
  window,
  trackRef,
}: TimelineContextMenuOptions): TimelineContextMenuState {
  const pending = useRef<TimelineMenuTarget | null>(null);
  const [target, setTarget] = useState<TimelineMenuTarget | null>(null);
  const [open, setOpen] = useState(false);
  const axis = useMemo(() => createHorizontalAxis(window), [window]);

  const onContextMenuCapture = (e: React.MouseEvent) => {
    pending.current = null;
    if (!hostRef.current) return;

    const node = (e.target as HTMLElement | null)?.closest?.(
      "[data-cal-event]",
    ) as HTMLElement | null;
    const id = node?.dataset.calEvent;
    if (id) {
      const event = events.find((ev) => ev.id === id);
      if (event) pending.current = { kind: "event", event };
      return;
    }

    const row = (e.target as HTMLElement | null)?.closest?.(
      '[data-slot="timeline-row"]',
    ) as HTMLElement | null;
    const laneId = row?.dataset.lane;
    if (!row || !laneId) return;

    const rect = trackRef?.current?.getBoundingClientRect() ?? row.getBoundingClientRect();
    const startMin = axis.clamp(axis.pxToMinutes(e.clientX - rect.left));
    pending.current = { kind: "slot", laneId, startMin };
  };

  const onOpenChange = (next: boolean) => {
    if (next && !pending.current) return;
    if (next) setTarget(pending.current);
    setOpen(next);
  };

  const close = () => setOpen(false);

  return { open, onOpenChange, close, target, onContextMenuCapture };
}

interface TimelineMenuHostProps {
  host: React.RefObject<HTMLElement | null>;
  onSelect?: (id: string | null, opts?: { isNew?: boolean }) => void;
  close: () => void;
}

interface TimelineEventContextMenuProps extends TimelineMenuHostProps {
  event: PlacedOccurrence;
  selected: boolean;
  /** bounds the duplicate inside the window */
  window: TimelineWindow;
}

export function TimelineEventContextMenu({
  event,
  selected,
  window,
  host,
  onSelect,
  close,
}: TimelineEventContextMenuProps) {
  const store = useKloqStore();
  const g = useKloqSettings();

  // the copy lands right after the original on the same lane, or on top when the window has no room past it
  const duplicate = () => {
    const id = g.makeId();
    const src = event.source;
    const detach = src.rrule
      ? { rrule: undefined, exdates: undefined, recurrenceId: undefined }
      : {};
    if (src.allDay) {
      store.add({ ...src, id, ...detach });
    } else {
      const durationMin = event.endMin - event.startMin;
      const totalMin = minutesFromStart(window, window.end);
      const startMin = event.endMin + durationMin <= totalMin ? event.endMin : event.startMin;
      store.add({
        ...src,
        id,
        start: formatInstant(instantAtMinute(window, startMin)),
        end: formatInstant(instantAtMinute(window, startMin + durationMin)),
        ...detach,
      });
    }
    popIn(host.current, id);
    onSelect?.(id);
    close();
  };

  return (
    <ContextMenuPopup className={POPUP_MOTION}>
      <EventMenuItems
        event={event}
        selected={selected}
        host={host}
        onSelect={onSelect}
        close={close}
        onDuplicate={duplicate}
      />
    </ContextMenuPopup>
  );
}

interface TimelineSlotContextMenuProps extends TimelineMenuHostProps {
  slot: Extract<TimelineMenuTarget, { kind: "slot" }>;
  window: TimelineWindow;
  commitCreate: (input: TimelineCreateInput) => string;
}

export function TimelineSlotContextMenu({
  slot,
  window,
  commitCreate,
  host,
  onSelect,
  close,
}: TimelineSlotContextMenuProps) {
  const create = () => {
    const { startMin, endMin } = defaultBookingSpan(window, slot.startMin, DEFAULT_QUICK_ADD_MIN);
    const start = instantAtMinute(window, startMin);
    const end = instantAtMinute(window, endMin);
    const id = commitCreate({ laneId: slot.laneId, startMin, endMin, start, end });
    popIn(host.current, id);
    onSelect?.(id, { isNew: true });
    close();
  };

  return (
    <ContextMenuPopup className={POPUP_MOTION}>
      <ContextMenuItem onClick={create}>
        <CalendarPlus />
        New booking here
        <Hint keys={["dbl-click"]} />
      </ContextMenuItem>
    </ContextMenuPopup>
  );
}
