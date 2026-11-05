"use client";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import type React from "react";
import { cn } from "../lib/utils";

export function Label({
  className,
  size = "default",
  render,
  ...props
}: useRender.ComponentProps<"label"> & {
  size?: "default" | "sm";
}): React.ReactElement {
  const defaultProps = {
    className: cn(
      "inline-flex items-center gap-2 font-medium font-sans text-base/4.5 text-foreground sm:text-sm/4",
      size === "sm" && "gap-1.5 text-xs/4 sm:text-xs/4",
      className,
    ),
    "data-size": size,
    "data-slot": "label",
  };

  return useRender({
    defaultTagName: "label",
    props: mergeProps<"label">(defaultProps, props),
    render,
  });
}
