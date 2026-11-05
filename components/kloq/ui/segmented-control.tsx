"use client";

import { Radio as RadioPrimitive } from "@base-ui/react/radio";
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group";
import * as React from "react";
import {
  type SegmentedControlSize,
  segmentedControlItemVariants,
  segmentedControlRootClassName,
} from "../lib/segmented-control";
import { cn } from "../lib/utils";

const SegmentedControlContext: React.Context<{
  size: SegmentedControlSize;
  fill: boolean;
}> = React.createContext<{ size: SegmentedControlSize; fill: boolean }>({
  size: "default",
  fill: false,
});

/** One-of-many choice: a radio group dressed with the coss segmented-control recipe. */
export function SegmentedControl<Value>({
  className,
  size = "default",
  fill = false,
  ...props
}: RadioGroupPrimitive.Props<Value> & {
  size?: SegmentedControlSize;
  /** Take the full width and give every item an equal share; labels truncate. */
  fill?: boolean;
}): React.ReactElement {
  return (
    <SegmentedControlContext.Provider value={{ size, fill }}>
      <RadioGroupPrimitive
        className={cn(segmentedControlRootClassName, "font-sans", fill && "w-full", className)}
        data-fill={fill || undefined}
        data-size={size}
        data-slot="segmented-control"
        {...props}
      />
    </SegmentedControlContext.Provider>
  );
}

export function SegmentedControlItem<Value>({
  className,
  children,
  ...props
}: RadioPrimitive.Root.Props<Value>): React.ReactElement {
  const { size, fill } = React.useContext(SegmentedControlContext);
  return (
    <RadioPrimitive.Root
      className={cn(
        segmentedControlItemVariants({ size, state: "checked" }),
        "grow",
        "after:absolute after:inset-x-0 after:top-1/2 after:h-full after:min-h-6 after:-translate-y-1/2 pointer-coarse:after:min-h-11",
        fill && "min-w-0 flex-1 basis-0 px-1",
        className,
      )}
      data-slot="segmented-control-item"
      {...props}
    >
      {fill ? <span className="min-w-0 truncate">{children}</span> : children}
    </RadioPrimitive.Root>
  );
}
