"use client";

/**
 * reminder-field — the panel's alert control, a thin shell over `lib/reminders.ts`.
 * Edits data only; the host owns delivery via `nextReminderAt`.
 */

import { Bell, ChevronDown, Plus } from "@/components/kloq/lib/icons";
import { type RefObject, useState } from "react";
import type { Reminder } from "../lib/calendar-types";
import {
  addReminder,
  describeReminder,
  describeReminders,
  MAX_REMINDERS,
  normalizeReminders,
  parseReminderAmount,
  REMINDER_PRESETS,
  REMINDER_UNITS,
  type ReminderUnit,
  removeReminder,
} from "../lib/reminders";
import { useEscapeCapture } from "../lib/use-escape-capture";
import { cn } from "../lib/utils";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Popover, PopoverPopup, PopoverTrigger } from "../ui/popover";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "../ui/select";
import { Separator } from "../ui/separator";
import { GHOST_TRIGGER, RowValue } from "./panel-rows";

const UNIT_ITEMS: { value: ReminderUnit; label: string }[] = REMINDER_UNITS.map((u) => ({
  value: u.unit,
  label: { minutes: "min", hours: "hours", days: "days", weeks: "weeks" }[u.unit],
}));

const isPreset = (r: Reminder) =>
  !r.method && REMINDER_PRESETS.some((p) => p.minutesBefore === r.minutesBefore);

export interface ReminderFieldProps {
  /** The event's reminders. Normalised on every commit, never in place. */
  value?: readonly Reminder[];
  /** Commit. Always receives a canonical list; `[]` means "no reminders". */
  onChange: (next: Reminder[]) => void;
  /** Renders the summary as static text with no controls. */
  readOnly?: boolean;
  /** Lets the panel focus the trigger after revealing the row. */
  triggerRef?: RefObject<HTMLButtonElement | null>;
  className?: string;
}

export function ReminderField({
  value,
  onChange,
  readOnly = false,
  triggerRef,
  className,
}: ReminderFieldProps) {
  const [open, setOpen] = useState(false);
  const [unitOpen, setUnitOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [unit, setUnit] = useState<ReminderUnit>("minutes");

  const reminders = normalizeReminders(value);
  const summary = describeReminders(reminders);
  const full = reminders.length >= MAX_REMINDERS;

  // capture phase, to beat the panel's own Escape; the unit select answers its own
  useEscapeCapture(open && !unitOpen, () => {
    setOpen(false);
    triggerRef?.current?.focus();
  });

  if (readOnly) {
    if (reminders.length === 0) return null;
    return (
      <RowValue className={className}>
        <Bell aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate">{summary}</span>
      </RowValue>
    );
  }

  const commitCustom = () => {
    const minutes = parseReminderAmount(amount, unit);
    if (minutes === null) return;
    const next = addReminder(reminders, { minutesBefore: minutes });
    if (next) onChange(next);
    setAmount("");
  };

  const customValid = parseReminderAmount(amount, unit) !== null;

  // custom offsets first: they have no preset row to untick
  const rows: { key: string; label: string; on: boolean; toggle: () => void }[] = [
    ...reminders
      .filter((r) => !isPreset(r))
      .map((r) => ({
        key: `${r.minutesBefore}:${r.method ?? "popup"}`,
        label: describeReminder(r, { withMethod: true }),
        on: true,
        toggle: () => onChange(removeReminder(reminders, r)),
      })),
    ...REMINDER_PRESETS.map((p) => {
      const on = reminders.some((r) => r.minutesBefore === p.minutesBefore && !r.method);
      return {
        key: `preset:${p.minutesBefore}`,
        label: p.label,
        on,
        toggle: () => {
          const next = on
            ? removeReminder(reminders, { minutesBefore: p.minutesBefore })
            : addReminder(reminders, { minutesBefore: p.minutesBefore });
          if (next) onChange(next);
        },
      };
    }),
  ];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        ref={triggerRef}
        aria-label={`Reminders — ${summary}`}
        className={cn(GHOST_TRIGGER, className)}
      >
        <Bell aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
        <span
          className={cn(
            "min-w-0 flex-1 truncate",
            reminders.length ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {summary}
        </span>
        <ChevronDown
          aria-hidden
          className="size-3 shrink-0 text-muted-foreground transition-transform duration-(--overlay-enter) group-data-popup-open:rotate-180 motion-reduce:transition-none"
        />
      </PopoverTrigger>

      <PopoverPopup side="bottom" align="start" padding="sm" className="w-64">
        <div role="group" aria-label="Reminders" className="flex flex-col">
          {rows.map((row) => (
            <Label
              key={row.key}
              className="min-h-8 cursor-default rounded-sm px-2 font-normal hover:bg-accent has-data-disabled:pointer-events-none has-data-disabled:opacity-64 sm:min-h-7"
            >
              <Checkbox checked={row.on} disabled={!row.on && full} onCheckedChange={row.toggle} />
              <span className="min-w-0 flex-1 truncate">{row.label}</span>
            </Label>
          ))}
        </div>

        <Separator className="my-1" />

        <div className="flex items-center gap-1.5 px-1 pb-1">
          <Input
            size="xs"
            inputMode="numeric"
            aria-label="Custom reminder amount"
            aria-invalid={amount.trim() !== "" && !customValid ? true : undefined}
            placeholder="15"
            className="w-14 shrink-0"
            value={amount}
            disabled={full}
            onChange={(e) => setAmount(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter" || e.metaKey || e.ctrlKey) return;
              e.preventDefault();
              commitCustom();
            }}
          />
          <Select
            items={UNIT_ITEMS}
            value={unit}
            onValueChange={(v) => setUnit(v as ReminderUnit)}
            onOpenChange={setUnitOpen}
            disabled={full}
          >
            <SelectTrigger
              size="xs"
              aria-label="Custom reminder unit"
              className="w-auto min-w-20 shrink-0"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectPopup size="xs">
              {UNIT_ITEMS.map((u) => (
                <SelectItem key={u.value} value={u.value}>
                  {u.label}
                </SelectItem>
              ))}
            </SelectPopup>
          </Select>
          <span className="text-2xs text-muted-foreground">before</span>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Add custom reminder"
            className="ms-auto text-muted-foreground"
            disabled={!customValid || full}
            onClick={commitCustom}
          >
            <Plus />
          </Button>
        </div>

        {full ? (
          <p className="px-2 pb-1.5 text-2xs text-muted-foreground">
            {MAX_REMINDERS} reminders is the limit — remove one to add another.
          </p>
        ) : null}
      </PopoverPopup>
    </Popover>
  );
}
