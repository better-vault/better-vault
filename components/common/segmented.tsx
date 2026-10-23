"use client";

import type { ReactNode } from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

export interface SegmentedOption<Value extends string> {
  value: Value;
  label: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
  /** Shown on hover, e.g. why an option is disabled. */
  title?: string;
}

interface SegmentedProps<Value extends string> {
  value: Value;
  onValueChange: (value: Value) => void;
  options: readonly SegmentedOption<Value>[];
  "aria-label": string;
  size?: "sm" | "md";
  className?: string;
}

/** One choice out of a few, drawn like Panel's segmented tabs. */
export function Segmented<Value extends string>({
  value,
  onValueChange,
  options,
  size = "md",
  className,
  ...props
}: SegmentedProps<Value>) {
  return (
    <ToggleGroup
      value={[value]}
      onValueChange={(next: unknown[]) => {
        const chosen = next[0];
        if (typeof chosen === "string") onValueChange(chosen as Value);
      }}
      spacing={0}
      aria-label={props["aria-label"]}
      className={cn("gap-0.5 rounded-xl bg-muted p-1", size === "sm" && "rounded-full p-0.5", className)}
    >
      {options.map((option) => (
        <ToggleGroupItem
          key={option.value}
          value={option.value}
          disabled={option.disabled}
          title={option.title}
          className={cn(
            "gap-1.5 rounded-lg! border-0 px-3 font-medium text-muted-foreground hover:bg-transparent hover:text-foreground",
            "data-pressed:bg-background data-pressed:text-foreground data-pressed:shadow-sm data-pressed:ring-1 data-pressed:ring-foreground/[0.06]",
            "dark:data-pressed:bg-input dark:data-pressed:ring-foreground/10",
            size === "sm" && "h-7 rounded-full! px-2.5 text-[0.8125rem]",
          )}
        >
          {option.icon}
          {option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
