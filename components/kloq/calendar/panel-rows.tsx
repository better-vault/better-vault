import type { ReactNode, Ref } from "react";
import { EASE_OUT, prefersReducedMotion } from "../lib/springs";
import { cn } from "../lib/utils";

// field chrome only appears on hover/focus
export const GHOST_FIELD = cn(
  "border-transparent bg-transparent shadow-none before:hidden dark:bg-transparent",
  "transition-[background-color,border-color] duration-(--overlay-enter)",
  "hover:border-input hover:bg-background dark:hover:bg-input/32",
  "has-[input:focus-visible,textarea:focus-visible]:border-input",
  "has-[input:focus-visible,textarea:focus-visible]:bg-background",
  "dark:has-[input:focus-visible,textarea:focus-visible]:bg-input/32",
);

/** One line of a property row: every control and label in the panel sits on this height. */
export const ROW_H = "h-7 sm:h-6";

/** A popup trigger dressed like a ghost field, the same size and type as an `xs` input. */
export const GHOST_TRIGGER = cn(
  ROW_H,
  "group flex w-full cursor-pointer items-center gap-2 rounded-md border border-transparent bg-transparent",
  "px-[calc(--spacing(2)-1px)] text-left text-sm outline-none ring-ring/24 sm:text-xs",
  "transition-[background-color,border-color,box-shadow] duration-(--overlay-enter)",
  "hover:border-input hover:bg-background dark:hover:bg-input/32",
  "focus-visible:border-ring focus-visible:ring-[3px] data-popup-open:border-input data-popup-open:bg-background dark:data-popup-open:bg-input/32",
);

export function revealRow(el: HTMLElement | null) {
  if (!el || prefersReducedMotion() || el.dataset.revealed !== undefined) return;
  el.dataset.revealed = "";
  el.animate(
    [
      { opacity: 0, transform: "translateY(-4px)" },
      { opacity: 1, transform: "none" },
    ],
    { duration: 150, easing: EASE_OUT },
  );
}

export function PropertyRow({
  label,
  rowRef,
  children,
}: {
  label: string;
  rowRef?: Ref<HTMLDivElement>;
  children: ReactNode;
}) {
  return (
    <div ref={rowRef} className="flex items-start gap-1">
      <span
        className={cn(
          ROW_H,
          "flex w-16 shrink-0 items-center ps-2.5 text-2xs text-muted-foreground",
        )}
      >
        {label}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

/** Static value in a property row, aligned with the editable controls. */
export function RowValue({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        ROW_H,
        "flex items-center gap-2 px-2 text-sm text-foreground sm:text-xs",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function ReadOnlyRow({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 px-0.5 text-sm text-foreground">
      <span aria-hidden className="mt-0.5 shrink-0 text-muted-foreground [&_svg]:size-4">
        {icon}
      </span>
      <span className="min-w-0 flex-1 break-words">{children}</span>
    </div>
  );
}

/** The small uppercase heading that splits an overlay into sections. */
export function SectionLabel({
  as: Tag = "div",
  className,
  children,
}: {
  as?: "div" | "h3";
  className?: string;
  children: ReactNode;
}) {
  return (
    <Tag
      className={cn("font-medium text-muted-foreground text-xs uppercase tracking-wide", className)}
    >
      {children}
    </Tag>
  );
}
