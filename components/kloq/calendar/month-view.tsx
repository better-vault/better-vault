"use client";

/** month-view — the 6×7 cell grid; `lib/month-grid` packs placements into per-cell rows. */

import type React from "react";
import { memo, useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  formatRange,
  type KloqView,
  type PlacedEvent,
  type TimeFormatOptions,
  type ViewDescriptor,
} from "../lib/calendar-types";
import { formatDate } from "../lib/date-format";
import type { CommitResult } from "../lib/drag-engine/types";
import {
  createJiggle,
  JIGGLE_REST,
  type JiggleState,
  jiggleTransform,
  liftOf,
  stepJiggle,
} from "../lib/drag-physics";
import { EVENT_COLORS, EVENT_TEXT_CSS } from "../lib/event-palette";
import { eventTitle, fullDate, plural } from "../lib/event-text";
import { hiddenOn, layoutMonth, type MonthChip, type MonthLayout } from "../lib/month-grid";
import { rovingTab } from "../lib/roving";
import { ms, prefersReducedMotion, SPRING, SPRING_MS } from "../lib/springs";
import { cn } from "../lib/utils";
import { ContextMenu, ContextMenuTrigger } from "../ui/context-menu";
import { CELL_HOVER, FOCUS_RING } from "./cell-classes";
import { type CalendarMenuTarget, EventContextMenu, GridContextMenu } from "./event-context-menu";
import { EventOverflow } from "./event-overflow";
import { useKloqSettings } from "./settings-context";
import { useCoarsePointer } from "./use-responsive";

// chip (18) + 2px gap; on touch the chip is the 24px minimum
const CHIP_H = 20;
const CHIP_H_TOUCH = 26;
const CELL_HEAD = 24;
// rows assumed before measurement, and on the server
const DEFAULT_SLOTS = 3;
const MONTH_NEW_EVENT_MIN = 9 * 60;

interface MonthViewProps {
  view: ViewDescriptor;
  events: PlacedEvent[];
  selectedId: string | null;
  registerNode: (id: string, node: HTMLElement | null) => void;
  onSelect: (id: string | null, opts?: { isNew?: boolean }) => void;
  onOpenDay: (date: Date) => void;
  /** phone width: dots per day instead of titled chips */
  compact?: boolean;
  viewSetting: KloqView;
  onSwitchView: (view: KloqView) => void;
  /** The one event carrying `tabIndex={0}` — see `lib/roving.ts`. */
  rovingId?: string | null;
  /** Drag a chip to another day; `dayDelta` is whole days. Omit and chips stay click-only. */
  onMoveByDays?: (id: string, dayDelta: number) => CommitResult;
}

const MONTH_YEAR: Intl.DateTimeFormatOptions = { month: "long", year: "numeric" };

const DAY_KEYS: Record<string, (day: number) => number> = {
  ArrowLeft: (d) => d - 1,
  ArrowRight: (d) => d + 1,
  ArrowUp: (d) => d - 7,
  ArrowDown: (d) => d + 7,
  Home: (d) => d - (d % 7),
  End: (d) => d - (d % 7) + 6,
};

