"use client";

/** year-view — twelve mini-months heat-mapped from per-day loads (`lib/year-grid`). */

import type React from "react";
import { memo, useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  addDays,
  parseInstant,
  startOfLocalDay,
  toDateOnlyString,
  type ViewDescriptor,
} from "../lib/calendar-types";
import { formatDate } from "../lib/date-format";
import { fullDate } from "../lib/event-text";
import { rovingTarget } from "../lib/roving";
import { EASE_OUT, ms, prefersReducedMotion } from "../lib/springs";
import { cn } from "../lib/utils";
import {
  buildYearGrid,
  type DayLoad,
  DENSITY_LEVELS,
  densityFill,
  describeLoad,
  EMPTY_DAY,
  weekdayColumns,
  type YearMonth,
} from "../lib/year-grid";
import { Button } from "../ui/button";
import { FOCUS_RING } from "./cell-classes";
import { useKloqSettings } from "./settings-context";

const TILE_STAGGER_MS = 26;

const MONTH_LONG: Intl.DateTimeFormatOptions = { month: "long" };
const MONTH_YEAR: Intl.DateTimeFormatOptions = { month: "long", year: "numeric" };
const WEEKDAY_NARROW: Intl.DateTimeFormatOptions = { weekday: "narrow" };
const WEEKDAY_LONG: Intl.DateTimeFormatOptions = { weekday: "long" };

const DAY_BASE = cn(
  "relative flex aspect-square w-full cursor-pointer items-center justify-center rounded-xs text-3xs tabular-nums",
  // the 1px gutters between cells belong to the nearest day on touch
  "pointer-coarse:after:absolute pointer-coarse:after:-inset-px",
  "transition-[background-color,color,box-shadow] duration-150",
  FOCUS_RING,
);
const DAY_CLASS = `${DAY_BASE} text-foreground hover:ring-1 hover:ring-border`;
const TODAY_CLASS = `${DAY_BASE} bg-primary font-medium text-primary-foreground`;

const luminance = (r: number, g: number, b: number) => {
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};

const HEAT_INK = (bucket: number) => `--kloq-heat-ink-${bucket}`;

/**
 * A heat cell mixes `--foreground` into its own ground, so foreground text loses contrast as the
 * cell fills — below 4.5:1 in low-contrast themes. This measures each step's painted fill and,
 * where the theme's text no longer clears it, hands the cell black or white instead: one of the
 * two always clears 4.5:1 on any colour.
 */
function useHeatInk(ref: React.RefObject<HTMLElement | null>, enabled: boolean) {
  useLayoutEffect(() => {
    const root = ref.current;
    if (!enabled || !root || typeof OffscreenCanvas === "undefined") return;
    const ctx = new OffscreenCanvas(1, 1).getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    const painted = (layers: string[]) => {
      ctx.clearRect(0, 0, 1, 1);
      for (const layer of layers) {
        ctx.fillStyle = layer;
        ctx.fillRect(0, 0, 1, 1);
      }
      const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
      return luminance(r, g, b);
    };
    const probe = document.createElement("span");
    probe.hidden = true;
    root.appendChild(probe);

    const measure = () => {
      const ground: string[] = [];
      for (let n: HTMLElement | null = root; n; n = n.parentElement)
        ground.unshift(getComputedStyle(n).backgroundColor);
      const text = painted([...ground, getComputedStyle(root).color]);
      for (let bucket = 1; bucket <= DENSITY_LEVELS; bucket++) {
        probe.style.backgroundColor = densityFill(bucket as 1 | 2 | 3 | 4);
        const fill = painted([...ground, getComputedStyle(probe).backgroundColor]);
        const ratio = (Math.max(text, fill) + 0.05) / (Math.min(text, fill) + 0.05);
        if (ratio >= 4.5) root.style.removeProperty(HEAT_INK(bucket));
        else
          root.style.setProperty(
            HEAT_INK(bucket),
            fill > 0.179 ? "var(--color-black)" : "var(--color-white)",
          );
      }
    };
    measure();

    // a theme or scheme swap repaints the fills
    const mo = new MutationObserver(measure);
    const watch = { attributes: true, attributeFilter: ["class", "data-kloq-theme"] };
    mo.observe(document.documentElement, watch);
    const scope = root.closest("[data-kloq-root]");
    if (scope) mo.observe(scope, watch);
    return () => {
      mo.disconnect();
      probe.remove();
    };
  }, [ref, enabled]);
}

export interface YearViewProps {
  view: ViewDescriptor;
  weekStartsOn: number;
  density: ReadonlyMap<string, DayLoad>;
  onOpenDay: (date: Date) => void;
  onOpenMonth: (month: Date) => void;
}

