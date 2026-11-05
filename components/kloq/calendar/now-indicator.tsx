"use client";

import { memo } from "react";
import { useKloqSettings } from "./settings-context";
import { useNowMinutes } from "./time-shade";

/** Current-time line across today's column. */
export interface NowIndicatorProps {
  /** Column showing today, or -1. */
  todayIndex: number;
  dayCount: number;
}

export const NowIndicator = memo(function NowIndicator({
  todayIndex,
  dayCount,
}: NowIndicatorProps) {
  const g = useKloqSettings();
  const minutes = useNowMinutes();

  // client-only: avoids SSR/client time mismatch
  if (minutes === null || todayIndex < 0) return null;
  if (minutes < g.dayStartMin || minutes > g.dayEndMin) return null;

  const pct = 100 / dayCount;
  return (
    <div
      className="pointer-events-none absolute z-20 flex items-center"
      style={{
        top: g.minutesToPx(minutes),
        left: `${todayIndex * pct}%`,
        width: `${pct}%`,
      }}
    >
      {/* Text alternative for the line; static, not a live region. */}
      <span className="sr-only">Current time, {g.formatMinutes(Math.round(minutes))}</span>
      <span aria-hidden className="-ms-0.75 size-1.5 rounded-full bg-(--kloq-now)" />
      <span aria-hidden className="h-px flex-1 bg-(--kloq-now)" />
    </div>
  );
});