export function MonthView({
  view,
  events,
  selectedId,
  registerNode,
  onSelect,
  onOpenDay,
  viewSetting,
  onSwitchView,
  rovingId,
  onMoveByDays,
  compact = false,
}: MonthViewProps) {
  const g = useKloqSettings();
  const gridRef = useRef<HTMLDivElement>(null);
  const [slots, setSlots] = useState(DEFAULT_SLOTS);
  const chipH = useCoarsePointer() ? CHIP_H_TOUCH : CHIP_H;

  // measure a real cell: it carries its own padding and border
  useLayoutEffect(() => {
    const grid = gridRef.current;
    if (!grid || typeof ResizeObserver === "undefined") return;
    const measure = () => {
      const cell = grid.querySelector<HTMLElement>("[data-month-day]");
      if (!cell) return;
      const room = cell.clientHeight - CELL_HEAD;
      setSlots(Math.max(1, Math.floor(room / chipH)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(grid);
    return () => ro.disconnect();
  }, [chipH]);

  const weeks = Math.max(1, Math.ceil(view.dayCount / 7));
  const layout = useMemo(
    () => layoutMonth(events, { dayCount: view.dayCount, slots }),
    [events, view.dayCount, slots],
  );
  const rows = useMemo(() => {
    const out = Array.from({ length: weeks }, () => ({
      chips: [] as MonthChip[],
      ids: new Set<string>(),
    }));
    for (const chip of layout.chips) {
      const row = out[chip.week];
      if (!row) continue;
      row.chips.push(chip);
      row.ids.add(chip.event.id);
    }
    return out;
  }, [layout, weeks]);

  const month = view.month?.getMonth();

  // one day button is in the tab order; arrows move it
  const [leadDay, setLeadDay] = useState<string | null>(null);
  const rovingDay = useMemo(() => {
    const at = leadDay === null ? -1 : view.days.findIndex((d) => d.toDateString() === leadDay);
    if (at >= 0) return at;
    if (view.todayIndex >= 0) return view.todayIndex;
    return Math.max(
      0,
      view.days.findIndex((d) => month === undefined || d.getMonth() === month),
    );
  }, [leadDay, view.days, view.todayIndex, month]);
  const onFocusDay = useCallback(
    (day: number) => setLeadDay(view.days[day]?.toDateString() ?? null),
    [view.days],
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      const from = (e.target as HTMLElement | null)?.dataset?.monthOpen;
      const move = DAY_KEYS[e.key];
      if (from === undefined || !move) return;
      // `preventDefault()` also tells the document-level keyboard layer to yield
      e.preventDefault();
      const next = move(Number(from));
      if (next < 0 || next >= view.dayCount) return;
      gridRef.current?.querySelector<HTMLElement>(`[data-month-open="${next}"]`)?.focus();
    },
    [view.dayCount],
  );

  const [target, setTarget] = useState<CalendarMenuTarget | null>(null);
  const pending = useRef<CalendarMenuTarget | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const onContextMenuCapture = useCallback(
    (e: React.MouseEvent) => {
      pending.current = null;
      const el = e.target as HTMLElement | null;
      const chip = el?.closest?.("[data-cal-event]") as HTMLElement | null;
      const id = chip?.dataset.calEvent;
      if (id) {
        const event = events.find((ev) => ev.id === id);
        if (event) pending.current = { kind: "event", event };
        return;
      }
      const cell = el?.closest?.("[data-month-day]") as HTMLElement | null;
      const col = Number(cell?.dataset.monthDay);
      if (!Number.isFinite(col)) return;
      pending.current = {
        kind: "slot",
        col,
        startMin: MONTH_NEW_EVENT_MIN,
        allDay: false,
      };
    },
    [events],
  );

  const onOpenChange = (next: boolean) => {
    if (next && !pending.current) return;
    if (next) setTarget(pending.current);
    setMenuOpen(next);
  };

  return (
    <ContextMenu open={menuOpen} onOpenChange={onOpenChange}>
      <ContextMenuTrigger
        onContextMenuCapture={onContextMenuCapture}
        render={
          <div
            ref={gridRef}
            role="table"
            aria-label={`Month of ${view.month ? formatDate(view.month, g.locale, MONTH_YEAR) : ""}`}
            className="flex min-h-0 min-w-0 flex-1 flex-col"
            onKeyDown={onKeyDown}
          />
        }
      >
        <div role="row" className="grid shrink-0 border-b" style={COLS}>
          {view.days.slice(0, 7).map((d, i) => (
            <div
              key={i}
              role="columnheader"
              data-cal-day-header
              className={cn(
                "truncate border-s border-border/70 py-2 text-xs text-muted-foreground first:border-s-0",
                compact ? "text-center" : "px-2.5",
              )}
            >
              <abbr title={view.namesLong[i]} className="no-underline">
                {view.namesShort[i]}
              </abbr>
            </div>
          ))}
        </div>

        <div
          role="rowgroup"
          className="grid min-h-0 flex-1"
          style={{ gridTemplateRows: `repeat(${weeks}, minmax(0, 1fr))` }}
        >
          {rows.map((row, w) => {
            const inRow = (day: number) => day >= w * 7 && day < w * 7 + 7;
            return (
              <MonthWeekRow
                key={w}
                week={w}
                compact={compact}
                view={view}
                layout={layout}
                chips={row.chips}
                slots={slots}
                chipH={chipH}
                month={month}
                selectedId={selectedId !== null && row.ids.has(selectedId) ? selectedId : null}
                rovingId={rovingId == null || row.ids.has(rovingId) ? rovingId : null}
                rovingDay={inRow(rovingDay) ? rovingDay : -1}
                registerNode={registerNode}
                onSelect={onSelect}
                onOpenDay={onOpenDay}
                onFocusDay={onFocusDay}
                onMoveByDays={onMoveByDays}
              />
            );
          })}
        </div>
      </ContextMenuTrigger>

      {target?.kind === "event" ? (
        <EventContextMenu
          event={target.event}
          selected={target.event.id === selectedId}
          host={gridRef}
          days={view.days}
          onSelect={onSelect}
          close={() => setMenuOpen(false)}
        />
      ) : target ? (
        <GridContextMenu
          slot={target}
          host={gridRef}
          days={view.days}
          // no hour axis: "Jump to now" stays disabled
          todayIndex={-1}
          viewSetting={viewSetting}
          onSwitchView={onSwitchView}
          onSelect={onSelect}
          close={() => setMenuOpen(false)}
        />
      ) : null}
    </ContextMenu>
  );
}

const COLS: React.CSSProperties = {
  gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
};

const WEEK_COLS = [0, 1, 2, 3, 4, 5, 6];

const DAY_BUTTON = cn(
  "flex size-6 cursor-pointer items-center justify-center rounded-full text-2xs tabular-nums",
  CELL_HOVER,
  FOCUS_RING,
);

interface WeekRowProps {
  week: number;
  compact: boolean;
  view: ViewDescriptor;
  layout: MonthLayout;
  chips: MonthChip[];
  slots: number;
  chipH: number;
  month: number | undefined;
  selectedId: string | null;
  rovingId?: string | null;
  /** the day button in the tab order, or -1 when it is in another row */
  rovingDay: number;
  registerNode: (id: string, node: HTMLElement | null) => void;
  onSelect: (id: string | null, opts?: { isNew?: boolean }) => void;
  onOpenDay: (date: Date) => void;
  onFocusDay: (day: number) => void;
  onMoveByDays?: (id: string, dayDelta: number) => CommitResult;
}

const MonthWeekRow = memo(function MonthWeekRow({
  week,
  view,
  layout,
  chips,
  slots,
  chipH,
  month,
  selectedId,
  registerNode,
  onSelect,
  onOpenDay,
  onFocusDay,
  rovingId,
  rovingDay,
  onMoveByDays,
  compact,
}: WeekRowProps) {
  const g = useKloqSettings();
  const first = week * 7;

  return (
    <div role="row" className="relative grid border-b" style={COLS}>
      {WEEK_COLS.map((i) => {
        const day = first + i;
        if (day >= view.dayCount) return null;
        const date = view.days[day];
        const isToday = day === view.todayIndex;
        const inMonth = month === undefined || date.getMonth() === month;
        const count = layout.byDay[day]?.length ?? 0;
        const overflow = layout.overflow[day] ?? 0;
        const full = fullDate(date, g.locale);
        return (
          <div
            key={day}
            role="cell"
            data-month-day={day}
            aria-label={cellLabel(date, view.namesLong[day], count, g.locale)}
            className={cn(
              "relative min-w-0 border-s border-border/70 first:border-s-0 data-month-drop:bg-accent",
              !inMonth && "bg-muted/60",
            )}
          >
            <div
              className={cn(
                "flex h-6 items-center px-1",
                compact ? "justify-center" : "justify-end",
              )}
            >
              <button
                type="button"
                data-month-open={day}
                tabIndex={day === rovingDay ? 0 : -1}
                onClick={() => onOpenDay(date)}
                onFocus={() => onFocusDay(day)}
                aria-label={`Open ${full}`}
                aria-current={isToday ? "date" : undefined}
                className={cn(
                  DAY_BUTTON,
                  isToday
                    ? "bg-primary font-medium text-primary-foreground hover:bg-primary"
                    : inMonth
                      ? "text-foreground"
                      : "text-muted-foreground",
                )}
              >
                {date.getDate()}
              </button>
            </div>

            {compact ? (
              <CompactDay
                events={layout.byDay[day] ?? EMPTY_EVENTS}
                date={date}
                onOpenDay={onOpenDay}
              />
            ) : (
              <EventOverflow
                count={overflow}
                events={() => hiddenOn(layout, day)}
                label={`Show ${plural(overflow, "more event")} on ${full}`}
                heading={full}
                onSelect={(event) => onSelect(event.id)}
                rowLabel={(event) => chipLabel(event, date, g.timeFormat)}
                rowMeta={(event) => (event.allDay ? null : g.formatMinutes(event.startMin))}
                tabIndex={day === rovingDay ? 0 : -1}
                className="absolute end-1"
                style={{ top: CELL_HEAD + (slots - 1) * chipH, height: chipH - 2 }}
              />
            )}
          </div>
        );
      })}

      {/* a multi-day event is one element spanning columns; `cell` keeps the ARIA table valid */}
      <div role="cell" aria-label="Events" className="pointer-events-none absolute inset-0">
        {compact
          ? null
          : chips.map((chip) => (
              <MonthChipBar
                key={`${chip.event.id}:${chip.week}`}
                chip={chip}
                chipH={chipH}
                view={view}
                selected={chip.event.id === selectedId}
                tabIndex={rovingTab(rovingId, chip.event.id)}
                registerNode={registerNode}
                onSelect={onSelect}
                onMoveByDays={onMoveByDays}
              />
            ))}
      </div>
    </div>
  );
});

const EMPTY_EVENTS: PlacedEvent[] = [];
const COMPACT_DOTS = 4;

function CompactDay({
  events,
  date,
  onOpenDay,
}: {
  events: PlacedEvent[];
  date: Date;
  onOpenDay: (date: Date) => void;
}) {
  if (events.length === 0) return null;
  const extra = events.length - COMPACT_DOTS;
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-hidden
      onClick={() => onOpenDay(date)}
      className="absolute inset-x-0 top-6 bottom-0 flex cursor-pointer flex-wrap content-start justify-center gap-1 px-1 pt-0.5 outline-none"
    >
      {events.slice(0, COMPACT_DOTS).map((e) => (
        <span key={e.id} className={cn("size-1.5 rounded-full", EVENT_COLORS[e.color].bar)} />
      ))}
      {extra > 0 ? (
        <span className="basis-full text-center text-3xs leading-none text-muted-foreground">
          +{extra}
        </span>
      ) : null}
    </button>
  );
}

function cellLabel(date: Date, nameLong: string, count: number, locale?: string): string {
  const when = fullDate(date, locale) || nameLong;
  if (count === 0) return `${when}, no events`;
  return `${when}, ${plural(count, "event")}`;
}

/** Accessible name for a chip: what, when, and for a bar how long. */
export function chipLabel(event: PlacedEvent, date: Date, opts?: TimeFormatOptions): string {
  const title = eventTitle(event);
  const when = fullDate(date, opts?.locale);
  if (event.allDay) {
    const span = event.endDayIndex - event.dayIndex + 1;
    return span > 1 ? `${title}, all day, ${span} days from ${when}` : `${title}, all day, ${when}`;
  }
  // title then time, in the order a chip renders them — the visible text has to
  // be part of the accessible name (label-content-name-mismatch)
  return `${title}, ${formatRange(event.startMin, event.endMin, opts)}, ${when}`;
}

interface ChipBarProps {
  chip: MonthChip;
  chipH: number;
  view: ViewDescriptor;
  selected: boolean;
  tabIndex?: number;
  registerNode: (id: string, node: HTMLElement | null) => void;
  onSelect: (id: string | null, opts?: { isNew?: boolean }) => void;
  onMoveByDays?: (id: string, dayDelta: number) => CommitResult;
}

// below this a click, past it a drag
const MONTH_DRAG_THRESHOLD = 4;

interface MonthDrag {
  pointerId: number;
  x0: number;
  y0: number;
  x: number;
  y: number;
  t: number;
  fromDay: number | null;
  moved: boolean;
  hover: HTMLElement | null;
  lift: HTMLElement | null;
  origin: DOMRect | null;
  jiggle: JiggleState;
  jiggleT: number;
  vx: number;
  vy: number;
  raf: number;
  reduced: boolean;
}

const LIFT_Z = "60";

function monthCellAt(x: number, y: number): HTMLElement | null {
  for (const el of document.elementsFromPoint(x, y)) {
    if ((el as HTMLElement).dataset?.monthDay !== undefined) return el as HTMLElement;
  }
  return null;
}

function monthDayAt(x: number, y: number): number | null {
  const day = monthCellAt(x, y)?.dataset.monthDay;
  return day === undefined ? null : Number(day);
}

const MonthChipBar = memo(function MonthChipBar({
  chip,
  chipH,
  view,
  selected,
  tabIndex,
  registerNode,
  onSelect,
  onMoveByDays,
}: ChipBarProps) {
  const g = useKloqSettings();
  const { event } = chip;
  const c = EVENT_COLORS[event.color];
  const span = chip.endCol - chip.startCol + 1;
  const banner = event.allDay || span > 1;

  // day-granularity drag, separate from the grid engine (no minute axis here)
  const drag = useRef<MonthDrag | null>(null);
  const suppressClick = useRef(false);

  const washCell = (cell: HTMLElement | null) => {
    const d = drag.current;
    if (!d || d.hover === cell) return;
    d.hover?.removeAttribute("data-month-drop");
    cell?.setAttribute("data-month-drop", "");
    d.hover = cell;
  };

  // the chip is clipped by the month's overflow, so a fixed clone travels and the chip ghosts
  const pickUp = (node: HTMLElement, d: MonthDrag) => {
    const rect = node.getBoundingClientRect();
    const lift = node.cloneNode(true) as HTMLElement;
    lift.removeAttribute("data-cal-event");
    lift.removeAttribute("aria-pressed");
    lift.setAttribute("data-cal-lift", "");
    lift.setAttribute("aria-hidden", "true");
    lift.tabIndex = -1;
    Object.assign(lift.style, {
      position: "fixed",
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
      margin: "0",
      pointerEvents: "none",
      zIndex: LIFT_Z,
      transformOrigin: "50% 50%",
      opacity: "1",
    } satisfies Partial<CSSStyleDeclaration>);
    lift.style.setProperty("--kloq-lift", d.reduced ? "1" : "0");
    // dark mode is a class on an ancestor; the clone has to land inside it
    (node.closest(".dark") ?? document.body).appendChild(lift);
    node.setAttribute("data-cal-lifted", "");
    node.style.opacity = "0.4";
    if (!d.reduced)
      node.animate([{ opacity: 1 }, { opacity: 0.4 }], {
        duration: ms(160),
        easing: "ease-out",
      });
    d.lift = lift;
    d.origin = rect;
    const frame = () => {
      const dd = drag.current;
      if (!dd || dd.lift !== lift) return;
      const now = performance.now();
      const dt = dd.jiggleT ? (now - dd.jiggleT) / 1000 : 1 / 60;
      dd.jiggleT = now;
      dd.vx *= 0.92;
      dd.vy *= 0.92;
      let tf = `translate(${dd.x - dd.x0}px, ${dd.y - dd.y0}px)`;
      if (!dd.reduced) {
        stepJiggle(dd.jiggle, { vx: dd.vx, vy: dd.vy, dt, tilt: true });
        tf += jiggleTransform(dd.jiggle);
        lift.style.setProperty("--kloq-lift", liftOf(dd.jiggle).toFixed(3));
      }
      lift.style.transform = tf;
      washCell(monthCellAt(dd.x, dd.y));
      dd.raf = requestAnimationFrame(frame);
    };
    d.raf = requestAnimationFrame(frame);
  };

  const chipsOf = (node: HTMLElement) =>
    Array.from(
      (node.closest('[role="table"]') ?? document).querySelectorAll<HTMLElement>(
        `[data-cal-event="${CSS.escape(event.id)}"]`,
      ),
    );

  const unghost = (nodes: HTMLElement[], fade: boolean) => {
    for (const n of nodes) {
      n.removeAttribute("data-cal-lifted");
      n.style.opacity = "";
      if (fade)
        n.animate([{ opacity: 0.4 }, { opacity: 1 }], {
          duration: ms(120),
          easing: "ease-out",
        });
    }
  };

  const endDrag = (node: HTMLElement, commit: boolean) => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    cancelAnimationFrame(d.raf);
    d.hover?.removeAttribute("data-month-drop");
    if (!d.moved || !d.lift || !d.origin) return;
    suppressClick.current = true;
    const lift = d.lift;
    const origin = d.origin;
    const from = lift.style.transform;
    const lifted = lift.style.getPropertyValue("--kloq-lift") || "1";

    const home = () => {
      const finish = () => {
        lift.remove();
        unghost(chipsOf(node), !d.reduced);
      };
      if (d.reduced) return finish();
      const anim = lift.animate(
        [
          { transform: from, "--kloq-lift": lifted },
          { transform: `translate(0px, 0px)${JIGGLE_REST}`, "--kloq-lift": "0" },
        ],
        { duration: SPRING_MS, easing: SPRING },
      );
      anim.onfinish = finish;
    };

    const toDay = commit ? monthDayAt(d.x, d.y) : null;
    if (toDay === null || d.fromDay === null || toDay === d.fromDay) return home();

    // rAF: the store update has rendered the new chip by then, nothing has painted yet
    const land = () =>
      requestAnimationFrame(() => {
        const next = chipsOf(node);
        const target = next[0];
        if (!target) {
          lift.remove();
          return;
        }
        const to = target.getBoundingClientRect();
        for (const n of next) {
          n.removeAttribute("data-cal-lifted");
          n.style.opacity = "0";
        }
        const finish = () => {
          lift.remove();
          for (const n of next) n.style.opacity = "";
        };
        if (d.reduced) return finish();
        const anim = lift.animate(
          [
            { transform: lift.style.transform, width: `${origin.width}px`, "--kloq-lift": lifted },
            {
              transform: `translate(${to.left - origin.left}px, ${to.top - origin.top}px)${JIGGLE_REST}`,
              width: `${to.width}px`,
              "--kloq-lift": "0",
            },
          ],
          { duration: SPRING_MS * 0.6, easing: SPRING },
        );
        anim.onfinish = finish;
      });

    const result = onMoveByDays?.(event.id, toDay - d.fromDay);
    if (result && typeof result.then === "function") {
      // host is asking which occurrence; stay lifted until it answers
      void result.then(
        (ok) => (ok ? land() : home()),
        () => home(),
      );
      return;
    }
    land();
  };

  const dragHandlers =
    onMoveByDays && !event.readOnly
      ? {
          onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
            if (e.button !== 0 || drag.current) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            drag.current = {
              pointerId: e.pointerId,
              x0: e.clientX,
              y0: e.clientY,
              x: e.clientX,
              y: e.clientY,
              t: e.timeStamp,
              fromDay: monthDayAt(e.clientX, e.clientY),
              moved: false,
              hover: null,
              lift: null,
              origin: null,
              jiggle: createJiggle(),
              jiggleT: 0,
              vx: 0,
              vy: 0,
              raf: 0,
              reduced: prefersReducedMotion(),
            };
          },
          onPointerMove: (e: React.PointerEvent<HTMLButtonElement>) => {
            const d = drag.current;
            if (!d || e.pointerId !== d.pointerId) return;
            if (!d.moved && Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < MONTH_DRAG_THRESHOLD)
              return;
            if (!d.moved) {
              d.moved = true;
              pickUp(e.currentTarget, d);
            }
            const dt = Math.max(1, e.timeStamp - d.t);
            d.vx = d.vx * 0.8 + ((e.clientX - d.x) / dt) * 1000 * 0.2;
            d.vy = d.vy * 0.8 + ((e.clientY - d.y) / dt) * 1000 * 0.2;
            d.x = e.clientX;
            d.y = e.clientY;
            d.t = e.timeStamp;
          },
          onPointerUp: (e: React.PointerEvent<HTMLButtonElement>) => {
            endDrag(e.currentTarget, true);
          },
          onPointerCancel: (e: React.PointerEvent<HTMLButtonElement>) => {
            endDrag(e.currentTarget, false);
          },
          onKeyDownCapture: (e: React.KeyboardEvent<HTMLButtonElement>) => {
            if (e.key === "Escape" && drag.current?.moved) {
              e.stopPropagation();
              endDrag(e.currentTarget, false);
            }
          },
        }
      : {};

  return (
    <button
      type="button"
      data-cal-event={event.id}
      ref={(node) => registerNode(event.id, node)}
      onClick={() => {
        if (suppressClick.current) {
          suppressClick.current = false;
          return;
        }
        onSelect(event.id);
      }}
      {...dragHandlers}
      aria-pressed={selected}
      tabIndex={tabIndex}
      aria-label={chipLabel(event, view.days[chip.startDay], g.timeFormat)}
      className={cn(
        "pointer-events-auto absolute z-10 flex cursor-pointer items-center gap-1 overflow-hidden rounded-xs px-1 text-start text-2xs leading-none transition-[background-color,box-shadow] duration-150 focus-visible:z-20",
        FOCUS_RING,
        banner ? cn(c.tint, c.ink) : "hover:bg-accent",
        selected && cn("z-20 ring-2", c.ring),
        chip.continuesBefore && "rounded-s-none",
        chip.continuesAfter && "rounded-e-none",
      )}
      style={{
        top: CELL_HEAD + chip.slot * chipH,
        height: chipH - 2,
        left: `calc(${(chip.startCol / 7) * 100}% + 3px)`,
        width: `calc(${(span / 7) * 100}% - 6px)`,
        ...(banner ? { color: EVENT_TEXT_CSS } : null),
      }}
    >
      {banner ? null : <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", c.bar)} />}
      <span className="truncate font-medium">{eventTitle(event)}</span>{" "}
      {banner ? null : (
        <span className="shrink-0 truncate text-muted-foreground">
          {g.formatMinutes(event.startMin)}
        </span>
      )}
    </button>
  );
});
