"use client";

import type { ComponentProps, ReactNode } from "react";
import { Button } from "@/components/panelui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * In a Panel button track, flat buttons rise out of it under the pointer; a
 * pressed one stays raised, like the chosen segment of a segmented control.
 * The track's own rules are specific, hence `!`.
 */
export const pressedClass =
  "aria-pressed:bg-background! aria-pressed:text-foreground! aria-pressed:shadow-sm! dark:aria-pressed:bg-input!";

/** An icon button with a tooltip naming it (and its key). */
export function BoardButton({
  label,
  hint,
  pressed,
  className,
  children,
  side = "bottom",
  ...props
}: Omit<ComponentProps<typeof Button>, "aria-label"> & {
  label: string;
  /** The tooltip, when it says more than the label. */
  hint?: string;
  pressed?: boolean;
  children: ReactNode;
  side?: "top" | "bottom" | "left" | "right";
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={label}
            aria-pressed={pressed}
            className={cn(pressedClass, className)}
            {...props}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent side={side}>{hint ?? label}</TooltipContent>
    </Tooltip>
  );
}
