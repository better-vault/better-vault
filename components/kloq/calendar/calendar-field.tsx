"use client";

/**
 * calendar-field — which calendar an event lives on. Picking commits through
 * `onChange` immediately; renders nothing when no sources are registered.
 */

import { ChevronDown, Lock } from "@/components/kloq/lib/icons";
import { type RefObject, useState } from "react";
import {
  type CalendarAccount,
  type CalendarAccountGroup,
  type CalendarSource,
  findCalendar,
  groupByAccount,
  useCalendarSources,
} from "../lib/calendar-sources";
import { EVENT_COLORS } from "../lib/event-palette";
import { cn } from "../lib/utils";
import {
  Menu,
  MenuGroup,
  MenuGroupLabel,
  MenuPopup,
  MenuRadioGroup,
  MenuRadioItem,
  MenuTrigger,
} from "../ui/menu";
import { GHOST_TRIGGER, RowValue } from "./panel-rows";

// Read-only calendars are dropped unless the event is already on one (it must stay checked).
export function calendarChoices(
  accounts: readonly CalendarAccount[],
  sources: readonly CalendarSource[],
  current?: string,
): CalendarAccountGroup[] {
  const offerable = sources.filter((s) => !s.readOnly || s.id === current);
  return groupByAccount(accounts, offerable).filter((g) => g.calendars.length > 0);
}

export function calendarSummary(calendar: CalendarSource | undefined): string {
  return calendar?.name ?? "No calendar";
}

export interface CalendarFieldProps {
  /** The event's `calendarId`. Unset, or unregistered, reads as unassigned. */
  value?: string;
  /** Commit. Always a registered, writable calendar — the whole source, since callers need the name. */
  onChange: (calendar: CalendarSource) => void;
  /** Renders the current calendar as static text with no controls. */
  readOnly?: boolean;
  /** Lets the panel focus the trigger after revealing the row. */
  triggerRef?: RefObject<HTMLButtonElement | null>;
  /** Accounts to offer. Omit to read the registry. */
  accounts?: readonly CalendarAccount[];
  /** Calendars to offer. Omit to read the registry. */
  sources?: readonly CalendarSource[];
  className?: string;
}

export function CalendarField({
  value,
  onChange,
  readOnly = false,
  triggerRef,
  accounts,
  sources,
  className,
}: CalendarFieldProps) {
  const [open, setOpen] = useState(false);

  const registry = useCalendarSources();
  const resolvedAccounts = accounts ?? registry.accounts;
  const resolvedSources = sources ?? registry.sources;

  const current = findCalendar(resolvedSources, value);
  const groups = calendarChoices(resolvedAccounts, resolvedSources, value);

  if (groups.length === 0) return null;

  const summary = calendarSummary(current);

  if (readOnly) {
    if (!current) return null;
    return (
      <RowValue className={className}>
        <CalendarDot color={current.color} />
        <span className="min-w-0 flex-1 truncate">{summary}</span>
      </RowValue>
    );
  }

  const pick = (id: string) => {
    const calendar = findCalendar(resolvedSources, id);
    // re-picking the current calendar is a close, not a commit: no-op writes still push undo
    if (calendar && calendar.id !== value) onChange(calendar);
  };

  return (
    <Menu open={open} onOpenChange={setOpen}>
      <MenuTrigger
        ref={triggerRef}
        aria-label={`Calendar — ${summary}`}
        className={cn(GHOST_TRIGGER, className)}
      >
        {current ? (
          <CalendarDot color={current.color} />
        ) : (
          <span
            aria-hidden
            className="size-2.5 shrink-0 rounded-full border border-muted-foreground"
          />
        )}
        <span
          className={cn(
            "min-w-0 flex-1 truncate",
            current ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {summary}
        </span>
        <ChevronDown
          aria-hidden
          className="size-3 shrink-0 text-muted-foreground transition-transform duration-(--overlay-enter) group-data-popup-open:rotate-180 motion-reduce:transition-none"
        />
      </MenuTrigger>

      <MenuPopup align="start" className="w-60">
        <MenuRadioGroup value={value ?? ""} onValueChange={pick}>
          {groups.map((group) => (
            <MenuGroup key={group.account.id}>
              <MenuGroupLabel>{group.account.label}</MenuGroupLabel>
              {group.calendars.map((cal) => (
                <MenuRadioItem
                  key={cal.id}
                  value={cal.id}
                  disabled={cal.readOnly}
                  closeOnClick
                  aria-label={`${cal.name} — ${group.account.label}`}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <CalendarDot color={cal.color} />
                    <span className="min-w-0 flex-1 truncate">{cal.name}</span>
                    {cal.readOnly ? (
                      <Lock aria-hidden className="size-3 shrink-0 text-muted-foreground" />
                    ) : null}
                  </span>
                </MenuRadioItem>
              ))}
            </MenuGroup>
          ))}
        </MenuRadioGroup>
      </MenuPopup>
    </Menu>
  );
}

function CalendarDot({ color }: { color: CalendarSource["color"] }) {
  return (
    <span
      aria-hidden
      className="size-2.5 shrink-0 rounded-full"
      style={{ backgroundColor: EVENT_COLORS[color].solid }}
    />
  );
}
