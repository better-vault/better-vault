"use client";

/** timeline-now — the vertical equivalent of `../calendar/now-indicator.tsx`. */

import { useEffect, useState } from "react";
import { useKloqSettings } from "../calendar/settings-context";
import type { KloqAxis } from "../lib/axis";
import { displayDate, minutesOfDate } from "../lib/instant";
import { instantAtMinute, minutesFromStart, type TimelineWindow } from "../lib/timeline-window";

/** Minutes from the window origin to now, ticking every 30s; null until the first client tick. */
function useNowInWindow(window: TimelineWindow): number | null {
  const [min, setMin] = useState<number | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const update = () => {
      setMin(minutesFromStart(window, Date.now()));
      timer = setTimeout(update, 30_000 - (Date.now() % 30_000));
    };
    update();
    return () => clearTimeout(timer);
  }, [window]);
  return min;
}

export interface TimelineNowProps {
  window: TimelineWindow;
  axis: KloqAxis;
  /** px width of the sticky resource gutter the line sits past */
  gutterWidth: number;
}

/** A vertical line + dot spanning every row, shown only while now falls inside the window. */
export function TimelineNow({ window, axis, gutterWidth }: TimelineNowProps) {
  const g = useKloqSettings();
  const min = useNowInWindow(window);

  if (min === null || min < axis.startMin || min > axis.endMin) return null;

  const nowOfDay = minutesOfDate(displayDate(instantAtMinute(window, min), g.displayZone));

  return (
    <div
      className="pointer-events-none absolute inset-y-0 z-20 w-px"
      style={{ left: gutterWidth + axis.toPx(min) }}
      data-slot="timeline-now"
    >
      <span className="sr-only" suppressHydrationWarning>
        Current time, {g.formatMinutes(Math.round(nowOfDay))}
      </span>
      <span
        aria-hidden
        className="absolute top-0 start-1/2 size-1.5 -translate-x-1/2 rtl:translate-x-1/2 rounded-full bg-(--kloq-now)"
      />
      <span aria-hidden className="absolute inset-0 bg-(--kloq-now)" />
    </div>
  );
}
