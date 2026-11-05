"use client";

/** resource-gutter — the sticky left column naming each row. */

import { memo } from "react";
import type { Lane } from "../lib/lane";
import { cn } from "../lib/utils";

export interface ResourceGutterProps {
  lane: Lane;
  height: number;
  width: number;
  /** a squeezed gutter: the name wraps to two lines and the sublabel moves to the tooltip */
  narrow?: boolean;
}

export const ResourceGutter = memo(function ResourceGutter({
  lane,
  height,
  width,
  narrow = false,
}: ResourceGutterProps) {
  return (
    <div
      className={cn(
        "sticky start-0 z-50 flex shrink-0 flex-col justify-center gap-0.5 border-e border-b border-border bg-background",
        narrow ? "px-2" : "px-3",
      )}
      style={{ width, height }}
      title={lane.sublabel ? `${lane.label} · ${lane.sublabel}` : lane.label}
      data-slot="resource-gutter"
      data-narrow={narrow || undefined}
    >
      <span
        className={cn(
          "font-medium text-foreground",
          narrow ? "line-clamp-2 text-xs leading-tight wrap-anywhere" : "truncate text-sm",
        )}
      >
        {lane.label}
      </span>
      {lane.sublabel && !narrow ? (
        <span className="truncate text-xs text-muted-foreground">{lane.sublabel}</span>
      ) : null}
    </div>
  );
});
