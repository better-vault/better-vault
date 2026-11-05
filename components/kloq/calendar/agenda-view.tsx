"use client";

/** agenda-view — chronological event list grouped by day (grouping in `lib/agenda`). */

import type React from "react";
import { memo, useCallback, useMemo, useRef, useState } from "react";
import { type AgendaEntry, groupAgenda } from "../lib/agenda";
import {
  formatRange,
  type KloqView,
  type PlacedEvent,
  type TimeFormatOptions,
  type ViewDescriptor,
} from "../lib/calendar-types";
import { formatDate } from "../lib/date-format";
import { EVENT_COLORS } from "../lib/event-palette";
import { eventTitle, fullDate, plural } from "../lib/event-text";
import { formatViewTitle } from "../lib/navigation";
import { rovingTab } from "../lib/roving";
import { cn } from "../lib/utils";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { ContextMenu, ContextMenuTrigger } from "../ui/context-menu";
import { FOCUS_RING_INSET } from "./cell-classes";
import { type CalendarMenuTarget, EventContextMenu, GridContextMenu } from "./event-context-menu";
import { useKloqSettings } from "./settings-context";

/** Where a "New event here" from an agenda row lands. */
const AGENDA_NEW_EVENT_MIN = 9 * 60;

interface AgendaViewProps {
  view: ViewDescriptor;
  events: PlacedEvent[];
  selectedId: string | null;
  registerNode: (id: string, node: HTMLElement | null) => void;
  onSelect: (id: string | null, opts?: { isNew?: boolean }) => void;
  onOpenDay: (date: Date) => void;
  viewSetting: KloqView;
  onSwitchView: (view: KloqView) => void;
  /** The one event carrying `tabIndex={0}` — see `lib/roving.ts`. */
  rovingId?: string | null;
}

