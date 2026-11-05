"use client";

/** nav — the range control: ‹ › Today, the range title, and the view switcher. */

import { ChevronDown, ChevronLeft, ChevronRight } from "@/components/kloq/lib/icons";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { KloqView, ViewDescriptor } from "../lib/calendar-types";
import { formatDate } from "../lib/date-format";
import { displayKey, type KeyActionId, type Keymap, resolveKeymap } from "../lib/keymap";
import { formatViewTitle, type StepDirection, stepLabel } from "../lib/navigation";
import { isNarrowSafe } from "../lib/responsive";
import { EASE_OUT, ms, prefersReducedMotion } from "../lib/springs";
import { cn } from "../lib/utils";
import { Button } from "../ui/button";
import { Kbd } from "../ui/kbd";
import { Menu, MenuPopup, MenuRadioGroup, MenuRadioItem, MenuTrigger } from "../ui/menu";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { MonthYearPicker } from "./month-year-picker";

interface ViewOption {
  key: KloqView;
  label: string;
  action?: KeyActionId;
}

/** The switcher's presets. Any `number` 2–14 is still a valid `view` prop. */
export const VIEW_OPTIONS: ViewOption[] = [
  { key: "day", label: "Day", action: "view-day" },
  { key: 3, label: "3 days", action: "view-3days" },
  { key: "week", label: "Week", action: "view-week" },
  { key: "month", label: "Month", action: "view-month" },
  { key: "year", label: "Year", action: "view-year" },
  { key: "agenda", label: "Schedule", action: "view-agenda" },
];

const TIMELINE_OPTION: ViewOption = { key: "timeline", label: "Timeline" };

// the box of a `Button size="xs"`, for measuring a title before it is shown
const TITLE_METRICS =
  "whitespace-nowrap border px-[calc(--spacing(2)-1px)] text-sm font-medium sm:text-xs";

const MONTH_DAY: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
const MONTH: Intl.DateTimeFormatOptions = { month: "short" };

/** The range title in every length it comes in, longest first: full, short, and month-only. */
function titleForms(view: ViewDescriptor, locale?: string): string[] {
  const long = formatViewTitle(view, locale);
  const short = formatViewTitle(view, locale, { short: true });
  const l = locale ?? "en-US";
  const first = view.days[0];
  const last = view.days[view.days.length - 1];
  let compact = short;
  if (view.kind !== "year" && first && last) {
    if (view.days.length === 1) compact = formatDate(first, l, MONTH_DAY);
    else if (view.kind === "month" && view.month) compact = formatDate(view.month, l, MONTH);
    else {
      const a = formatDate(first, l, MONTH);
      const b = formatDate(last, l, MONTH);
      compact = a === b ? a : `${a}–${b}`;
    }
  }
  return [...new Set([long, short, compact])];
}

interface CalendarNavProps {
  /** the EFFECTIVE view descriptor — what is on screen, not what was asked for */
  view: ViewDescriptor;
  /** the EFFECTIVE view setting — `"day"` when a narrow box forced it */
  viewSetting: KloqView;
  /** the view is forced narrow; multi-column presets show disabled */
  collapsed?: boolean;
  /** which views fit the box right now; falls back to `isNarrowSafe` when absent */
  fits?: (view: KloqView) => boolean;
  /** the box is phone-width: short title, no standalone Today; `undefined` = not measured yet, CSS decides */
  narrow?: boolean;
  /** false while the calendar has no date to print (server + hydration pass of an undated calendar) */
  ready?: boolean;
  /** the calendar's locale, for the title */
  locale?: string;
  /** the host passed `lanes`: offer the Timeline view */
  timeline?: boolean;
  /** step the range by one of the current view's units */
  onStep: (dir: StepDirection) => void;
  /** jump the range back onto today */
  onToday: () => void;
  onSwitchView: (view: KloqView) => void;
  /** true when today is already inside the visible range */
  atToday: boolean;
  /** the anchor date, for the title's month/year picker */
  date: Date;
  /** move the anchor without changing the view */
  onGoToDate: (date: Date) => void;
  /** the direction of the last step, for the title's slide */
  lastStep?: StepDirection | null;
  /** keymap overrides — the switcher hints and Today tooltip resolve here */
  keymap?: Keymap;
  className?: string;
}

