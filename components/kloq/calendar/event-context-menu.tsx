"use client";

/**
 * event-context-menu — the right-click layer: one host hook that resolves the
 * target under the pointer, plus an event menu and an empty-surface menu.
 */

import { CalendarPlus, ClipboardPaste, LocateFixed } from "@/components/kloq/lib/icons";
import type React from "react";
import { useRef, useState } from "react";
import { newEventCalendarId } from "../lib/calendar-sources";
import {
  dateOnlyAfter,
  dateOnlyAt,
  instantAt,
  instantPlus,
  type KloqView,
  type PlacedEvent,
  snapMinutes,
  wallMinutesBetween,
} from "../lib/calendar-types";
import { clamp } from "../lib/date-math";
import type { PlacedOccurrence } from "../lib/projection";
import { prefersReducedMotion } from "../lib/springs";
import {
  ContextMenuGroupLabel,
  ContextMenuItem,
  ContextMenuPopup,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
} from "../ui/context-menu";
import { EventMenuItems, Hint, POPUP_MOTION, popIn, VIEW_META } from "./context-menu-shared";
import { useKloqSettings } from "./settings-context";
import { useKloqStore } from "./store-context";
import { useKloqSelection } from "./use-selection";

/** Menu-created events match the double-click quick-create length. */
const NEW_EVENT_MIN = 30;

export type CalendarMenuTarget =
  | { kind: "event"; event: PlacedEvent }
  | { kind: "slot"; col: number; startMin: number; allDay: boolean };

/**
 * Fallback column dates for a host that doesn't pass `days`: anchored on
 * today's column, else the Monday-start week containing today.
 */
export function fallbackDays(dayCount: number, todayIndex: number): Date[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const offset = todayIndex >= 0 ? todayIndex : (today.getDay() + 6) % 7;
  return Array.from({ length: dayCount }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i - offset);
    return d;
  });
}

interface CalendarContextMenuOptions {
  hostRef: React.RefObject<HTMLElement | null>;
  events: PlacedEvent[];
  dayCount: number;
  /** Lane hosts have no time axis: every slot is all-day. */
  allDay?: boolean;
}

interface CalendarContextMenuState {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  close: () => void;
  target: CalendarMenuTarget | null;
  /** Spread on the trigger element. */
  onContextMenuCapture: (e: React.MouseEvent) => void;
}

/**
 * Resolve the right-click target in the capture phase, before Base UI's
 * bubble-phase trigger opens the menu. A ref carries it across that gap.
 */
export function useCalendarContextMenu({
  hostRef,
  events,
  dayCount,
  allDay = false,
}: CalendarContextMenuOptions): CalendarContextMenuState {
  const g = useKloqSettings();
  const pending = useRef<CalendarMenuTarget | null>(null);
  const [target, setTarget] = useState<CalendarMenuTarget | null>(null);
  const [open, setOpen] = useState(false);

  const onContextMenuCapture = (e: React.MouseEvent) => {
    pending.current = null;
    const host = hostRef.current;
    if (!host) return;

    const node = (e.target as HTMLElement | null)?.closest?.(
      "[data-cal-event]",
    ) as HTMLElement | null;
    const id = node?.dataset.calEvent;
    if (id) {
      const event = events.find((ev) => ev.id === id);
      if (event) pending.current = { kind: "event", event };
      return;
    }

    const rect = host.getBoundingClientRect();
    const col = clamp(
      Math.floor(((e.clientX - rect.left) / rect.width) * dayCount),
      0,
      dayCount - 1,
    );
    if (allDay) {
      pending.current = { kind: "slot", col, startMin: 0, allDay: true };
      return;
    }
    const startMin = clamp(
      snapMinutes(g.pxToMinutes(e.clientY - rect.top), g.snapMinutes),
      g.dayStartMin,
      g.dayEndMin - NEW_EVENT_MIN,
    );
    pending.current = { kind: "slot", col, startMin, allDay: false };
  };

  const onOpenChange = (next: boolean) => {
    if (next && !pending.current) return;
    if (next) setTarget(pending.current);
    setOpen(next);
  };

  const close = () => setOpen(false);

  return { open, onOpenChange, close, target, onContextMenuCapture };
}

