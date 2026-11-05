"use client";

/**
 * Time-awareness washes over the grid canvas: past wash, working-hours tint,
 * and the unavailable hatch. All pointer-transparent, above hour lines, below events.
 */

import { memo, useEffect, useMemo, useState } from "react";
import { describeUnavailable } from "../lib/announce";
import { disabledBands } from "../lib/constraints";
import { formatDate } from "../lib/date-format";
import { useIsClient } from "../lib/use-is-client";
import { useConstraints } from "./constraints-context";
import { useKloqSettings } from "./settings-context";

export interface WorkingHours {
  /** first working hour, inclusive (e.g. 9) */
  start: number;
  /** end of the working day, exclusive (e.g. 17) */
  end: number;
}

/**
 * "Now" in the display zone as minutes into the day; null until the first client tick.
 * Ticks align to wall-clock 30s boundaries so every consumer moves in the same frame.
 */
export function useNowMinutes(): number | null {
  const g = useKloqSettings();
  const [minutes, setMinutes] = useState<number | null>(null);
  const displayNow = g.displayNow;
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const update = () => {
      const now = displayNow();
      setMinutes(now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60);
      timer = setTimeout(update, 30_000 - (Date.now() % 30_000));
    };
    update();
    return () => clearTimeout(timer);
  }, [displayNow]);
  return minutes;
}

interface TimeShadeProps {
  /** column showing today, or -1 (nothing is "past" in a future-only view) */
  todayIndex: number;
  dayCount: number;
  /** false disables the working-hours tint entirely */
  workingHours: WorkingHours | false;
}

// visually hidden but not from AT; inline so it survives a host without the stylesheet
const SR_ONLY = {
  position: "absolute",
  width: "1px",
  height: "1px",
  margin: "-1px",
  padding: 0,
  border: 0,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  clipPath: "inset(50%)",
  whiteSpace: "nowrap",
} as const;

const UNAVAILABLE_DAY: Intl.DateTimeFormatOptions = {
  weekday: "long",
  month: "long",
  day: "numeric",
};

const sameHours = (a: WorkingHours | false, b: WorkingHours | false) =>
  a === b || (!!a && !!b && a.start === b.start && a.end === b.end);

export const TimeShade = memo(
  function TimeShade({ todayIndex, dayCount, workingHours }: TimeShadeProps) {
    const g = useKloqSettings();
    const isClient = useIsClient();
    const { constraints, days } = useConstraints();
    const minutes = useNowMinutes();
    const colPct = 100 / dayCount;
    const bottom = g.canvasHeight;

    // sampled at snap resolution so the hatch's edge is exactly where a drag stops
    const bands = useMemo(
      () =>
        disabledBands({ days: days as Date[] }, constraints, {
          dayStartMin: g.dayStartMin,
          dayEndMin: g.dayEndMin,
          stepMinutes: g.snapMinutes,
          toInstant: g.fromDisplay,
        }),
      [days, constraints, g.dayStartMin, g.dayEndMin, g.snapMinutes, g.fromDisplay],
    );
    // clamp into the visible window: a clipped day range would give negative offsets
    const y = (min: number) => g.minutesToPx(g.clampMinutes(min));

    return (
      <>
        {workingHours ? (
          <>
            <div
              aria-hidden
              className="cal-offhours"
              style={{
                top: 0,
                height: y(workingHours.start * 60),
                left: 0,
                width: "100%",
              }}
            />
            <div
              aria-hidden
              className="cal-offhours"
              style={{
                top: y(workingHours.end * 60),
                height: bottom - y(workingHours.end * 60),
                left: 0,
                width: "100%",
              }}
            />
          </>
        ) : null}

        {bands.map((b) => (
          <div
            key={`${b.dayIndex}:${b.startMin}`}
            aria-hidden
            className="cal-blocked"
            data-cal-blocked=""
            style={{
              top: y(b.startMin),
              height: y(b.endMin) - y(b.startMin),
              left: `${b.dayIndex * colPct}%`,
              width: `${colPct}%`,
            }}
          />
        ))}
        {/* the hatch, for AT; client-only because the runtime's default locale differs from the server's */}
        {isClient && bands.length > 0 ? (
          <ul style={SR_ONLY} data-kloq-unavailable="">
            {bands.map((b) => (
              <li key={`${b.dayIndex}:${b.startMin}`}>
                {describeUnavailable({
                  day: days[b.dayIndex] && formatDate(days[b.dayIndex], g.locale, UNAVAILABLE_DAY),
                  time: g.formatRange(b.startMin, b.endMin),
                })}
              </li>
            ))}
          </ul>
        ) : null}

        {/* past wash is client-only */}
        {minutes !== null && todayIndex >= 0 ? (
          <>
            {todayIndex > 0 ? (
              <div
                aria-hidden
                className="cal-past-shade"
                style={{
                  top: 0,
                  height: bottom,
                  left: 0,
                  width: `${todayIndex * colPct}%`,
                }}
              />
            ) : null}
            <div
              aria-hidden
              className="cal-past-shade"
              style={{
                top: 0,
                height: y(minutes),
                left: `${todayIndex * colPct}%`,
                width: `${colPct}%`,
              }}
            />
          </>
        ) : null}
      </>
    );
  },
  (a, b) =>
    a.todayIndex === b.todayIndex &&
    a.dayCount === b.dayCount &&
    sameHours(a.workingHours, b.workingHours),
);
