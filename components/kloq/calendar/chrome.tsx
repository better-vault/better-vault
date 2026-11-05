"use client";

/** Chrome — the app bar as composable parts; must render inside `<Kloq>`. */

import { RotateCcw } from "@/components/kloq/lib/icons";
import { createContext, type ReactNode, useContext } from "react";
import type { KloqView, ViewDescriptor } from "../lib/calendar-types";
import type { Keymap } from "../lib/keymap";
import type { StepDirection } from "../lib/navigation";
import { cn } from "../lib/utils";
import { Button } from "../ui/button";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { CalendarNav } from "./nav";
import { useKloqSettings } from "./settings-context";

export interface KloqChrome {
  /** the resolved EFFECTIVE view (a narrow box may force day view) */
  view: ViewDescriptor;
  /** the effective view SETTING (`"week"`, `3`, `"month"`…), not the shape */
  viewSetting: KloqView;
  /** true when a narrow box is overriding the consumer's view */
  collapsed?: boolean;
  /** true below the narrow breakpoint (phone width); `undefined` until the box has been measured */
  narrow?: boolean;
  /**
   * False on the server and during hydration when the calendar was given no `date`/`defaultDate`
   * plus `locale` to render from: `date` and `view` are placeholders until it turns true.
   */
  ready?: boolean;
  /** true when the host passed `lanes`, so a Timeline view exists to switch to */
  timeline?: boolean;
  /** whether a view fits the box at its current width */
  fits?: (view: KloqView) => boolean;
  /** anchor date the view is resolved around */
  date: Date;
  /** true when today is inside the visible range */
  atToday: boolean;
  /** direction of the last range step, for directional animation */
  lastStep: StepDirection | null;
  /** step the range by one of the current view's units */
  step: (dir: StepDirection) => void;
  /** move the range back onto today */
  goToday: () => void;
  /** request a view change (reports through `onViewChange`) */
  switchView: (view: KloqView) => void;
  /** move the anchor date and switch to the day view */
  jumpToDay: (date: Date) => void;
  /** move the anchor date, leaving the view alone */
  goToDate: (date: Date) => void;
  reset: () => void;
  /** toggle ⌘K; a no-op under `commandPalette: false` */
  openCommand: () => void;
  openShortcuts: () => void;
  /** keymap overrides, so advertised keys show the live binding */
  keymap?: Keymap;
}

const ChromeContext = createContext<KloqChrome | null>(null);

export const ChromeProvider = ChromeContext.Provider;

/** The calendar's live view state and navigation actions. Throws outside `<Kloq>`. */
export function useKloq(): KloqChrome {
  const chrome = useContext(ChromeContext);
  if (!chrome) throw new Error("useKloq must be used inside <Kloq> (as a child of it)");
  return chrome;
}

export interface KloqToolbarProps {
  /** the bar's contents; omit for the default nav-left / Reset-right layout */
  children?: ReactNode;
  className?: string;
}

/** A bordered app-bar row above the calendar surface. Pure layout. */
export function KloqToolbar({ children, className }: KloqToolbarProps) {
  return (
    <header
      className={cn(
        // `flex-wrap` is the toolbar's only responsiveness: nav and controls stack when narrow
        "@container flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b px-4 py-2.5",
        className,
      )}
    >
      {children ?? (
        <>
          <KloqNav />
          <KloqReset />
        </>
      )}
    </header>
  );
}

export function KloqNav({ className }: { className?: string }) {
  const k = useKloq();
  const { locale } = useKloqSettings();
  return (
    <CalendarNav
      className={className}
      view={k.view}
      viewSetting={k.viewSetting}
      onStep={k.step}
      onToday={k.goToday}
      onSwitchView={k.switchView}
      atToday={k.atToday}
      date={k.date}
      onGoToDate={k.goToDate}
      lastStep={k.lastStep}
      collapsed={k.collapsed}
      narrow={k.narrow}
      ready={k.ready}
      locale={locale}
      timeline={k.timeline}
      fits={k.fits}
      keymap={k.keymap}
    />
  );
}

export function KloqReset({ className }: { className?: string }) {
  const k = useKloq();
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="xs"
            className={cn("shrink-0 text-muted-foreground", className)}
            onClick={k.reset}
          >
            <RotateCcw />
            {/* phone width: the icon alone, so the title keeps its room */}
            <span
              className={
                k.narrow === true
                  ? "sr-only"
                  : k.narrow === undefined
                    ? "@max-[40rem]:sr-only"
                    : undefined
              }
            >
              Reset
            </span>
          </Button>
        }
      />
      <TooltipPopup>Restore sample events</TooltipPopup>
    </Tooltip>
  );
}
