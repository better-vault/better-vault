"use client";

import { memo } from "react";
import { formatDate } from "../lib/date-format";
import { useKloqSettings } from "./settings-context";

export interface DayHeaderProps {
  date: Date;
  index: number;
  isToday: boolean;
  nameShort: string;
}

const WEEKDAY_NARROW: Intl.DateTimeFormatOptions = { weekday: "narrow" };

export const DayHeader = memo(function DayHeader({ date, isToday, nameShort }: DayHeaderProps) {
  const g = useKloqSettings();
  const tone = isToday ? "font-medium text-foreground" : "text-muted-foreground";
  return (
    // the cell is the container: a column too narrow for "Mon" shows "M", never an ellipsis
    <div
      data-cal-day-header
      className="@container min-w-0 border-s border-border/70 text-xs first:border-s-0"
    >
      <div className="flex items-center justify-center gap-0.5 px-0.5 py-2 @[3rem]:gap-1.5 @[3rem]:px-1 @[4.5rem]:justify-start @[4.5rem]:px-2.5">
        <span aria-hidden className={`${tone} @[4.5rem]:hidden`}>
          {formatDate(date, g.locale, WEEKDAY_NARROW)}
        </span>
        <span className={`${tone} sr-only @[4.5rem]:not-sr-only`}>{nameShort}</span>
        {/* Every day gets the size-5 box so the header height never shifts on navigation. */}
        <span
          className={
            isToday
              ? "flex size-5 shrink-0 items-center justify-center rounded-full bg-primary font-medium text-primary-foreground tabular-nums"
              : "flex size-5 shrink-0 items-center justify-center text-muted-foreground tabular-nums"
          }
        >
          {date.getDate()}
        </span>
      </div>
    </div>
  );
});