export function AgendaView({
  view,
  events,
  selectedId,
  registerNode,
  onSelect,
  onOpenDay,
  viewSetting,
  onSwitchView,
  rovingId,
}: AgendaViewProps) {
  const g = useKloqSettings();
  const hostRef = useRef<HTMLDivElement>(null);
  const agenda = useMemo(() => groupAgenda(events, view), [events, view]);

  const [target, setTarget] = useState<CalendarMenuTarget | null>(null);
  const pending = useRef<CalendarMenuTarget | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const onContextMenuCapture = useCallback(
    (e: React.MouseEvent) => {
      pending.current = null;
      const el = e.target as HTMLElement | null;
      const row = el?.closest?.("[data-cal-event]") as HTMLElement | null;
      const id = row?.dataset.calEvent;
      if (id) {
        const event = events.find((ev) => ev.id === id);
        if (event) pending.current = { kind: "event", event };
        return;
      }
      const group = el?.closest?.("[data-agenda-day]") as HTMLElement | null;
      const col = Number(group?.dataset.agendaDay);
      if (!Number.isFinite(col)) return;
      pending.current = {
        kind: "slot",
        col,
        // clamped into the configured day range
        startMin: g.clampMinutes(AGENDA_NEW_EVENT_MIN),
        allDay: false,
      };
    },
    [events, g],
  );

  const onOpenChange = (next: boolean) => {
    if (next && !pending.current) return;
    if (next) setTarget(pending.current);
    setMenuOpen(next);
  };

  // one day heading is in the tab order; ↑/↓ move it
  const [leadDay, setLeadDay] = useState<number | null>(null);
  const headingDay =
    agenda.days.find((d) => d.dayIndex === leadDay)?.dayIndex ??
    agenda.days.find((d) => d.isToday)?.dayIndex ??
    agenda.days[0]?.dayIndex;
  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    const from = e.target as HTMLElement | null;
    if (from?.dataset?.agendaOpen === undefined) return;
    // `preventDefault()` also tells the document-level keyboard layer to yield
    e.preventDefault();
    const all = Array.from(e.currentTarget.querySelectorAll<HTMLElement>("[data-agenda-open]"));
    all[all.indexOf(from) + (e.key === "ArrowDown" ? 1 : -1)]?.focus();
  }, []);

  return (
    <ContextMenu open={menuOpen} onOpenChange={onOpenChange}>
      <ContextMenuTrigger
        onContextMenuCapture={onContextMenuCapture}
        render={
          <div
            ref={hostRef}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
            onKeyDown={onKeyDown}
          />
        }
      >
        {agenda.days.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-1 px-6 py-10 text-center">
            <p className="text-sm font-medium">Nothing scheduled</p>
            <p className="text-sm text-muted-foreground">
              {formatViewTitle(view, g.locale)} is clear.
            </p>
          </div>
        ) : (
          <div role="list" aria-label="Schedule" className="@container mx-auto w-full max-w-3xl">
            {agenda.days.map((day) => {
              const dateLabel = fullDate(day.date, g.locale);
              return (
                <section
                  key={day.dayIndex}
                  data-agenda-day={day.dayIndex}
                  role="listitem"
                  aria-label={`${dateLabel}, ${plural(day.entries.length, "event")}`}
                  className="border-b last:border-b-0"
                >
                  <h2 className="sticky top-0 z-10 flex items-center gap-2 border-b bg-background px-4 py-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      data-agenda-open={day.dayIndex}
                      tabIndex={day.dayIndex === headingDay ? 0 : -1}
                      onFocus={() => setLeadDay(day.dayIndex)}
                      onClick={() => onOpenDay(day.date)}
                      aria-label={`Open ${dateLabel}`}
                      className="-mx-2.5"
                    >
                      {formatDate(day.date, g.locale, HEADING_DATE)}
                    </Button>
                    {day.isToday ? <Badge size="sm">Today</Badge> : null}
                  </h2>

                  <ul className="flex flex-col py-1">
                    {day.entries.map((entry) => (
                      <li key={`${entry.event.id}:${day.dayIndex}`}>
                        <AgendaRow
                          entry={entry}
                          dateLabel={dateLabel}
                          selected={entry.event.id === selectedId}
                          // only the first day of a multi-day event registers its node
                          registerNode={entry.repeat ? undefined : registerNode}
                          // continuation rows share the id; one tab stop per event
                          tabIndex={entry.repeat ? -1 : rovingTab(rovingId, entry.event.id)}
                          onSelect={onSelect}
                        />
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}

            {agenda.emptyDays > 0 ? (
              <p className="px-4 py-3 text-center text-2xs text-muted-foreground">
                {agenda.emptyDays} empty {agenda.emptyDays === 1 ? "day" : "days"} hidden
              </p>
            ) : null}
          </div>
        )}
      </ContextMenuTrigger>

      {target?.kind === "event" ? (
        <EventContextMenu
          event={target.event}
          selected={target.event.id === selectedId}
          host={hostRef}
          days={view.days}
          onSelect={onSelect}
          close={() => setMenuOpen(false)}
        />
      ) : target ? (
        <GridContextMenu
          slot={target}
          host={hostRef}
          days={view.days}
          todayIndex={-1}
          viewSetting={viewSetting}
          onSwitchView={onSwitchView}
          onSelect={onSelect}
          close={() => setMenuOpen(false)}
        />
      ) : null}
    </ContextMenu>
  );
}

const HEADING_DATE: Intl.DateTimeFormatOptions = {
  weekday: "long",
  month: "long",
  day: "numeric",
};

interface AgendaRowProps {
  entry: AgendaEntry;
  dateLabel: string;
  selected: boolean;
  tabIndex?: number;
  registerNode?: (id: string, node: HTMLElement | null) => void;
  onSelect: (id: string | null, opts?: { isNew?: boolean }) => void;
}

/** The time column: a range for a timed event, "All day" otherwise. */
function agendaTimeLabel(entry: AgendaEntry, opts?: TimeFormatOptions): string {
  const { event, continuesBefore } = entry;
  if (continuesBefore) return "Continues";
  if (event.allDay) return "All day";
  return formatRange(event.startMin, event.endMin, opts);
}

const AgendaRow = memo(function AgendaRow({
  entry,
  dateLabel,
  selected,
  tabIndex,
  registerNode,
  onSelect,
}: AgendaRowProps) {
  const g = useKloqSettings();
  const { event } = entry;
  const c = EVENT_COLORS[event.color];
  const time = agendaTimeLabel(entry, g.timeFormat);

  return (
    <button
      type="button"
      data-cal-event={event.id}
      ref={registerNode ? (node) => registerNode(event.id, node) : undefined}
      onClick={() => onSelect(event.id)}
      aria-pressed={selected}
      tabIndex={tabIndex}
      aria-label={rowLabel(event, dateLabel, time, entry.continuesAfter)}
      className={cn(
        "flex w-full cursor-pointer items-center gap-3 px-4 py-1.5 text-start transition-[background-color,box-shadow] duration-150 hover:bg-accent",
        FOCUS_RING_INSET,
        selected && cn("bg-accent ring-2 ring-inset", c.ring),
      )}
    >
      <span className="w-36 shrink-0 whitespace-nowrap text-xs tabular-nums text-muted-foreground">
        {time}
      </span>{" "}
      <span aria-hidden className={cn("size-2 shrink-0 rounded-full", c.bar)} />
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{eventTitle(event)}</span>{" "}
      {event.location ? (
        <span className="hidden shrink-0 truncate text-xs text-muted-foreground @xl:block">
          {event.location}
        </span>
      ) : null}
    </button>
  );
});

function rowLabel(
  event: PlacedEvent,
  dateLabel: string,
  time: string,
  continuesAfter: boolean,
): string {
  const title = eventTitle(event);
  const tail = continuesAfter ? ", continues" : "";
  const where = event.location ? `, ${event.location}` : "";
  // time then title then location, the order the row renders them: the visible
  // text has to be part of the accessible name (label-content-name-mismatch)
  return `${time}, ${title}${where}, ${dateLabel}${tail}`;
}
