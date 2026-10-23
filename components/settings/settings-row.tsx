"use client";

import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import type { ReactNode } from "react";
import { Icon, type IconSvgElement } from "@/components/icon";
import { Sheet } from "@/components/panelui/sheet";

interface SettingsRowProps {
  /** The `Sheet.Next` it opens. */
  to: string;
  payload?: unknown;
  icon: IconSvgElement;
  label: ReactNode;
  hint?: ReactNode;
  /** Shown at the end, before the chevron. */
  end?: ReactNode;
}

/** A row in a settings sheet that opens the next sheet. */
export function SettingsRow({ to, payload, icon, label, hint, end }: SettingsRowProps) {
  return (
    <Sheet.Trigger
      to={to}
      payload={payload}
      render={
        <button
          type="button"
          className="flex w-full cursor-pointer items-center gap-3 rounded-2xl px-2.5 py-2.5 text-start outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
        />
      }
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground">
        <Icon icon={icon} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{label}</span>
        {hint ? <span className="block truncate text-xs text-muted-foreground">{hint}</span> : null}
      </span>
      {end}
      <Icon icon={ArrowRight01Icon} size={16} className="shrink-0 text-muted-foreground rtl:rotate-180" />
    </Sheet.Trigger>
  );
}
