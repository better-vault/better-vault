import { addDays, type CalEvent, type DayColumns, startOfLocalDay } from "./calendar-types";
import { MINUTES_PER_DAY } from "./date-math";

/** A window a gesture wants to occupy; `end` exclusive. All-day slots span local midnights. */
export interface Slot {
  start: Date;
  end: Date;
  allDay: boolean;
}

export type ConstraintGesture =
  | "create"
  | "move"
  | "resize"
  | "lane-move"
  | "lane-resize"
  | "duplicate"
  | "paste";

/** Does this gesture get the "already occupied" exemption? `false` for those making a NEW event. */
export const EXEMPTS_ORIGIN: Record<ConstraintGesture, boolean> = {
  create: false,
  move: true,
  resize: true,
  "lane-move": true,
  "lane-resize": true,
  duplicate: false,
  paste: false,
};

/** Constraints as a host passes them — every field optional. */
export interface KloqConstraints {
  /** Nothing may start before this instant (inclusive); all-day slots compare at day granularity. */
  minDate?: Date;
  /** Nothing may end after this instant; all-day slots may run to the end of its day. */
  maxDate?: Date;
  /** Return `true` to refuse a slot. Called with sub-slices and sampled to paint, so cheap and pure. */
  isSlotDisabled?(slot: Slot): boolean;
  /** Whole-drop veto about the event, not the time. Called once with the full target, never on create. */
  canDrop?(event: CalEvent, target: Slot): boolean;
}

export interface Constraints {
  /** Is there any constraint at all? Every entry point short-circuits on `!active`. */
  readonly active: boolean;
  /** epoch ms; `-Infinity` when the host passed no (valid) `minDate` */
  readonly minTime: number;
  /** epoch ms; `+Infinity` when the host passed no (valid) `maxDate` */
  readonly maxTime: number;
  readonly minDayTime: number;
  readonly maxDayTime: number;
  readonly hasBounds: boolean;
  readonly hasSlotRule: boolean;
  readonly hasDropRule: boolean;
  isSlotDisabled(slot: Slot): boolean;
  canDrop(event: CalEvent, target: Slot): boolean;
}

function timeOf(d: Date | undefined, fallback: number): number {
  if (!(d instanceof Date)) return fallback;
  const t = d.getTime();
  return Number.isFinite(t) ? t : fallback;
}

/** Resolve host constraints; invalid input degrades rather than throwing. */
export function createConstraints(c: KloqConstraints = {}): Constraints {
  const minTime = timeOf(c.minDate, -Infinity);
  const maxTime = timeOf(c.maxDate, Infinity);
  const hasBounds = minTime !== -Infinity || maxTime !== Infinity;
  const hasSlotRule = typeof c.isSlotDisabled === "function";
  const hasDropRule = typeof c.canDrop === "function";

  const slotRule = c.isSlotDisabled;
  const dropRule = c.canDrop;

  return {
    active: hasBounds || hasSlotRule || hasDropRule,
    minTime,
    maxTime,
    minDayTime: minTime === -Infinity ? -Infinity : startOfLocalDay(new Date(minTime)).getTime(),
    maxDayTime:
      maxTime === Infinity ? Infinity : addDays(startOfLocalDay(new Date(maxTime)), 1).getTime(),
    hasBounds,
    hasSlotRule,
    hasDropRule,
    isSlotDisabled: slotRule ? (slot) => slotRule(slot) === true : () => false,
    canDrop: dropRule ? (e, t) => dropRule(e, t) !== false : () => true,
  };
}

export const NO_CONSTRAINTS: Constraints = createConstraints();

/** Is this slot inside `[minDate, maxDate]`? A slot ending exactly at `minDate` is out. */
export function withinBounds(c: Constraints, slot: Slot): boolean {
  if (!c.hasBounds) return true;
  const lo = slot.allDay ? c.minDayTime : c.minTime;
  const hi = slot.allDay ? c.maxDayTime : c.maxTime;
  return slot.start.getTime() >= lo && slot.end.getTime() <= hi;
}

/** Bounds and the host's slot rule together. `canDrop` is NOT part of this. */
export function slotAllowed(c: Constraints, slot: Slot): boolean {
  if (!c.active) return true;
  if (!withinBounds(c, slot)) return false;
  return !c.isSlotDisabled(slot);
}

/** The parts of `target` that `origin` did not already cover — 0, 1 or 2 pieces. */
export function newlyOccupied(target: Slot, origin?: Slot): Slot[] {
  if (!origin || origin.allDay !== target.allDay) return [target];
  const ts = target.start.getTime();
  const te = target.end.getTime();
  const os = origin.start.getTime();
  const oe = origin.end.getTime();
  if (oe <= ts || os >= te) return [target]; // disjoint
  const out: Slot[] = [];
  if (ts < os) out.push({ start: target.start, end: new Date(os), allDay: target.allDay });
  if (te > oe) out.push({ start: new Date(oe), end: target.end, allDay: target.allDay });
  return out;
}