interface WeekdayName {
  short: string;
  long: string;
}

export function YearView({ view, weekStartsOn, density, onOpenDay, onOpenMonth }: YearViewProps) {
  const g = useKloqSettings();
  const year = view.year?.getFullYear() ?? view.days[0]?.getFullYear();
  const rootRef = useRef<HTMLDivElement>(null);
  const nodes = useRef(new Map<string, HTMLButtonElement>()).current;

  const months = useMemo(
    () => (year === undefined ? [] : buildYearGrid(year, weekStartsOn)),
    [year, weekStartsOn],
  );
  const weekdayNames = useMemo<WeekdayName[]>(
    () =>
      weekdayColumns(weekStartsOn).map((d) => ({
        short: formatDate(d, g.locale, WEEKDAY_NARROW),
        long: formatDate(d, g.locale, WEEKDAY_LONG),
      })),
    [weekStartsOn, g.locale],
  );

  const order = useMemo(() => view.days.map(toDateOnlyString), [view.days]);
  const todayKey = view.todayIndex >= 0 ? order[view.todayIndex] : undefined;
  const todayMonth = view.todayIndex >= 0 ? view.days[view.todayIndex].getMonth() : -1;
  const [lead, setLead] = useState<string | null>(null);
  const roving = rovingTarget(order, lead ?? todayKey ?? null);
  // "YYYY-MM-DD": the month a key belongs to, without parsing a date
  const rovingMonth = roving ? Number(roving.slice(5, 7)) - 1 : -1;

  const focusDay = useCallback(
    (key: string) => {
      setLead(key);
      nodes.get(key)?.focus();
    },
    [nodes],
  );

  const registerNode = useCallback(
    (key: string, node: HTMLButtonElement | null) => {
      if (node) nodes.set(key, node);
      else nodes.delete(key);
    },
    [nodes],
  );

  // `preventDefault()` also tells the document-level keyboard layer to yield
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      const from = (e.target as HTMLElement | null)?.dataset?.yearDay;
      if (!from) return;
      // `parseInstant` reads a date-only string as local midnight; `new Date()` would read UTC
      const at = parseInstant(from);
      if (Number.isNaN(at)) return;
      const cur = startOfLocalDay(new Date(at));

      let next: Date | null = null;
      switch (e.key) {
        case "ArrowLeft":
          next = addDays(cur, -1);
          break;
        case "ArrowRight":
          next = addDays(cur, 1);
          break;
        case "ArrowUp":
          next = addDays(cur, -7);
          break;
        case "ArrowDown":
          next = addDays(cur, 7);
          break;
        case "Home":
          next = new Date(cur.getFullYear(), cur.getMonth(), 1);
          break;
        case "End":
          next = new Date(cur.getFullYear(), cur.getMonth() + 1, 0);
          break;
        case "PageUp":
          next = new Date(cur.getFullYear(), cur.getMonth() - 1, 1);
          break;
        case "PageDown":
          next = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
          break;
        default:
          return;
      }
      // off the end of the year is a dead end, not a year step
      e.preventDefault();
      const key = toDateOnlyString(next);
      if (nodes.has(key)) focusDay(key);
    },
    [focusDay, nodes],
  );

  // the view-morph FLIP needs `[data-cal-event]`, which a year has none of — tiles animate themselves
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || prefersReducedMotion()) return;
    const tiles = root.querySelectorAll<HTMLElement>("[data-year-month]");
    tiles.forEach((tile, i) =>
      tile.animate(
        [
          { opacity: 0, transform: "translateY(4px)" },
          { opacity: 1, transform: "none" },
        ],
        {
          duration: ms(220),
          delay: i * TILE_STAGGER_MS,
          easing: EASE_OUT,
          fill: "backwards",
        },
      ),
    );
  }, [year]);

  useHeatInk(rootRef, year !== undefined);

  if (year === undefined) return null;

  return (
    <div
      ref={rootRef}
      className="@container flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto"
      onKeyDown={onKeyDown}
    >
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 p-3 @md:gap-4 @md:p-4">
        <div className="grid grid-cols-1 gap-3 @[22rem]:grid-cols-2 @md:gap-4 @xl:grid-cols-3 @4xl:grid-cols-4">
          {months.map((m) => (
            <YearMonthTile
              key={m.index}
              month={m}
              density={density}
              weekdayNames={weekdayNames}
              current={m.index === todayMonth}
              todayKey={m.index === todayMonth ? todayKey : undefined}
              roving={m.index === rovingMonth ? roving : null}
              locale={g.locale}
              registerNode={registerNode}
              onOpenDay={onOpenDay}
              onOpenMonth={onOpenMonth}
              onFocusDay={setLead}
            />
          ))}
        </div>
        <DensityLegend />
      </div>
    </div>
  );
}

