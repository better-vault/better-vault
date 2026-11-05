"use client";

/**
 * event-panel — the event editor, anchored beside the selected block.
 * Position is hand-managed (fixed + translate) so it can follow a drag per frame.
 */

import {
  AlignLeft,
  Bell,
  CalendarArrowDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  Lock,
  MapPin,
  Repeat,
  Trash2,
  TriangleAlert,
  UserPlus,
  Users,
  Video,
} from "@/components/kloq/lib/icons";
import { useId, useMemo, useRef } from "react";
import { announceCalendar, announceColor, announceDeleted } from "../lib/announce";
import {
  addAttendees,
  attendeeStatus,
  cycleStatus,
  findAttendee,
  isJoinableUrl,
  isOrganizer,
  RSVP_CHOICES,
  removeAttendee,
  STATUS_LABEL,
  setAttendeeStatus,
  shortUrl,
  summaryLabel,
  toggleAttendeeOptional,
} from "../lib/attendees";
import { useCalendarSources } from "../lib/calendar-sources";
import {
  type EventColor,
  isBusy,
  minutesOfDate,
  parseInstant,
  wallMinutesBetween,
} from "../lib/calendar-types";
import { describeConflicts } from "../lib/conflicts";
import { EVENT_COLORS } from "../lib/event-palette";
import { eventTitle, formatDuration } from "../lib/event-text";
import type { AttendeeStatus } from "../lib/event-types";
import { downloadICS } from "../lib/ics";
import type { PlacedOccurrence } from "../lib/projection";
import {
  applyPlan,
  deleteOccurrence,
  editOccurrence,
  exdatesOf,
  nextOccurrence,
  type Occurrence,
  occurrenceKey,
  previousOccurrence,
} from "../lib/recurrence";
import { cn } from "../lib/utils";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Input } from "../ui/input";
import { InputGroup, InputGroupAddon } from "../ui/input-group";
import { RadioGroupPrimitive, RadioPrimitive } from "../ui/radio-group";
import { SegmentedControl, SegmentedControlItem } from "../ui/segmented-control";
import { Separator } from "../ui/separator";
import { Textarea } from "../ui/textarea";
import { Toggle } from "../ui/toggle";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { AttendeeChip } from "./attendee-chip";
import { CalendarField } from "./calendar-field";
import { COLOR_KEYS, SwatchDot } from "./context-menu-shared";
import { KbdKeys } from "./kbd-keys";
import { useAnnounce } from "./live-region";
import { GHOST_FIELD, PropertyRow, ReadOnlyRow, ROW_H, RowValue, revealRow } from "./panel-rows";
import type { RecurrenceScopeAction } from "./recurrence-scope-dialog";
import { ReminderField } from "./reminder-field";
import { RRuleBuilder } from "./rrule-builder";
import { useKloqSettings } from "./settings-context";
import { useKloqStore } from "./store-context";
import { PANEL_WIDTH, useAnchoredPanel } from "./use-anchored-panel";
import { useConflicts } from "./use-conflicts";
import { type Field, useDisclosure } from "./use-disclosure";
import { useFollowDrag } from "./use-follow-drag";
import { usePanelKeys } from "./use-panel-keys";
import { useRecurrenceScope } from "./use-recurrence-scope";
import { useTimeEdit } from "./use-time-edit";

const ADDABLE: readonly [Field, typeof MapPin, string][] = [
  ["rrule", Repeat, "Add recurrence"],
  ["reminders", Bell, "Add reminder"],
  ["location", MapPin, "Add location"],
  ["meetingUrl", Video, "Add video call"],
  ["attendees", UserPlus, "Add guests"],
];

const SHORT_LABEL: Record<Field, string> = {
  rrule: "Repeat",
  reminders: "Remind",
  location: "Place",
  meetingUrl: "Meet",
  attendees: "Guests",
};

