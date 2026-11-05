"use client";

/**
 * multi-tz-gutter — the hour axis in several zones at once.
 * Offsets come from `Intl` via `lib/timezone`; each row is resolved from a real instant.
 */

import {
  hourLabel,
  type TimeZoneColumn,
  wallClockIn,
  zoneAbbr as zoneAbbrOf,
  zoneOffsetMinutes,
} from "../lib/timezone";
import { useIsClient } from "../lib/use-is-client";
import { useKloqSettings } from "./settings-context";
import { type TimeGutterProps, useGutterDate } from "./time-gutter";

export { zoneAbbr } from "../lib/timezone";
export type { TimeZoneColumn };

/** Wall-clock time of an instant in a given IANA zone. */
export function zoneTimeAt(
  instant: Date | number,
  timeZone: string,
): { hour: number; minute: number } {
  const w = wallClockIn(instant, timeZone);
  return { hour: w.hour, minute: w.minute };
}

/** True when `timeZone` is offset from `relativeTo` (default: browser zone) by a non-whole hour. */
export function hasFractionalOffset(
  instant: Date | number,
  timeZone: string,
  relativeTo?: string,
): boolean {
  const base = relativeTo
    ? zoneOffsetMinutes(instant, relativeTo)
    : -new Date(instant).getTimezoneOffset();
  return (zoneOffsetMinutes(instant, timeZone) - base) % 60 !== 0;
}

export const formatZoneTime = hourLabel;

/** The zone caption above a gutter column. */
export const ZONE_CAPTION = "text-3xs font-medium uppercase tracking-wide text-muted-foreground";

/** Width of the single-zone gutter, in px — Tailwind's `w-16`. */
export const GUTTER_WIDTH = 64;

/**
 * Gutter width with these extra columns. `<Kloq>` publishes it as `--kloq-gutter-width`
 * so headers and the all-day lane can indent to match.
 */
export function multiZoneGutterWidth(
  columns: readonly TimeZoneColumn[],
  instant: Date | number,
  relativeTo?: string,
): number {
  let w = GUTTER_WIDTH;
  for (const c of columns) {
    w += hasFractionalOffset(instant, c.timeZone, relativeTo) ? 62 : 46;
  }
  return w;
}

export interface MultiTimeZoneGutterProps extends TimeGutterProps {
  /** extra zones, left of the main column; omit to use the calendar's `timeZones` */
  zones?: (string | TimeZoneColumn)[];
  /** 12- or 24-hour labels for the foreign columns; defaults to the calendar's `hour12` */
  hour12?: boolean;
}

export function MultiTimeZoneGutter({
  minutesToPx,
  startHour,
  endHour,
  height,
  formatHour,
  date,
  zones,
  hour12,
}: MultiTimeZoneGutterProps) {
  const g = useKloqSettings();
  const contextDate = useGutterDate();
  const isClient = useIsClient();
  const columns = zones ? normalizeLocal(zones) : g.timeZones;
  const use12 = hour12 ?? g.hour12 ?? true;

  // without a display zone the axis is the browser's clock; foreign cells wait for hydration
  const zonesReady = g.hasDisplayZone || isClient;

  const day = date ?? contextDate ?? g.displayNow();

  const instantAtHour = (h: number) => {
    const d = new Date(day);
    // wall-clock addition, not ms arithmetic: DST changeover days would slide every row
    d.setHours(h, 0, 0, 0);
    return g.fromDisplay(d);
  };

  const showHeadings = zones !== undefined;

  const hours: number[] = [];
  // hour 0's label would collide with the in-gutter headings
  const firstHour = showHeadings ? Math.max(1, startHour) : startHour;
  for (let h = firstHour; h < endHour; h++) hours.push(h);
  const noonish = instantAtHour(12);

  // fractional widening waits for the client to avoid a hydration mismatch
  const width = zonesReady
    ? multiZoneGutterWidth(columns, noonish, g.timeZone)
    : GUTTER_WIDTH + columns.length * 46;

  // no display zone → no zone label (server and browser would disagree)
  const mainLabel = g.hasDisplayZone ? g.zoneLabel(noonish) : "local";

  return (
    <div aria-hidden className="relative shrink-0 select-none" style={{ height, width }}>
      {showHeadings ? (
        <div className="absolute inset-x-0 top-1 flex items-baseline justify-between px-2">
          {columns.map((c) => (
            <span key={c.timeZone} className={ZONE_CAPTION}>
              {c.label ?? zoneAbbrOf(noonish, c.timeZone)}
            </span>
          ))}
          <span className={ZONE_CAPTION}>{mainLabel}</span>
        </div>
      ) : null}

      {hours.map((hour) => {
        const instant = instantAtHour(hour);
        return (
          <span
            key={hour}
            className="absolute inset-x-0 flex -translate-y-1/2 items-baseline justify-between px-2 text-2xs tabular-nums"
            style={{ top: minutesToPx(hour * 60) }}
          >
            {columns.map((c) => {
              if (!zonesReady) return <span key={c.timeZone} />;
              const { hour: zh, minute: zm } = zoneTimeAt(instant, c.timeZone);
              return (
                <span
                  key={c.timeZone}
                  className={zh === 0 ? "font-medium text-foreground" : "text-muted-foreground"}
                >
                  {hourLabel(zh, zm, use12)}
                </span>
              );
            })}
            <span className="pe-0.5 text-foreground">
              {formatHour ? formatHour(hour) : hourLabel(hour, 0, use12)}
            </span>
          </span>
        );
      })}
    </div>
  );
}

// deliberately not `normalizeZoneColumns`: an unknown zone should show up empty, not vanish
const normalizeLocal = (zones: (string | TimeZoneColumn)[]): TimeZoneColumn[] =>
  zones.map((z) => (typeof z === "string" ? { timeZone: z } : z));

/**
 * Bind zones once and hand the result to `components.TimeGutter`.
 * Prefer `<Kloq timeZones={[...]} />` unless one instance needs a different zone list.
 */
export function createMultiTimeZoneGutter(
  zones: (string | TimeZoneColumn)[],
  opts: { hour12?: boolean } = {},
) {
  return function BoundMultiTimeZoneGutter(props: TimeGutterProps) {
    return <MultiTimeZoneGutter {...props} zones={zones} {...opts} />;
  };
}
