"use client";

import { createContext, useContext } from "react";
import { MultiTimeZoneGutter } from "./multi-tz-gutter";
import { useKloqSettings } from "./settings-context";

export interface TimeGutterProps {
  /** THE px↔time mapping; takes absolute minutes from midnight, accounts for `dayStartHour` */
  minutesToPx: (min: number) => number;
  startHour: number;
  endHour: number;
  /** total axis height in px, = minutesToPx(endHour * 60) */
  height: number;
  /** label for an hour, honouring `locale`/`hour12`; `<Kloq>` always passes it */
  formatHour?: (hour: number) => string;
  /** the day this axis represents (display-zone `Date`); falls back to `useGutterDate()` */
  date?: Date;
}

const GutterDateContext = createContext<Date | undefined>(undefined);

export const GutterDateProvider = GutterDateContext.Provider;

/** The day the axis represents, or `undefined` outside a `<Kloq>`. */
export function useGutterDate(): Date | undefined {
  return useContext(GutterDateContext);
}

/** Which visible day the shared axis speaks for: today when on screen, else the first. */
export function gutterDateFor(
  days: readonly Date[] | undefined,
  todayIndex: number,
): Date | undefined {
  if (!days?.length) return undefined;
  return days[todayIndex >= 0 && todayIndex < days.length ? todayIndex : 0];
}

const legacyHour = (hour: number) =>
  hour === 12 ? "12 PM" : hour < 12 ? `${hour} AM` : `${hour - 12} PM`;

/** The hour axis. Delegates to `MultiTimeZoneGutter` when `timeZones` is configured. */
export function TimeGutter(props: TimeGutterProps) {
  const g = useKloqSettings();
  if (g.timeZones.length > 0) return <MultiTimeZoneGutter {...props} />;
  return <SingleZoneGutter {...props} />;
}

function SingleZoneGutter({
  minutesToPx,
  startHour,
  endHour,
  height,
  formatHour = legacyHour,
}: TimeGutterProps) {
  const hours: number[] = [];
  for (let h = startHour; h < endHour; h++) hours.push(h);
  // no zone caption: the gutter scrolls; the label lives in `GutterZoneLabels`
  return (
    <div aria-hidden className="relative w-16 shrink-0 select-none" style={{ height }}>
      {hours.map((hour) => (
        <span
          key={hour}
          className="absolute end-2.5 -translate-y-1/2 text-2xs tabular-nums text-muted-foreground"
          style={{ top: minutesToPx(hour * 60) }}
        >
          {formatHour(hour)}
        </span>
      ))}
    </div>
  );
}