export interface EventPanelProps {
  /** The selected placement; `event.id` is the placement key, `event.source.id` the store id. */
  event: PlacedOccurrence;
  /** per-column labels from the view descriptor */
  dayNamesLong: string[];
  dayNamesShort: string[];
  /** true right after drag-create; focuses the title */
  isNew: boolean;
  /** The viewer's address; enables the RSVP control and attendee-aware conflicts. */
  currentUserEmail?: string;
  getAnchor: (id: string) => HTMLElement | null;
  onClose: () => void;
  /** Escape handler; the host discards an `isNew` event. Falls back to `onClose`. */
  onCancel?: () => void;
  /** Promote to / demote from the all-day lane. Omit and the control doesn't render. */
  onToggleAllDay?: (allDay: boolean) => void;
  /** Select another placement (`id` is a placement id). Omit and the stepper doesn't render. */
  onSelectOccurrence?: (id: string, date: Date) => void;
  /** Commit a time range in minutes from the event's own start day; `endMin` > 1440 is next day. */
  onEditTime?: (startMin: number, endMin: number) => void;
}

export function EventPanel({
  event,
  dayNamesLong,
  dayNamesShort,
  isNew,
  currentUserEmail,
  getAnchor,
  onClose,
  onCancel,
  onToggleAllDay,
  onSelectOccurrence,
  onEditTime,
}: EventPanelProps) {
  const calendarStore = useKloqStore();
  const announce = useAnnounce();
  const g = useKloqSettings();
  const spanLabel = (a: number, b: number) =>
    a === b ? (dayNamesShort[a] ?? "") : `${dayNamesShort[a] ?? ""} – ${dayNamesShort[b] ?? ""}`;
  const wrapRef = useRef<HTMLDivElement>(null);
  const timeErrorId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
  const dayRef = useRef<HTMLSpanElement>(null);
  const durRef = useRef<HTMLSpanElement>(null);
  // eventId is the placement id (anchoring, drag frames); storeId is what calendarStore is keyed by
  const eventId = event.id;
  const storeId = event.source.id;

  // a cross-midnight placement covers one day; show the occurrence's full span instead
  const split = event.segment.n > 1;
  const spanStartMin = split ? minutesOfDate(new Date(parseInstant(event.start))) : event.startMin;
  const spanEndMin = split
    ? spanStartMin + wallMinutesBetween(event.start, event.end)
    : event.endMin;
  // negative when only the tail is in view; the day name is then left out
  const spanDayIndex = event.dayIndex - event.segment.i;

  const readOnly = event.readOnly === true;

  const canEditTime = Boolean(onEditTime) && !readOnly && !event.allDay;
  const {
    editing: timeEditing,
    draft: timeDraft,
    invalid: timeInvalid,
    inputRef: timeInputRef,
    begin: beginTimeEdit,
    commit: commitTimeEdit,
    setDraft: setTimeDraft,
    setEditing: setTimeEditing,
    setInvalid: setTimeInvalid,
  } = useTimeEdit({ enabled: canEditTime, spanStartMin, spanEndMin, onEditTime });
  const attendees = event.attendees ?? [];
  const locationRef = useRef<HTMLInputElement>(null);
  const urlRef = useRef<HTMLInputElement>(null);
  const guestRef = useRef<HTMLInputElement>(null);
  const repeatRef = useRef<HTMLButtonElement>(null);
  const repeatSlotRef = useRef<HTMLDivElement>(null);

  const rrule = event.source.rrule;
  const anchorMs = parseInstant(event.source.start);
  const anchorDate = new Date(Number.isNaN(anchorMs) ? Date.now() : anchorMs);

  const occurrence: Occurrence | undefined = event.occurrence;
  const master = event.source;
  const series = Boolean(rrule) && occurrence !== undefined;
  const stepper = series && Boolean(onSelectOccurrence);
  const neighbours = useMemo(
    () =>
      occurrence
        ? {
            prev: previousOccurrence(master, occurrence.start),
            next: nextOccurrence(master, occurrence.start),
          }
        : { prev: null, next: null },
    // keyed on the fields the walk reads, not the master's identity (changes per keystroke)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [master.id, master.rrule, master.start, exdatesOf(master).join(","), occurrence?.start],
  );

  const stepTo = (target: Occurrence | null) => {
    if (!target || !onSelectOccurrence) return;
    const ms = parseInstant(target.start);
    onSelectOccurrence(
      occurrenceKey(storeId, target.start),
      new Date(Number.isNaN(ms) ? Date.now() : ms),
    );
  };

  const askScope = useRecurrenceScope();
  // the panel commits per keystroke, so the scope is chosen up front via the shared prompt
  const changeScope = (action: RecurrenceScopeAction) => {
    if (!occurrence || !askScope) return;
    void askScope({ action, event: master, occurrence }).then((scope) => {
      if (!scope) return;
      if (action === "delete") {
        applyPlan(calendarStore, deleteOccurrence(master, occurrence, scope));
        announce(announceDeleted([event]));
        onClose();
        return;
      }
      const plan = editOccurrence(master, occurrence, {}, scope, { makeId: g.makeId });
      applyPlan(calendarStore, plan);
      if (plan.selectId) {
        const ms = parseInstant(occurrence.start);
        onSelectOccurrence?.(plan.selectId, new Date(Number.isNaN(ms) ? Date.now() : ms));
      }
    });
  };

  const requestDelete = () => {
    if (series && askScope) {
      changeScope("delete");
      return;
    }
    calendarStore.remove(storeId);
    announce(announceDeleted([event]));
    onClose();
  };

  const reminders = event.source.reminders;
  const reminderRef = useRef<HTMLButtonElement>(null);
  const calendarRef = useRef<HTMLButtonElement>(null);

  const me = findAttendee(attendees, currentUserEmail);

  const conflicts = useConflicts(calendarStore, storeId, currentUserEmail);

  const hasValue: Record<Field, boolean> = {
    rrule: Boolean(rrule),
    reminders: (reminders?.length ?? 0) > 0,
    location: Boolean(event.location),
    meetingUrl: Boolean(event.meetingUrl),
    attendees: attendees.length > 0,
  };
  const focusField = (f: Field) => {
    if (f === "rrule") repeatRef.current?.focus();
    else if (f === "reminders") reminderRef.current?.focus();
    else if (f === "location") locationRef.current?.focus();
    else if (f === "meetingUrl") urlRef.current?.focus();
    else guestRef.current?.focus();
  };
  const {
    d,
    draft,
    invalid: draftInvalid,
    setDisc,
    shows,
    reveal,
  } = useDisclosure(eventId, hasValue, focusField);

  const commitGuests = (raw: string) => {
    const next = addAttendees(attendees, raw);
    if (!next) {
      setDisc({ ...d, invalid: raw.trim().length > 0 });
      return false;
    }
    calendarStore.update(storeId, { attendees: next });
    setDisc({ ...d, draft: "", invalid: false });
    return true;
  };

  const { reanchor } = useAnchoredPanel(wrapRef, getAnchor, eventId);
  useFollowDrag({
    wrapRef,
    eventId,
    reanchor,
    refs: { timeRef, dayRef, durRef },
    live: { dayNamesLong, spanLabel, formatRange: g.formatRange },
  });
  usePanelKeys({
    wrapRef,
    inputRef,
    eventId,
    event,
    isNew,
    readOnly,
    getAnchor,
    onCancel: onCancel ?? onClose,
  });

  const c = EVENT_COLORS[event.color];
  const own = event.color;
  const joinable = isJoinableUrl(event.meetingUrl);
  const busy = isBusy(event);

  const addable = ADDABLE.filter(([f]) => !shows(f));
  // CalendarField renders nothing without sources; avoid a dangling label row
  const hasCalendars = useCalendarSources().sources.length > 0;

  const setRsvp = (status: string) => {
    if (!me) return;
    const next = setAttendeeStatus(attendees, me.email, status as AttendeeStatus);
    if (next) calendarStore.update(storeId, { attendees: next });
  };
  const cancel = onCancel ?? onClose;

  return (
    <div
      ref={wrapRef}
      data-event-panel
      // deliberately not aria-modal: the grid behind stays live
      role="dialog"
      aria-label={`${event.title || "Untitled event"} — event details`}
      tabIndex={-1}
      className="fixed start-0 top-0 z-40 outline-none will-change-transform"
      style={{ width: PANEL_WIDTH }}
      onKeyDown={(e) => {
        // ⌘↵ saves; plain Enter is left alone for the textarea
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          onClose();
        }
      }}
    >
      <Card className="gap-0 overflow-hidden p-0 shadow-lg">
        <div className="flex flex-col gap-2 p-3 pb-2.5">
          <div className="in-data-sheet:sticky in-data-sheet:top-0 in-data-sheet:z-10 in-data-sheet:-mx-3 in-data-sheet:-mt-3 in-data-sheet:bg-card in-data-sheet:px-3 in-data-sheet:pt-3 in-data-sheet:pb-1">
            {readOnly ? (
              <div className="flex items-center gap-2 px-0.5">
                <span
                  aria-hidden
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: c.solid }}
                />
                <h2 className="min-w-0 flex-1 truncate font-medium text-sm text-foreground">
                  {eventTitle(event)}
                </h2>
              </div>
            ) : (
              <InputGroup className={GHOST_FIELD}>
                <InputGroupAddon>
                  <span
                    aria-hidden
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: c.solid }}
                  />
                </InputGroupAddon>
                <Input
                  ref={inputRef}
                  value={event.title}
                  placeholder="New event"
                  aria-label="Event title"
                  className="font-medium"
                  onChange={(e) => calendarStore.update(storeId, { title: e.target.value })}
                />
              </InputGroup>
            )}
          </div>

          {/* live-bound: the drag engine rewrites these spans per frame */}
          <div className="flex items-center gap-2 px-2.5 text-xs">
            <Clock aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-1.5 tabular-nums">
              {event.allDay ? (
                <>
                  <span ref={dayRef} className="text-foreground">
                    {spanLabel(event.dayIndex, event.endDayIndex)}
                  </span>
                  <span ref={timeRef} className="text-muted-foreground">
                    All day
                  </span>
                </>
              ) : timeEditing ? (
                <Input
                  ref={timeInputRef}
                  size="xs"
                  value={timeDraft}
                  aria-label="Event time — a range like 11pm-5am; an inverted range ends the next day"
                  aria-invalid={timeInvalid || undefined}
                  aria-describedby={timeInvalid ? timeErrorId : undefined}
                  className="max-w-44 tabular-nums"
                  onChange={(e) => {
                    setTimeDraft(e.target.value);
                    setTimeInvalid(false);
                  }}
                  onBlur={() => setTimeEditing(false)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      commitTimeEdit();
                    } else if (e.key === "Escape") {
                      // the panel's document listener skips a prevented press
                      e.preventDefault();
                      e.stopPropagation();
                      setTimeEditing(false);
                    }
                  }}
                />
              ) : (
                <>
                  {canEditTime ? (
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={beginTimeEdit}
                      className="-mx-2 cursor-text font-normal"
                      aria-label={`Change time, currently ${g.formatRange(spanStartMin, spanEndMin)}`}
                    >
                      <span ref={timeRef} className="tabular-nums">
                        {g.formatRange(spanStartMin, spanEndMin)}
                      </span>
                    </Button>
                  ) : (
                    <span ref={timeRef} className="text-foreground">
                      {g.formatRange(spanStartMin, spanEndMin)}
                    </span>
                  )}
                  <span ref={dayRef} className="text-muted-foreground">
                    {dayNamesLong[spanDayIndex] ?? ""}
                  </span>
                  <span ref={durRef} className="text-muted-foreground">
                    {formatDuration(spanEndMin - spanStartMin)}
                  </span>
                </>
              )}
            </span>

            {onToggleAllDay && !readOnly ? (
              <Toggle
                size="xs"
                pressed={event.allDay === true}
                onPressedChange={onToggleAllDay}
                className="shrink-0 font-normal text-muted-foreground data-pressed:text-foreground"
              >
                All day
              </Toggle>
            ) : null}
          </div>

          {timeEditing && timeInvalid ? (
            <span
              id={timeErrorId}
              role="status"
              className="px-2.5 text-2xs text-destructive-foreground"
            >
              Enter a range like 11am–1pm
            </span>
          ) : null}

          {conflicts.length ? (
            <Tooltip>
              <TooltipTrigger
                render={
                  <div
                    role="status"
                    className="flex items-start gap-2 px-2.5 text-2xs text-muted-foreground"
                  />
                }
              >
                <TriangleAlert
                  aria-hidden
                  className="mt-px size-3.5 shrink-0 text-warning-foreground"
                />
                <span className="min-w-0 flex-1">{describeConflicts(conflicts)}</span>
              </TooltipTrigger>
              <TooltipPopup>{conflicts.map(eventTitle).join(", ")}</TooltipPopup>
            </Tooltip>
          ) : null}

          {series && !readOnly ? (
            <div className="flex items-center justify-between gap-2 ps-2.5 text-2xs text-muted-foreground">
              <span className="min-w-0 flex-1 truncate">
                Editing all events
                {occurrence && !occurrence.isFirst ? ` · occurrence ${occurrence.index + 1}` : ""}
              </span>
              <Button
                variant="ghost"
                size="xs"
                className="shrink-0 font-normal text-muted-foreground"
                onClick={() => changeScope("edit")}
              >
                Change…
              </Button>
            </div>
          ) : null}

          <div className="flex flex-col gap-px pt-0.5">
            {hasCalendars ? (
              <PropertyRow label="Calendar">
                {/* read off the store event, not the placement */}
                <CalendarField
                  value={event.source.calendarId}
                  readOnly={readOnly}
                  triggerRef={calendarRef}
                  onChange={(calendar) => {
                    calendarStore.update(storeId, { calendarId: calendar.id });
                    announce(announceCalendar(event, calendar.name));
                  }}
                />
              </PropertyRow>
            ) : null}

            {readOnly ? null : (
              <PropertyRow label="Color">
                <RadioGroupPrimitive
                  aria-label="Event color"
                  className={cn(ROW_H, "flex items-center px-0.5")}
                  value={own}
                  onValueChange={(key) => {
                    const color = key as EventColor;
                    calendarStore.update(storeId, { color });
                    announce(announceColor([event], color));
                  }}
                >
                  {COLOR_KEYS.map((key) => (
                    <RadioPrimitive.Root
                      key={key}
                      value={key}
                      aria-label={key}
                      data-color-swatch={key}
                      className="group/swatch grid size-6 cursor-pointer place-items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <SwatchDot color={key} on={own === key} />
                    </RadioPrimitive.Root>
                  ))}
                </RadioGroupPrimitive>
              </PropertyRow>
            )}

            {readOnly ? (
              busy ? null : (
                <PropertyRow label="Show as">
                  <RowValue className="text-muted-foreground">Free</RowValue>
                </PropertyRow>
              )
            ) : (
              <PropertyRow label="Show as">
                <div className={cn(ROW_H, "flex items-center px-2")}>
                  <SegmentedControl
                    size="xs"
                    aria-label="Availability"
                    value={busy ? "busy" : "free"}
                    onValueChange={(key) => calendarStore.update(storeId, { busy: key === "busy" })}
                  >
                    <SegmentedControlItem value="busy">Busy</SegmentedControlItem>
                    <SegmentedControlItem value="free">Free</SegmentedControlItem>
                  </SegmentedControl>
                </div>
              </PropertyRow>
            )}

            {shows("rrule") ? (
              readOnly ? (
                rrule ? (
                  <PropertyRow label="Repeat">
                    <RRuleBuilder value={rrule} date={anchorDate} readOnly onChange={() => {}} />
                  </PropertyRow>
                ) : null
              ) : (
                <PropertyRow label="Repeat" rowRef={revealRow}>
                  <div className="flex items-center gap-0.5">
                    <div className="min-w-0 flex-1">
                      <RRuleBuilder
                        value={rrule}
                        date={anchorDate}
                        triggerRef={repeatRef}
                        hostRef={wrapRef}
                        inlineSlot={repeatSlotRef}
                        onChange={(next) => calendarStore.update(storeId, { rrule: next })}
                      />
                    </div>
                    {stepper ? (
                      <>
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                aria-label="Previous occurrence"
                                className="shrink-0 text-muted-foreground"
                                disabled={!neighbours.prev}
                                onClick={() => stepTo(neighbours.prev)}
                              >
                                <ChevronLeft />
                              </Button>
                            }
                          />
                          <TooltipPopup>Previous occurrence</TooltipPopup>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                aria-label="Next occurrence"
                                className="shrink-0 text-muted-foreground"
                                disabled={!neighbours.next}
                                onClick={() => stepTo(neighbours.next)}
                              >
                                <ChevronRight />
                              </Button>
                            }
                          />
                          <TooltipPopup>Next occurrence</TooltipPopup>
                        </Tooltip>
                      </>
                    ) : null}
                  </div>
                </PropertyRow>
              )
            ) : null}

            {/* reminders are data only; the host owns scheduling */}
            {shows("reminders") ? (
              readOnly ? (
                <PropertyRow label="Remind">
                  <ReminderField value={reminders} readOnly onChange={() => {}} />
                </PropertyRow>
              ) : (
                <PropertyRow label="Remind" rowRef={revealRow}>
                  <ReminderField
                    value={reminders}
                    triggerRef={reminderRef}
                    onChange={(next) =>
                      calendarStore.update(storeId, {
                        reminders: next.length ? next : undefined,
                      })
                    }
                  />
                </PropertyRow>
              )
            ) : null}

            {shows("location") ? (
              readOnly ? (
                event.location ? (
                  <PropertyRow label="Place">
                    <RowValue>
                      <span className="min-w-0 truncate">{event.location}</span>
                    </RowValue>
                  </PropertyRow>
                ) : null
              ) : (
                <PropertyRow label="Place" rowRef={revealRow}>
                  <InputGroup className={cn(GHOST_FIELD, ROW_H, "flex rounded-md")}>
                    <Input
                      ref={locationRef}
                      size="xs"
                      value={event.location ?? ""}
                      placeholder="Add location"
                      aria-label="Location"
                      onChange={(e) => calendarStore.update(storeId, { location: e.target.value })}
                    />
                  </InputGroup>
                </PropertyRow>
              )
            ) : null}

            {shows("meetingUrl") ? (
              readOnly ? (
                event.meetingUrl ? (
                  <PropertyRow label="Meet">
                    <RowValue>
                      {joinable ? (
                        <a
                          href={event.meetingUrl}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="inline-flex min-w-0 items-center gap-1 text-foreground underline-offset-2 hover:underline"
                        >
                          <span className="truncate">{shortUrl(event.meetingUrl)}</span>
                          <ExternalLink aria-hidden className="size-3 shrink-0" />
                        </a>
                      ) : (
                        <span className="min-w-0 truncate">{event.meetingUrl}</span>
                      )}
                    </RowValue>
                  </PropertyRow>
                ) : null
              ) : (
                <PropertyRow label="Meet" rowRef={revealRow}>
                  <InputGroup className={cn(GHOST_FIELD, ROW_H, "flex rounded-md")}>
                    <Input
                      ref={urlRef}
                      size="xs"
                      value={event.meetingUrl ?? ""}
                      placeholder="Add video call link"
                      aria-label="Video call link"
                      className="text-ellipsis"
                      onChange={(e) =>
                        calendarStore.update(storeId, { meetingUrl: e.target.value })
                      }
                    />
                    {joinable ? (
                      <InputGroupAddon align="inline-end">
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                aria-label="Join call"
                                className="text-muted-foreground"
                                render={
                                  <a
                                    href={event.meetingUrl}
                                    target="_blank"
                                    rel="noreferrer noopener"
                                  />
                                }
                              >
                                <ExternalLink />
                              </Button>
                            }
                          />
                          <TooltipPopup>Join {shortUrl(event.meetingUrl ?? "")}</TooltipPopup>
                        </Tooltip>
                      </InputGroupAddon>
                    ) : null}
                  </InputGroup>
                </PropertyRow>
              )
            ) : null}

            {!readOnly && addable.length ? (
              <PropertyRow label="Add">
                <div className="flex flex-wrap items-center gap-x-0.5 px-0.5">
                  {addable.map(([field, Icon, label]) => (
                    <Button
                      key={field}
                      variant="ghost"
                      size="xs"
                      aria-label={label}
                      className="font-normal text-muted-foreground"
                      onClick={() => reveal(field)}
                    >
                      <Icon aria-hidden />
                      {SHORT_LABEL[field]}
                    </Button>
                  ))}
                </div>
              </PropertyRow>
            ) : null}
          </div>

          <div ref={repeatSlotRef} className="empty:hidden" />

          {readOnly ? (
            event.description ? (
              <ReadOnlyRow icon={<AlignLeft />}>
                <span className="whitespace-pre-wrap text-sm text-muted-foreground sm:text-xs">
                  {event.description}
                </span>
              </ReadOnlyRow>
            ) : null
          ) : (
            <InputGroup
              className={cn(
                GHOST_FIELD,
                "**:[textarea]:min-h-0 **:[textarea]:max-sm:min-h-0 **:[textarea]:py-1.5",
              )}
            >
              <InputGroupAddon className="self-start pt-2">
                <AlignLeft aria-hidden />
              </InputGroupAddon>
              <Textarea
                unstyled
                rows={1}
                value={event.description ?? ""}
                placeholder="Add description"
                aria-label="Event description"
                className="text-sm sm:text-xs"
                onChange={(e) => calendarStore.update(storeId, { description: e.target.value })}
              />
            </InputGroup>
          )}
        </div>

        {shows("attendees") ? (
          <>
            <Separator />
            <div ref={revealRow} className="flex flex-col gap-1 px-3 py-2.5">
              <div className="flex items-center gap-1.5 px-2.5 text-2xs text-muted-foreground">
                <Users aria-hidden className="size-3.5" />
                <span>{summaryLabel(attendees)}</span>
              </div>
              {me ? (
                readOnly ? (
                  <span className="px-2.5 text-2xs text-muted-foreground">
                    Going? {STATUS_LABEL[attendeeStatus(me)]}
                  </span>
                ) : (
                  <div className="flex items-center gap-2 px-2.5 py-0.5">
                    <span className="shrink-0 text-2xs text-muted-foreground">Going?</span>
                    <SegmentedControl
                      size="xs"
                      aria-label="Your RSVP"
                      value={attendeeStatus(me)}
                      onValueChange={setRsvp}
                    >
                      {RSVP_CHOICES.map((choice) => (
                        <SegmentedControlItem key={choice.status} value={choice.status}>
                          {choice.label}
                        </SegmentedControlItem>
                      ))}
                    </SegmentedControl>
                  </div>
                )
              ) : null}

              {attendees.length ? (
                <ul className="flex max-h-36 flex-col overflow-y-auto">
                  {attendees.map((a) => (
                    <AttendeeChip
                      key={a.email.toLowerCase()}
                      attendee={a}
                      readOnly={readOnly}
                      organizer={isOrganizer(event.source, a.email)}
                      you={me?.email === a.email}
                      onRemove={() =>
                        calendarStore.update(storeId, {
                          attendees: removeAttendee(attendees, a.email),
                        })
                      }
                      onCycle={() =>
                        calendarStore.update(storeId, {
                          attendees: attendees.map((x) =>
                            x.email === a.email ? { ...x, status: cycleStatus(x.status) } : x,
                          ),
                        })
                      }
                      onToggleOptional={() => {
                        const next = toggleAttendeeOptional(attendees, a.email);
                        if (next) calendarStore.update(storeId, { attendees: next });
                      }}
                    />
                  ))}
                </ul>
              ) : null}
              {readOnly ? null : (
                <InputGroup className={cn(GHOST_FIELD, ROW_H, "mt-0.5 flex rounded-md")}>
                  <InputGroupAddon>
                    <UserPlus aria-hidden />
                  </InputGroupAddon>
                  <Input
                    ref={guestRef}
                    size="xs"
                    value={draft}
                    placeholder="Add guest by email"
                    aria-label="Add guest by email"
                    aria-invalid={draftInvalid || undefined}
                    type="email"
                    autoComplete="off"
                    onChange={(e) => setDisc({ ...d, draft: e.target.value, invalid: false })}
                    onBlur={() => {
                      if (draft.trim()) commitGuests(draft);
                    }}
                    onPaste={(e) => {
                      const text = e.clipboardData.getData("text");
                      if (!/[,;\n]/.test(text)) return; // single address — let it type
                      e.preventDefault();
                      commitGuests(text);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === "," || e.key === "Tab") {
                        if (!draft.trim()) return;
                        // ⌘↵ is the panel's save shortcut
                        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) return;
                        if (commitGuests(draft) || e.key !== "Tab") e.preventDefault();
                      } else if (e.key === "Backspace" && !draft && attendees.length) {
                        e.preventDefault();
                        calendarStore.update(storeId, {
                          attendees: attendees.slice(0, -1),
                        });
                      }
                    }}
                  />
                </InputGroup>
              )}
              {draftInvalid ? (
                <span role="status" className="px-2.5 text-2xs text-destructive-foreground">
                  Enter a valid email address
                </span>
              ) : null}
            </div>
          </>
        ) : null}

        <div className="in-data-sheet:sticky in-data-sheet:bottom-0 in-data-sheet:z-10 in-data-sheet:bg-card">
          <Separator />

          <div className="flex items-center justify-between gap-2 px-5.5 py-2.5">
            <div className="-ms-1.5 flex items-center gap-2">
              {readOnly ? (
                <span className="flex items-center gap-1 text-2xs text-muted-foreground">
                  <Lock aria-hidden className="size-3" />
                  Read-only
                </span>
              ) : (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label="Delete event"
                        className="text-muted-foreground hover:text-destructive-foreground"
                        onClick={requestDelete}
                      >
                        <Trash2 />
                      </Button>
                    }
                  />
                  <TooltipPopup>Delete event</TooltipPopup>
                </Tooltip>
              )}
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label="Export .ics"
                      className="text-muted-foreground"
                      onClick={() => downloadICS(event)}
                    >
                      <CalendarArrowDown />
                    </Button>
                  }
                />
                <TooltipPopup>
                  <span className="flex items-center gap-2">
                    Export .ics
                    <KbdKeys keys={["⇧", "⌘", "E"]} />
                  </span>
                </TooltipPopup>
              </Tooltip>
              <span className="flex items-center gap-1.5 text-2xs text-muted-foreground in-data-sheet:hidden pointer-coarse:hidden">
                <KbdKeys keys={["esc"]} />
                close
              </span>
              <Button
                variant="ghost"
                size="xs"
                data-panel-dismiss
                className="hidden font-normal text-muted-foreground in-data-sheet:inline-flex pointer-coarse:inline-flex"
                onClick={cancel}
              >
                {isNew ? "Discard" : "Close"}
              </Button>
            </div>
            <Button size="xs" onClick={onClose}>
              {isNew ? "Create event" : "Done"}
              <KbdKeys
                keys={["⌘", "↵"]}
                className="*:border *:border-primary-foreground/40 *:bg-transparent *:text-primary-foreground pointer-coarse:hidden"
              />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
