"use client";

/** timeline-header — the axis above the rows: a day tier when the window spans days, then time ticks. */

import { memo, useMemo } from "react";
import { useKloqSettings } from "../calendar/settings-context";
import { displayDate } from "../lib/instant";
import { axisLabels, createHorizontalAxis, type TimelineWindow } from "../lib/timeline-window";

export interface TimelineHeaderProps {
  window: TimelineWindow;
  locale?: string;
  /** px width of the sticky resource gutter, so the ticks line up with the canvas */
  gutterWidth: number;
}

export const TimelineHeader = memo(function TimelineHeader({
  window,
  locale,
  gutterWidth,
}: TimelineHeaderProps) {
  const g = useKloqSettings();
  const zone = g.displayZone;
  const axis = useMemo(() => createHorizontalAxis(window), [window]);
  const labels = useMemo(
    () => axisLabels(window, { wallClock: (at) => displayDate(at, zone) }),
    [window, zone],
  );
  const dayLabel = (at: Date) => {
    const d = displayDate(at, zone);
    return `${d.toLocaleDateString(locale ?? g.locale, { weekday: "short" })} ${d.getDate()}`;
  };

  return (
    <div aria-hidden className="flex border-b border-border" data-slot="timeline-header">
      <div
        className="sticky start-0 z-10 shrink-0 border-e border-border bg-background"
        style={{ width: gutterWidth }}
      />
      <div className="shrink-0" style={{ width: axis.extentPx }}>
        {labels.days.length > 0 ? (
          <div className="relative h-6 border-b border-border" data-slot="timeline-days">
            {labels.days.map((day) => (
              <div
                key={day.startMin}
                className="absolute inset-y-0 border-s border-border"
                style={{
                  left: axis.toPx(day.startMin),
                  width: axis.durationToPx(day.endMin - day.startMin),
                }}
              >
                <span
                  className="sticky inline-block whitespace-nowrap px-1.5 text-xs font-medium leading-6 text-foreground"
                  style={{ left: gutterWidth }}
                >
                  {dayLabel(day.at)}
                </span>
              </div>
            ))}
          </div>
        ) : null}
        <div className="relative h-8 overflow-hidden" data-slot="timeline-ticks">
          {labels.ticks.map((tick) => (
            <div
              key={tick.min}
              className="absolute inset-y-0 border-s border-border"
              style={{ left: axis.toPx(tick.min) }}
            >
              <span className="whitespace-nowrap ps-1.5 text-2xs tabular-nums leading-8 text-muted-foreground">
                {labels.dated ? dayLabel(tick.at) : g.formatMinutes(tick.minuteOfDay)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});
