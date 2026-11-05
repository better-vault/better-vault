"use client";

/** gutter-zone-labels — zone captions for the hour axis, in the sticky header corner. */

import { memo, useEffect, useState } from "react";
import { localZone, zoneAbbr } from "../lib/timezone";
import { useIsClient } from "../lib/use-is-client";
import { cn } from "../lib/utils";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { FOCUS_RING } from "./cell-classes";
import { ZONE_CAPTION } from "./multi-tz-gutter";
import { useKloqSettings } from "./settings-context";
import { useGutterDate } from "./time-gutter";

interface GutterZoneLabelsProps {
  /** The day the axis represents (see `gutterDateFor`). */
  day: Date | undefined;
  /** Present ⇒ the labels render as a button and this fires on press. */
  onPress?: () => void;
}

export const GutterZoneLabels = memo(function GutterZoneLabels({
  day,
  onPress,
}: GutterZoneLabelsProps) {
  const g = useKloqSettings();
  const contextDay = useGutterDate();
  const isClient = useIsClient();
  const columns = g.timeZones;

  // "Today" fallback resolved in an effect: displayNow() in render is impure on the server.
  const [fallbackDay, setFallbackDay] = useState<Date | null>(null);
  const needsFallback = !day && !contextDay;
  const displayNow = g.displayNow;
  useEffect(() => {
    if (needsFallback) setFallbackDay(displayNow());
  }, [needsFallback, displayNow]);

  if (columns.length === 0 && !g.hasDisplayZone && !onPress) return null;

  // Read at midday, not midnight: on a DST changeover day midnight is still the old zone.
  const resolvedDay = day ?? contextDay ?? fallbackDay;
  let instant: ReturnType<typeof g.fromDisplay> | null = null;
  if (resolvedDay) {
    const d = new Date(resolvedDay);
    d.setHours(12, 0, 0, 0);
    instant = g.fromDisplay(d);
  }

  // The browser's own zone isn't knowable on the server, so that label waits a render.
  const mainLabel =
    instant === null
      ? ""
      : g.hasDisplayZone
        ? g.zoneLabel(instant)
        : isClient
          ? zoneAbbr(instant, localZone())
          : "";

  const row =
    columns.length > 0 ? (
      <span className="flex w-full items-baseline justify-between px-2">
        {columns.map((c) => (
          <span key={c.timeZone}>
            {c.label ?? (instant === null ? "" : zoneAbbr(instant, c.timeZone))}
          </span>
        ))}
        <span>{mainLabel}</span>
      </span>
    ) : (
      <span className="flex w-full justify-end pe-2.5">{mainLabel}</span>
    );

  if (!onPress) {
    return (
      <span aria-hidden className={cn("select-none", ZONE_CAPTION)}>
        {row}
      </span>
    );
  }
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            onClick={onPress}
            aria-label="Change time zones"
            className={cn(
              ZONE_CAPTION,
              "flex min-h-6 cursor-pointer items-center rounded-sm transition-colors hover:bg-accent hover:text-foreground",
              FOCUS_RING,
            )}
          />
        }
      >
        {row}
      </TooltipTrigger>
      <TooltipPopup>Time zones</TooltipPopup>
    </Tooltip>
  );
});
