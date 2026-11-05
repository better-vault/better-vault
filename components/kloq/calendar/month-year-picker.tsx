"use client";

/** month-year-picker — the range title as a control; moves the anchor without changing the view. */

import { ChevronLeft, ChevronRight } from "@/components/kloq/lib/icons";
import { useMemo, useState } from "react";
import { dateFormatter } from "../lib/date-format";
import { cn } from "../lib/utils";
import { Button } from "../ui/button";
import { Popover, PopoverPopup, PopoverTrigger } from "../ui/popover";

interface MonthYearPickerProps {
  /** current anchor — decides which cell reads as selected */
  date: Date;
  /** move the anchor; the view is left alone */
  onPick: (date: Date) => void;
  /** the rendered title, e.g. "August 2026" */
  label: string;
  /** `Intl` locale for the month names; falls back to the runtime default */
  locale?: string;
  className?: string;
}

const MONTH_FORMAT: Intl.DateTimeFormatOptions = { month: "short" };

function monthNames(locale?: string): string[] {
  const fmt = dateFormatter(locale, MONTH_FORMAT);
  return Array.from({ length: 12 }, (_, m) => fmt.format(new Date(2026, m, 1)));
}

export function MonthYearPicker({ date, onPick, label, locale, className }: MonthYearPickerProps) {
  const [open, setOpen] = useState(false);
  // the browsed year is separate from the anchor until a month is picked
  const [year, setYear] = useState(() => date.getFullYear());
  const months = useMemo(() => monthNames(locale), [locale]);
  const today = new Date();

  const openChange = (next: boolean) => {
    if (next) setYear(date.getFullYear());
    setOpen(next);
  };

  const pick = (month: number) => {
    setOpen(false);
    // the 1st: anchoring on the 31st would skip February
    onPick(new Date(year, month, 1));
  };

  return (
    <Popover open={open} onOpenChange={openChange}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="xs"
            className={cn("max-w-full data-popup-open:bg-accent", className)}
          />
        }
        aria-label={`${label} — jump to a month`}
      >
        <span className="truncate">{label}</span>
      </PopoverTrigger>

      <PopoverPopup className="w-60" side="bottom" align="start">
        <div className="flex items-center justify-between pb-2">
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={`Go to ${year - 1}`}
            onClick={() => setYear((y) => y - 1)}
          >
            <ChevronLeft />
          </Button>
          <span className="text-sm font-medium tabular-nums">{year}</span>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={`Go to ${year + 1}`}
            onClick={() => setYear((y) => y + 1)}
          >
            <ChevronRight />
          </Button>
        </div>

        <div role="group" aria-label={`Months of ${year}`} className="grid grid-cols-3 gap-1">
          {months.map((name, m) => {
            const selected = year === date.getFullYear() && m === date.getMonth();
            const isThisMonth = year === today.getFullYear() && m === today.getMonth();
            return (
              <Button
                key={name}
                variant={selected ? "default" : isThisMonth ? "secondary" : "ghost"}
                size="xs"
                aria-pressed={selected}
                aria-current={isThisMonth ? "date" : undefined}
                onClick={() => pick(m)}
              >
                {name}
              </Button>
            );
          })}
        </div>

        <div className="mt-2 border-t pt-2">
          <Button
            variant="ghost"
            size="xs"
            className="w-full justify-center text-muted-foreground"
            onClick={() => {
              setOpen(false);
              onPick(new Date());
            }}
          >
            Today
          </Button>
        </div>
      </PopoverPopup>
    </Popover>
  );
}
