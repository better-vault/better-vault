import { DRAG_THRESHOLD_PX } from "./calendar-types";

/** Matches base-ui's context-menu delay. */
export const LONG_PRESS_MS = 500;

type LongPressPhase = "pending" | "armed" | "cancelled";

export interface LongPressState {
  readonly phase: LongPressPhase;
  readonly x: number;
  readonly y: number;
  readonly startedAt: number;
  readonly delayMs: number;
  readonly movePx: number;
}

interface LongPressOptions {
  delayMs?: number;
  movePx?: number;
}

/** Which pointer types get the long-press opener rather than drag-on-empty. */
export function wantsLongPress(pointerType: string | undefined): boolean {
  return pointerType === "touch" || pointerType === "pen";
}

export function beginLongPress(
  x: number,
  y: number,
  startedAt: number,
  opts: LongPressOptions = {},
): LongPressState {
  return {
    phase: "pending",
    x,
    y,
    startedAt,
    delayMs: opts.delayMs ?? LONG_PRESS_MS,
    movePx: opts.movePx ?? DRAG_THRESHOLD_PX,
  };
}

/** Only a pending press is cancelled by movement — once armed, movement is the drag. */
export function longPressMove(s: LongPressState, x: number, y: number): LongPressState {
  if (s.phase !== "pending") return s;
  if (Math.hypot(x - s.x, y - s.y) < s.movePx) return s;
  return { ...s, phase: "cancelled" };
}

export function longPressTick(s: LongPressState, now: number): LongPressState {
  if (s.phase !== "pending") return s;
  if (now - s.startedAt < s.delayMs) return s;
  return { ...s, phase: "armed" };
}

export function cancelLongPress(s: LongPressState): LongPressState {
  return s.phase === "cancelled" ? s : { ...s, phase: "cancelled" };
}

/** 0 → 1 while pending; 1 once armed; 0 once cancelled (so the ring collapses). */
export function longPressProgress(s: LongPressState, now: number): number {
  if (s.phase === "armed") return 1;
  if (s.phase === "cancelled") return 0;
  if (s.delayMs <= 0) return 1;
  return Math.min(1, Math.max(0, (now - s.startedAt) / s.delayMs));
}

export const isPending = (s: LongPressState | null): boolean => s?.phase === "pending";
export const isArmed = (s: LongPressState | null): boolean => s?.phase === "armed";