function springScrollTo(scroller: HTMLElement, target: number) {
  const to = clamp(target, 0, scroller.scrollHeight - scroller.clientHeight);
  if (prefersReducedMotion()) {
    scroller.scrollTop = to;
    return;
  }
  let x = scroller.scrollTop;
  let v = 0;
  const stiffness = 170;
  const damping = 26;
  let last = performance.now();
  const step = (t: number) => {
    const dt = Math.min(0.032, (t - last) / 1000);
    last = t;
    v += (stiffness * (to - x) - damping * v) * dt;
    x += v * dt;
    if (Math.abs(to - x) < 0.5 && Math.abs(v) < 0.5) {
      scroller.scrollTop = to;
      return;
    }
    scroller.scrollTop = x;
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function scrollParent(el: HTMLElement | null): HTMLElement | null {
  for (let p = el?.parentElement; p; p = p.parentElement) {
    if (/(auto|scroll)/.test(getComputedStyle(p).overflowY) && p.scrollHeight > p.clientHeight)
      return p;
  }
  return null;
}

interface CalendarMenuHostProps {
  host: React.RefObject<HTMLElement | null>;
  /** Real date per visible column (`view.days`); see `fallbackDays`. */
  days: Date[];
  /** Select an event (opens the panel); `isNew` marks a draft Escape discards. */
  onSelect?: (id: string | null, opts?: { isNew?: boolean }) => void;
  close: () => void;
}

interface EventContextMenuProps extends CalendarMenuHostProps {
  event: PlacedEvent;
  /** Whether this is the selected event (the 1–5 colour hints only apply then). */
  selected: boolean;
}

export function EventContextMenu({
  event,
  selected,
  host,
  days,
  onSelect,
  close,
}: EventContextMenuProps) {
  const store = useKloqStore();
  const g = useKloqSettings();

  const duplicate = () => {
    const id = g.makeId();
    const src = event.source;
    // duplicating one occurrence copies that occurrence, not the series
    const detach = src.rrule
      ? { rrule: undefined, exdates: undefined, recurrenceId: undefined }
      : {};
    if (src.allDay) {
      store.add({ ...src, id, ...detach });
    } else if (event.segment.n > 1) {
      // a cross-midnight block is one day's slice; copy the occurrence's own instants
      const own = event as Partial<PlacedOccurrence>;
      store.add({
        ...src,
        id,
        start: own.start ?? src.start,
        end: own.end ?? src.end,
        ...detach,
      });
    } else {
      // wall-clock duration, never elapsed ms
      const duration = wallMinutesBetween(src.start, src.end);
      // directly under the original, or on top if the day has no room below
      const startMin = event.endMin + duration <= g.dayEndMin ? event.endMin : event.startMin;
      const start = instantAt({ days }, event.dayIndex, startMin);
      store.add({
        ...src,
        id,
        start,
        end: instantPlus(start, duration),
        ...detach,
      });
    }
    popIn(host.current, id);
    onSelect?.(id);
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
        duplicateHint={["⌥", "drag"]}
      />
    </ContextMenuPopup>
  );
}

interface GridContextMenuProps extends CalendarMenuHostProps {
  slot: Extract<CalendarMenuTarget, { kind: "slot" }>;
  /** Column showing today, or -1. */
  todayIndex: number;
  viewSetting?: KloqView;
  onSwitchView?: (view: KloqView) => void;
}

export function GridContextMenu({
  slot,
  host,
  days,
  todayIndex,
  viewSetting,
  onSwitchView,
  onSelect,
  close,
}: GridContextMenuProps) {
  const store = useKloqStore();
  const g = useKloqSettings();
  const selection = useKloqSelection();

  // Write the right-clicked slot into the hover ref so paste's hovered-slot rule applies.
  const paste = () => {
    if (!selection) return;
    selection.hover.current = slot.allDay ? null : { col: slot.col, startMin: slot.startMin };
    selection.paste();
    close();
  };

  const create = () => {
    const id = g.makeId();
    const calendarId = newEventCalendarId();
    const on = calendarId ? { calendarId } : undefined;
    store.add(
      slot.allDay
        ? {
            id,
            title: "",
            ...on,
            allDay: true,
            start: dateOnlyAt({ days }, slot.col),
            // one day, exclusive end
            end: dateOnlyAfter({ days }, slot.col),
          }
        : {
            id,
            title: "",
            ...on,
            start: instantAt({ days }, slot.col, slot.startMin),
            end: instantAt({ days }, slot.col, slot.startMin + NEW_EVENT_MIN),
          },
    );
    popIn(host.current, id);
    onSelect?.(id, { isNew: true });
  };

  const jumpToNow = () => {
    const scroller = scrollParent(host.current);
    if (!scroller) return;
    const now = new Date();
    const nowPx = g.minutesToPx(now.getHours() * 60 + now.getMinutes());
    springScrollTo(scroller, nowPx - scroller.clientHeight / 2);
  };

  return (
    <ContextMenuPopup className={POPUP_MOTION}>
      <ContextMenuItem onClick={create}>
        <CalendarPlus />
        {slot.allDay ? "New all-day event here" : "New event here"}
        {slot.allDay ? null : <Hint keys={["dbl-click"]} />}
      </ContextMenuItem>

      <ContextMenuItem onClick={paste} disabled={!selection}>
        <ClipboardPaste />
        Paste
        <Hint keys={["⌘", "V"]} />
      </ContextMenuItem>

      {slot.allDay ? null : (
        <>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={jumpToNow} disabled={todayIndex < 0}>
            <LocateFixed />
            Jump to now
          </ContextMenuItem>
        </>
      )}

      {onSwitchView ? (
        <>
          <ContextMenuSeparator />
          {/* Label must live inside the radio group: base-ui's GroupLabel throws outside one. */}
          <ContextMenuRadioGroup
            value={String(viewSetting)}
            onValueChange={(value) => {
              const next = VIEW_META.find((o) => String(o.key) === value);
              if (next) onSwitchView(next.key);
              close();
            }}
          >
            <ContextMenuGroupLabel>View</ContextMenuGroupLabel>
            {VIEW_META.map((opt) => (
              <ContextMenuRadioItem key={String(opt.key)} value={String(opt.key)}>
                <span className="flex items-center gap-2">
                  <opt.icon className="size-4 opacity-80" />
                  {opt.label}
                </span>
              </ContextMenuRadioItem>
            ))}
          </ContextMenuRadioGroup>
        </>
      ) : null}
    </ContextMenuPopup>
  );
}
