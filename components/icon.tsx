import { HugeiconsIcon, type HugeiconsIconProps, type IconSvgElement } from "@hugeicons/react";

export type { IconSvgElement };

/** A Hugeicons icon with the app's default size and stroke. */
export function Icon({ size = 18, strokeWidth = 1.8, ...props }: HugeiconsIconProps) {
  return <HugeiconsIcon aria-hidden size={size} strokeWidth={strokeWidth} {...props} />;
}
