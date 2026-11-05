"use client";

import { Slider as SliderPrimitive } from "@base-ui/react/slider";
import * as React from "react";
import { cn } from "../lib/utils";

export function Slider({
  className,
  children,
  defaultValue,
  value,
  min = 0,
  max = 100,
  size = "default",
  ...props
}: SliderPrimitive.Root.Props & {
  /** `sm` lowers the minimum track length from 11rem to 4rem, for inline use. */
  size?: "default" | "sm";
}): React.ReactElement {
  const _values = React.useMemo(() => {
    if (value !== undefined) {
      return Array.isArray(value) ? value : [value];
    }
    if (defaultValue !== undefined) {
      return Array.isArray(defaultValue) ? defaultValue : [defaultValue];
    }
    return [min];
  }, [value, defaultValue, min]);

  return (
    <SliderPrimitive.Root
      className={cn("data-[orientation=horizontal]:w-full", className)}
      defaultValue={defaultValue}
      max={max}
      min={min}
      thumbAlignment="edge"
      value={value}
      {...props}
    >
      {children}
      <SliderPrimitive.Control
        className={cn(
          "flex touch-none select-none data-disabled:pointer-events-none data-[orientation=vertical]:h-full data-[orientation=horizontal]:w-full data-[orientation=vertical]:flex-col data-disabled:opacity-64",
          size === "sm"
            ? "data-[orientation=vertical]:min-h-16 data-[orientation=horizontal]:min-w-16"
            : "data-[orientation=vertical]:min-h-44 data-[orientation=horizontal]:min-w-44",
        )}
        data-size={size}
        data-slot="slider-control"
      >
        <SliderPrimitive.Track
          className="relative grow select-none before:absolute before:rounded-full before:bg-input data-[orientation=horizontal]:h-1 data-[orientation=vertical]:h-full data-[orientation=horizontal]:w-full data-[orientation=vertical]:w-1 data-[orientation=horizontal]:before:inset-x-0.5 data-[orientation=vertical]:before:inset-x-0 data-[orientation=horizontal]:before:inset-y-0 data-[orientation=vertical]:before:inset-y-0.5"
          data-slot="slider-track"
        >
          <SliderPrimitive.Indicator
            className="select-none rounded-full bg-primary data-[orientation=horizontal]:ms-0.5 data-[orientation=vertical]:mb-0.5"
            data-slot="slider-indicator"
          />
          {Array.from({ length: _values.length }, (_, index) => (
            <SliderPrimitive.Thumb
              className="block size-5 shrink-0 select-none rounded-full border border-input bg-white not-dark:bg-clip-padding shadow-(--shadow-xs) outline-none transition-[box-shadow,scale] before:absolute before:inset-0 before:rounded-full before:shadow-[0_1px_--theme(--color-black/4%)] after:absolute after:top-1/2 after:start-1/2 after:size-6 after:-translate-x-1/2 rtl:after:translate-x-1/2 after:-translate-y-1/2 pointer-coarse:after:size-11 has-focus-visible:ring-[3px] has-focus-visible:ring-ring/24 data-dragging:scale-120 sm:size-4 dark:border-background dark:has-focus-visible:ring-ring/48 [:has(*:focus-visible),[data-dragging]]:shadow-none"
              data-slot="slider-thumb"
              index={index}
              key={String(index)}
            />
          ))}
        </SliderPrimitive.Track>
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  );
}

export function SliderValue({
  className,
  ...props
}: SliderPrimitive.Value.Props): React.ReactElement {
  return (
    <SliderPrimitive.Value
      className={cn("flex justify-end text-sm", className)}
      data-slot="slider-value"
      {...props}
    />
  );
}

export { SliderPrimitive };
