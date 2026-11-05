import { MINUTES_PER_DAY } from "./date-math";
import {
  displayDate,
  type Instant,
  instantAt,
  instantPlus,
  minutesOfDate,
  parseInstant,
  wallMinutesBetween,
} from "./instant";
import type { DayColumns } from "./view";

/** The placement fields the move rule needs; `start`/`end` are the occurrence's own instants. */
export interface Placed {
  dayIndex: number;
  startMin: number;
  segment: { i: number; n: number };
  start: Instant;
  end: Instant;
}

export interface Target {
  dayIndex: number;
  startMin: number;
}

/** Wall-clock duration, never `end - start` ms: a 1h meeting across a DST change stays 1h. */
export const wallDuration = (p: Pick<Placed, "start" | "end">, zone?: string) =>
  wallMinutesBetween(p.start, p.end, zone);

/**
 * Where a timed event starts after its block is dropped at `target`.
 * A cross-midnight segment (or `byDelta`) commits a DELTA from the event's own start, so the
 * event moves as a whole; a single-day block is materialised from the column and minute.
 */
export function movedStart(
  placed: Placed | undefined,
  view: DayColumns,
  zone: string | undefined,
  target: Target,
  byDelta = false,
): Instant {
  if (placed && (byDelta || placed.segment.n > 1)) {
    return instantPlus(
      placed.start,
      (target.dayIndex - placed.dayIndex) * MINUTES_PER_DAY + (target.startMin - placed.startMin),
      zone,
    );
  }
  return instantAt(view, target.dayIndex, target.startMin, zone);
}

/** Where the EVENT landed, for the announcement — not where the grabbed segment did. */
export function landedWhen(
  placed: Placed | undefined,
  zone: string | undefined,
  target: Target,
  duration: number,
  byDelta = false,
): { dayIndex: number; startMin: number; endMin: number } {
  if (placed && (byDelta || placed.segment.n > 1)) {
    const was = minutesOfDate(displayDate(parseInstant(placed.start), zone));
    const now = was + (target.startMin - placed.startMin);
    return {
      dayIndex: target.dayIndex - placed.segment.i,
      startMin: now,
      endMin: now + duration,
    };
  }
  return {
    dayIndex: target.dayIndex,
    startMin: target.startMin,
    endMin: target.startMin + duration,
  };
}