export function CalendarNav({
  view,
  viewSetting,
  onStep,
  onToday,
  onSwitchView,
  atToday,
  date,
  onGoToDate,
  lastStep,
  collapsed = false,
  fits,
  narrow,
  ready = true,
  locale,
  timeline = false,
  keymap,
  className,
}: CalendarNavProps) {
  const resolvedKeys = useMemo(() => resolveKeymap(keymap), [keymap]);
  const todayKey = resolvedKeys.byAction["today"];
  // longest first; the slot shows the longest one it has room for
  const forms = useMemo(() => (ready ? titleForms(view, locale) : []), [ready, view, locale]);
  const [fit, setFit] = useState(0);
  const title = forms[Math.min(fit, forms.length - 1)] ?? "";
  // before the box is measured a container query stands in for `narrow`
  const unmeasured = narrow === undefined;
  const options =
    timeline || viewSetting === "timeline" ? [...VIEW_OPTIONS, TIMELINE_OPTION] : VIEW_OPTIONS;
  const viewLabel =
    typeof viewSetting === "number"
      ? `${viewSetting} days`
      : (options.find((o) => o.key === viewSetting)?.label ?? "Week");
  const titleRef = useRef<HTMLSpanElement>(null);
  const lastTitle = useRef(title);

  // a shorter date before an ellipsis: measure every form against the slot, before paint
  useLayoutEffect(() => {
    const slot = titleRef.current;
    if (!slot || typeof ResizeObserver === "undefined") return;
    const choose = () => {
      const room = slot.clientWidth;
      const widths = Array.from(
        slot.querySelectorAll<HTMLElement>("[data-title-form]"),
        (el) => el.offsetWidth,
      );
      if (!widths.length) return;
      const next = widths.findIndex((w) => w <= room);
      setFit(next < 0 ? widths.length - 1 : next);
    };
    choose();
    const ro = new ResizeObserver(choose);
    ro.observe(slot);
    return () => ro.disconnect();
  }, [forms]);

  // slide the title the way the range moved; keyed on text so re-renders don't re-animate
  useLayoutEffect(() => {
    const node = titleRef.current;
    if (!node) return;
    if (lastTitle.current === title) return;
    lastTitle.current = title;
    if (prefersReducedMotion() || !lastStep) return;
    const dx = lastStep * 8;
    node.animate(
      [
        { transform: `translateX(${dx}px)`, opacity: 0 },
        { transform: "none", opacity: 1 },
      ],
      { duration: ms(200), easing: EASE_OUT },
    );
  }, [title, lastStep]);

  return (
    // steppers lead and the title takes the slack, so nothing before the title ever moves.
    // No `min-w-0`: the nav keeps its own minimum, and a host toolbar wraps around it instead
    <div className={cn("flex flex-auto items-center gap-2", className)}>
      <div className="flex shrink-0 items-center">
        <StepButton
          dir={-1}
          view={viewSetting}
          onStep={onStep}
          hint={resolvedKeys.byAction["prev-period"]}
        />
        <StepButton
          dir={1}
          view={viewSetting}
          onStep={onStep}
          hint={resolvedKeys.byAction["next-period"]}
        />
      </div>

      {/* phone width: Today lives in the title's popover */}
      {narrow === true ? null : (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="xs"
                // not disabled at today: keeps a stable tab order
                className={cn(
                  atToday && "text-muted-foreground",
                  unmeasured && "@max-[40rem]:hidden",
                )}
                onClick={onToday}
              >
                Today
              </Button>
            }
          />
          <TooltipPopup>
            <span className="flex items-center gap-1.5">
              Jump to today {todayKey ? <Kbd>{displayKey(todayKey)}</Kbd> : null}
            </span>
          </TooltipPopup>
        </Tooltip>
      )}

      {/* a size container, so the title's text never props the nav open: the slot's floor is the
          short date in a wide box and the month-only one in a phone-width box */}
      <span
        ref={titleRef}
        className={cn(
          "@container relative flex flex-1",
          narrow === true ? "min-w-20" : "min-w-31",
          unmeasured && "@max-[40rem]:min-w-20",
        )}
      >
        {ready ? (
          <>
            <MonthYearPicker date={date} label={title} onPick={onGoToDate} locale={locale} />
            <span aria-hidden className="pointer-events-none invisible absolute top-0 start-0 flex">
              {forms.map((form) => (
                <span key={form} data-title-form className={TITLE_METRICS}>
                  {form}
                </span>
              ))}
            </span>
          </>
        ) : null}
      </span>

      {/* the label leads with the visible view name — a labelled widget whose
          visible text isn't part of its accessible name breaks speech input */}
      <Menu>
        <MenuTrigger
          aria-label={`${viewLabel}, calendar view`}
          render={
            <Button
              variant="outline"
              size="xs"
              className={cn(
                "shrink-0",
                narrow !== true && "w-24 justify-between",
                unmeasured && "@max-[40rem]:w-auto",
              )}
            />
          }
        >
          {viewLabel}
          <ChevronDown aria-hidden />
        </MenuTrigger>
        <MenuPopup align="end">
          <MenuRadioGroup
            value={typeof viewSetting === "number" ? 3 : viewSetting}
            onValueChange={(value) => onSwitchView(value as KloqView)}
          >
            {options.map((opt) => {
              // `isNarrowSafe` is the same predicate `effectiveView` collapses on
              const unavailable = fits ? !fits(opt.key) : collapsed && !isNarrowSafe(opt.key);
              const hint = opt.action ? resolvedKeys.byAction[opt.action] : null;
              return (
                <MenuRadioItem
                  key={String(opt.key)}
                  value={opt.key}
                  disabled={unavailable}
                  closeOnClick
                >
                  <span className="flex items-center gap-3">
                    <span className="flex-1">
                      {typeof viewSetting === "number" && typeof opt.key === "number"
                        ? `${viewSetting} days`
                        : opt.label}
                    </span>
                    {unavailable ? (
                      <span className="text-xs text-muted-foreground">too narrow</span>
                    ) : hint ? (
                      <Kbd>{displayKey(hint)}</Kbd>
                    ) : null}
                  </span>
                </MenuRadioItem>
              );
            })}
          </MenuRadioGroup>
        </MenuPopup>
      </Menu>
    </div>
  );
}

function StepButton({
  dir,
  view,
  onStep,
  hint,
}: {
  dir: StepDirection;
  view: KloqView;
  onStep: (dir: StepDirection) => void;
  hint?: string | null;
}) {
  const label = stepLabel(view, dir);
  const Icon = dir < 0 ? ChevronLeft : ChevronRight;

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={label}
            className="text-muted-foreground"
            onClick={(e) => {
              const icon = (e.currentTarget as HTMLElement).querySelector("svg");
              if (icon && !prefersReducedMotion())
                icon.animate(
                  [
                    { transform: "none" },
                    { transform: `translateX(${dir * 3}px)` },
                    { transform: "none" },
                  ],
                  { duration: ms(220), easing: EASE_OUT },
                );
              onStep(dir);
            }}
          >
            <Icon />
          </Button>
        }
      />
      <TooltipPopup>
        <span className="flex items-center gap-1.5">
          {label} <Kbd>{hint ? displayKey(hint) : dir < 0 ? "←" : "→"}</Kbd>
        </span>
      </TooltipPopup>
    </Tooltip>
  );
}
