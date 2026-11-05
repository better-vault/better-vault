import { MS_PER_DAY, MS_PER_MINUTE } from "./date-math";
import { parseQuickAdd, type QuickAddOptions, type QuickAddToken } from "./quick-add";

export interface MoveTarget {
  start: Date;
  /** always `start + originalDuration` */
  end: Date;
  /** which parts of the original the input replaced */
  changed: { date: boolean; time: boolean };
  /** the input was a relative shift */
  relative: boolean;
  /** understood spans, for a live highlight */
  tokens: QuickAddToken[];
}

export interface MoveToOptions extends QuickAddOptions {
  /** treat a bare "m" unit as hours; default false */
  bareUnitIsHours?: boolean;
}

// "+1h", "-30m", "2 hours later", "a day later"; anything else falls through to the absolute parser
const RELATIVE =
  /^\s*(?:([+-])\s*)?(a|an|\d+(?:\.\d+)?)\s*(minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w)\s*(later|earlier|ago|back|forward)?\s*$/i;

function parseRelative(input: string, opts: MoveToOptions): number | null {
  const m = RELATIVE.exec(input);
  if (!m) return null;
  const [, sign, qtyRaw, unitRaw, direction] = m;

  const qty = /^an?$/i.test(qtyRaw) ? 1 : Number(qtyRaw);
  if (!Number.isFinite(qty) || qty <= 0) return null;

  const unit = unitRaw.toLowerCase();
  const perUnit = unit.startsWith("w")
    ? 7 * 24 * 60
    : unit.startsWith("d")
      ? 24 * 60
      : unit.startsWith("h")
        ? 60
        : unit === "m" && opts.bareUnitIsHours
          ? 60
          : 1;

  // "-30m earlier" is a typo, not a double negative: backwards wins
  const backwards = sign === "-" || /^(earlier|ago|back)$/i.test(direction ?? "");
  const magnitude = qty * perUnit;
  return backwards ? -magnitude : magnitude;
}

function withDateOf(base: Date, date: Date): Date {
  const out = new Date(base);
  out.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
  return out;
}

function withTimeOf(base: Date, time: Date): Date {
  const out = new Date(base);
  out.setHours(time.getHours(), time.getMinutes(), 0, 0);
  return out;
}

// `in 2 hours` is a moment, not a clock time: it names the day it lands on as well
const isOffset = (t: QuickAddToken) => t.kind === "time" && /^in\s/i.test(t.text);

interface Movable {
  start: Date;
  end: Date;
  allDay?: boolean;
}

/** The day a destination names, for an all-day event; `null` when it names none, or the day it is already on. */
function byDay(target: MoveTarget, current: Movable): MoveTarget | null {
  if (!target.changed.date) return null;
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  // a shift counted in hours drifts off midnight across a DST change: take the nearest day
  const start = day(
    target.relative ? new Date(target.start.getTime() + MS_PER_DAY / 2) : target.start,
  );
  if (start.getTime() === day(current.start).getTime()) return null;
  const span = Math.max(
    1,
    Math.round((current.end.getTime() - current.start.getTime()) / MS_PER_DAY),
  );
  const end = new Date(start);
  end.setDate(end.getDate() + span);
  return {
    ...target,
    start,
    end,
    changed: { date: true, time: false },
    tokens: target.tokens.filter((t) => t.kind !== "time" || isOffset(t)),
  };
}

/**
 * Resolve a move instruction against the event being moved; `null` when nothing was understood,
 * or when it is no destination for an all-day event.
 */
export function parseMoveTarget(
  input: string,
  current: Movable,
  now: Date,
  opts: MoveToOptions = {},
): MoveTarget | null {
  const target = resolve(input, current, now, opts);
  return target && current.allDay ? byDay(target, current) : target;
}

function resolve(
  input: string,
  current: Movable,
  now: Date,
  opts: MoveToOptions,
): MoveTarget | null {
  const text = input.trim();
  if (!text) return null;

  const durationMs = Math.max(0, current.end.getTime() - current.start.getTime());

  const shiftMin = parseRelative(text, opts);
  if (shiftMin !== null) {
    const start = new Date(current.start.getTime() + shiftMin * MS_PER_MINUTE);
    return {
      start,
      end: new Date(start.getTime() + durationMs),
      // a shift under a day is a time change even if it crosses midnight
      changed: {
        date: Math.abs(shiftMin) >= 24 * 60,
        time: Math.abs(shiftMin) < 24 * 60,
      },
      relative: true,
      tokens: [{ text, start: 0, end: text.length, kind: "duration" }],
    };
  }

  const parsed = parseQuickAdd(text, now, opts);
  const gaveDate = parsed.tokens.some((t) => t.kind === "date" || isOffset(t));
  const gaveTime = parsed.tokens.some((t) => t.kind === "time");
  if (!gaveDate && !gaveTime) return null;
  if (!parsed.start) return null;

  // inherit whatever wasn't named; quick add always returns a complete slot
  let start = new Date(current.start);
  if (gaveDate) start = withDateOf(start, parsed.start);
  if (gaveTime) start = withTimeOf(start, parsed.start);

  return {
    start,
    end: new Date(start.getTime() + durationMs),
    changed: { date: gaveDate, time: gaveTime },
    relative: false,
    tokens: parsed.tokens.filter((t) => t.kind === "date" || t.kind === "time"),
  };
}

export function describeMove(target: MoveTarget, format: (d: Date) => string): string {
  return format(target.start);
}