interface YearMonthTileProps {
  month: YearMonth;
  density: ReadonlyMap<string, DayLoad>;
  weekdayNames: WeekdayName[];
  current: boolean;
  todayKey: string | undefined;
  roving: string | null;
  locale?: string;
  registerNode: (key: string, node: HTMLButtonElement | null) => void;
  onOpenDay: (date: Date) => void;
  onOpenMonth: (month: Date) => void;
  onFocusDay: (key: string) => void;
}

// memoised so an arrow key re-renders the one or two months it touches
const YearMonthTile = memo(function YearMonthTile({
  month: m,
  density,
  weekdayNames,
  current,
  todayKey,
  roving,
  locale,
  registerNode,
  onOpenDay,
  onOpenMonth,
  onFocusDay,
}: YearMonthTileProps) {
  const label = formatDate(m.first, locale, MONTH_YEAR);
  return (
    <section data-year-month={m.index} aria-label={label} className="flex min-w-0 flex-col gap-1">
      <Button
        variant="ghost"
        size="xs"
        onClick={() => onOpenMonth(m.first)}
        aria-label={`Open ${label}`}
        className={cn("-mx-1 self-start", !current && "text-muted-foreground")}
      >
        {formatDate(m.first, locale, MONTH_LONG)}
      </Button>

      <div role="grid" aria-label={label} className="min-w-0">
        <div role="row" className="grid grid-cols-7">
          {weekdayNames.map((n, i) => (
            <div
              key={i}
              role="columnheader"
              aria-label={n.long}
              className="pb-0.5 text-center text-3xs text-muted-foreground"
            >
              <span aria-hidden>{n.short}</span>
            </div>
          ))}
        </div>

        {m.weeks.map((week, w) => (
          <div key={w} role="row" className="grid grid-cols-7">
            {week.map((date, c) => {
              if (date === null) return <div key={c} role="gridcell" aria-hidden />;
              const key = toDateOnlyString(date);
              return (
                <YearDay
                  key={c}
                  date={date}
                  dayKey={key}
                  load={density.get(key) ?? EMPTY_DAY}
                  isToday={key === todayKey}
                  tabbable={key === roving}
                  locale={locale}
                  registerNode={registerNode}
                  onOpenDay={onOpenDay}
                  onFocusDay={onFocusDay}
                />
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
});

interface YearDayProps {
  date: Date;
  dayKey: string;
  load: DayLoad;
  isToday: boolean;
  tabbable: boolean;
  locale?: string;
  registerNode: (key: string, node: HTMLButtonElement | null) => void;
  onOpenDay: (date: Date) => void;
  onFocusDay: (key: string) => void;
}

const YearDay = memo(function YearDay({
  date,
  dayKey,
  load,
  isToday,
  tabbable,
  locale,
  registerNode,
  onOpenDay,
  onFocusDay,
}: YearDayProps) {
  return (
    <div role="gridcell" className="min-w-0 p-px">
      <button
        type="button"
        data-year-day={dayKey}
        ref={(node) => registerNode(dayKey, node)}
        tabIndex={tabbable ? 0 : -1}
        aria-current={isToday ? "date" : undefined}
        // the count is read aloud; the colour wash is never the only channel
        aria-label={`${fullDate(date, locale)}, ${describeLoad(load)}`}
        onFocus={() => onFocusDay(dayKey)}
        onClick={() => onOpenDay(date)}
        className={isToday ? TODAY_CLASS : DAY_CLASS}
        style={
          isToday
            ? undefined
            : load.bucket === 0
              ? undefined
              : {
                  backgroundColor: densityFill(load.bucket),
                  color: `var(${HEAT_INK(load.bucket)}, var(--foreground))`,
                }
        }
      >
        {date.getDate()}
      </button>
    </div>
  );
});

// `aria-hidden`: the legend decodes a colour; screen readers get the real count per cell
function DensityLegend() {
  return (
    <div
      aria-hidden
      className="flex items-center justify-end gap-1.5 text-3xs text-muted-foreground"
    >
      <span>Less</span>
      {Array.from({ length: DENSITY_LEVELS + 1 }, (_, i) => (
        <span
          key={i}
          className="size-2.5 rounded-xs ring-1 ring-border"
          style={{
            backgroundColor: densityFill(i as 0 | 1 | 2 | 3 | 4),
          }}
        />
      ))}
      <span>More</span>
    </div>
  );
}