export interface DropRequest {
  gesture: ConstraintGesture;
  target: Slot;
  /** what it occupied before; absent for create and paste */
  origin?: Slot;
  event?: CalEvent;
}

/** Why a drop was refused. `slot` is the offending piece, for the copy. */
interface Refusal {
  gesture: ConstraintGesture;
  reason: "bounds" | "disabled" | "canDrop";
  slot: Slot;
}

/** Evaluate a gesture. `null` means allowed. */
export function refusalOf(c: Constraints, req: DropRequest): Refusal | null {
  if (!c.active) return null;
  const { gesture, target } = req;

  if (c.hasBounds || c.hasSlotRule) {
    const origin = EXEMPTS_ORIGIN[gesture] ? req.origin : undefined;
    for (const piece of newlyOccupied(target, origin)) {
      if (!withinBounds(c, piece)) return { gesture, reason: "bounds", slot: piece };
      if (c.hasSlotRule && c.isSlotDisabled(piece))
        return { gesture, reason: "disabled", slot: piece };
    }
  }

  // Host veto last: most expensive, and never called without an event.
  if (c.hasDropRule && req.event && !c.canDrop(req.event, target))
    return { gesture, reason: "canDrop", slot: target };

  return null;
}

export function allows(c: Constraints, req: DropRequest): boolean {
  return refusalOf(c, req) === null;
}

/** Build a timed slot from column space; `toInstant` (`settings.fromDisplay`) keeps it zone-agnostic. */
export function timedSlot(
  view: DayColumns,
  col: number,
  startMin: number,
  endMin: number,
  toInstant: (d: Date) => number = (d) => d.getTime(),
): Slot {
  const day = view.days[Math.max(0, Math.min(view.days.length - 1, col))];
  const base = startOfLocalDay(day);
  const s = new Date(base);
  s.setMinutes(s.getMinutes() + Math.round(startMin));
  const e = new Date(base);
  e.setMinutes(e.getMinutes() + Math.round(endMin));
  return { start: new Date(toInstant(s)), end: new Date(toInstant(e)), allDay: false };
}

/** Build an all-day slot spanning columns `[startCol, endCol]` inclusive. No zone conversion. */
export function allDaySlot(view: DayColumns, startCol: number, endCol: number): Slot {
  const n = view.days.length - 1;
  const a = Math.max(0, Math.min(n, Math.min(startCol, endCol)));
  const b = Math.max(0, Math.min(n, Math.max(startCol, endCol)));
  return {
    start: startOfLocalDay(view.days[a]),
    end: addDays(startOfLocalDay(view.days[b]), 1),
    allDay: true,
  };
}

interface DisabledBand {
  dayIndex: number;
  startMin: number;
  endMin: number;
}

interface BandOptions {
  dayStartMin?: number;
  dayEndMin?: number;
  /** Sampling resolution; defaults to 15, callers pass `settings.snapMinutes` so bands match the snap. */
  stepMinutes?: number;
  toInstant?: (d: Date) => number;
}

/** Every refused region in the visible range, merged into runs. Sampled; never call from the rAF loop. */
export function disabledBands(
  view: DayColumns,
  c: Constraints,
  opts: BandOptions = {},
): DisabledBand[] {
  if (!c.active || !(c.hasBounds || c.hasSlotRule)) return [];
  const from = opts.dayStartMin ?? 0;
  const to = opts.dayEndMin ?? MINUTES_PER_DAY;
  const step = Math.max(1, Math.round(opts.stepMinutes ?? 15));
  const bands: DisabledBand[] = [];

  for (let col = 0; col < view.days.length; col++) {
    let runStart: number | null = null;
    for (let min = from; min < to; min += step) {
      const end = Math.min(to, min + step);
      const blocked = !slotAllowed(c, timedSlot(view, col, min, end, opts.toInstant));
      if (blocked) {
        if (runStart === null) runStart = min;
      } else if (runStart !== null) {
        bands.push({ dayIndex: col, startMin: runStart, endMin: min });
        runStart = null;
      }
    }
    if (runStart !== null) bands.push({ dayIndex: col, startMin: runStart, endMin: to });
  }
  return bands;
}

export function disabledAllDayColumns(view: DayColumns, c: Constraints): number[] {
  if (!c.active || !(c.hasBounds || c.hasSlotRule)) return [];
  const out: number[] = [];
  for (let col = 0; col < view.days.length; col++)
    if (!slotAllowed(c, allDaySlot(view, col, col))) out.push(col);
  return out;
}
