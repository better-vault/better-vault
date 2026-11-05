import type { Lane } from "./lane";
import { layoutDay, type OverlapInput } from "./overlap";

export interface SubRowLayout {
  /** sub-row index within the lane */
  row: number;
  /** how many sub-rows the lane actually draws, never above the cap */
  rows: number;
  /** past the cap: not drawn, counted into the overflow affordance instead */
  hidden: boolean;
}

/**
 * Greedy first-fit packing, reusing the calendar's cluster layout unchanged —
 * a bar's sub-row within a lane is the same problem as an event's column
 * within a day.
 */
export function layoutLane(
  events: readonly OverlapInput[],
  maxRows: number,
): Map<string, SubRowLayout> {
  const cap = Math.max(1, Math.floor(maxRows));
  const packed = layoutDay(events);
  const out = new Map<string, SubRowLayout>();
  let drawn = 0;
  for (const { col } of packed.values()) {
    if (col < cap) drawn = Math.max(drawn, col + 1);
  }
  for (const [id, { col }] of packed) {
    out.set(id, { row: col, rows: Math.max(1, drawn), hidden: col >= cap });
  }
  return out;
}

/** How many bars fit in a lane, from its declared height. Always at least one. */
export function maxSubRows(lane: Lane, defaultHeight: number, barHeight: number): number {
  const height = lane.height ?? defaultHeight;
  return Math.max(1, Math.floor(height / Math.max(1, barHeight)));
}
