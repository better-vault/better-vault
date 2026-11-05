"use client";

/**
 * move-to-input — natural-language "move this event to…" field, previewing the
 * resolved destination and which half (date/time) was inherited.
 */

import { ArrowRight, CalendarClock } from "@/components/kloq/lib/icons";
import { useEffect, useMemo, useRef } from "react";
import { type CalEvent, parseInstant } from "../lib/calendar-types";
import { movePatch } from "../lib/command-model";
import { formatEventWhen, formatWhen } from "../lib/event-search";
import { eventTitle } from "../lib/event-text";
import { type MoveTarget, parseMoveTarget } from "../lib/move-to";
import { cn } from "../lib/utils";
import { Badge } from "../ui/badge";
import { CommandFooter } from "../ui/command";
import { Input } from "../ui/input";
import { KbdKeys } from "./kbd-keys";
import { COMMAND_FIELD_ROW, useSpoken } from "./quick-add-input";
import { useKloqSettings } from "./settings-context";

interface MoveToInputProps {
  value: string;
  onValueChange: (value: string) => void;
  event: CalEvent;
  now: Date;
  /** Called with the resolved destination on commit. */
  onCommit: (target: MoveTarget) => void;
  onBack: () => void;
  autoFocus?: boolean;
  /** `false` keeps the preview out of the live region, for a demo that drives `value`. */
  announce?: boolean;
}

export function MoveToInput({
  value,
  onValueChange,
  event,
  now,
  onCommit,
  onBack,
  autoFocus = true,
  announce = true,
}: MoveToInputProps) {
  const g = useKloqSettings();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  const allDay = event.allDay === true;
  const { target, refused } = useMemo(() => {
    // an all-day event's dates are calendar days, not moments in the display zone
    const read = (t: string) =>
      allDay ? new Date(parseInstant(t)) : new Date(g.toDisplay?.(t) ?? Date.parse(t));
    const current = { start: read(event.start), end: read(event.end) };
    const target = parseMoveTarget(value, { ...current, allDay }, now);
    // understood, but nowhere an all-day event can go
    const refused = allDay && !target ? parseMoveTarget(value, current, now) : null;
    return { target, refused };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, event.start, event.end, allDay, now]);
  const inherited =
    !target || target.relative || allDay
      ? null
      : !target.changed.date
        ? "same day"
        : !target.changed.time
          ? "same time"
          : null;

  const from = formatEventWhen(event, now);
  const to = !target
    ? null
    : allDay
      ? formatEventWhen({ ...event, ...movePatch(event, target) }, now)
      : formatWhen(target.start, target.end, false, now);
  const spoken = useSpoken(to ? `Moves to ${to}` : "", announce);

  return (
    <div className="flex flex-col">
      <div className={COMMAND_FIELD_ROW}>
        <Input
          ref={inputRef}
          unstyled
          size="lg"
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && target) {
              e.preventDefault();
              onCommit(target);
            } else if (e.key === "Escape") {
              e.preventDefault();
              e.stopPropagation();
              onBack();
            }
          }}
          placeholder="next tuesday · 3pm · +2h · a day later"
          aria-label={`Move ${eventTitle(event)} to`}
          autoComplete="off"
          spellCheck={false}
          className="flex w-full text-base sm:text-sm"
        />
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t px-5 py-3 text-xs">
        <span className="flex min-w-0 items-center gap-2">
          <CalendarClock aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="text-muted-foreground line-through">{from}</span>
        </span>
        <span className="flex min-w-0 items-center gap-2">
          <ArrowRight aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
          <span className={cn("font-medium", to ? "text-foreground" : "text-muted-foreground")}>
            {to ??
              (!refused
                ? "—"
                : refused.changed.date
                  ? "already on that day"
                  : "all-day events move by date")}
          </span>
          {inherited ? (
            <Badge variant="secondary" size="sm">
              {inherited}
            </Badge>
          ) : null}
        </span>
        <span className="sr-only" aria-live="polite">
          {spoken}
        </span>
      </div>

      <CommandFooter>
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <KbdKeys keys={["↵"]} />
            move
          </span>
          <span className="flex items-center gap-1.5">
            <KbdKeys keys={["esc"]} />
            back
          </span>
        </span>
        <span>{allDay ? "moves by date" : "duration is kept"}</span>
      </CommandFooter>
    </div>
  );
}
