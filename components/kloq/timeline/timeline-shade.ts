import type { WorkingHours } from "../calendar/time-shade";
import { startOfLocalDay } from "../lib/instant";
import { minutesFromStart, type TimelineWindow } from "../lib/timeline-window";

export interface OffHoursBand {
  startMin: number;
  endMin: number;
}

/** The calendar's own default (`WeekGrid`'s `workingHours` prop) — shared so the app and the row never drift apart. */
export const DEFAULT_WORKING_HOURS: WorkingHours = { start: 9, end: 17 };

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * One band per non-working stretch (before `start`, after `end`) for every
 * local day the window overlaps, clipped to the window's own extent.
 */
export function offHoursBands(window: TimelineWindow, hours: WorkingHours): OffHoursBand[] {
  const totalMin = minutesFromStart(window, window.end);
  const bands: OffHoursBand[] = [];
  const clamp = (min: number) => Math.max(0, Math.min(totalMin, min));

  let day = startOfLocalDay(window.start);
  // one extra day of slack past the end so a window ending exactly at
  // midnight still gets its final after-hours band
  const stop = window.end.getTime() + MS_PER_DAY;
  while (day.getTime() < stop) {
    const dayStartMin = minutesFromStart(window, day);
    const workStart = dayStartMin + hours.start * 60;
    const workEnd = dayStartMin + hours.end * 60;
    const nextDayStartMin = dayStartMin + 1440;

    const before = { startMin: clamp(dayStartMin), endMin: clamp(workStart) };
    if (before.endMin > before.startMin) bands.push(before);

    const after = { startMin: clamp(workEnd), endMin: clamp(nextDayStartMin) };
    if (after.endMin > after.startMin) bands.push(after);

    day = new Date(day.getTime() + MS_PER_DAY);
  }
  return bands;
}
