"use client";

import type React from "react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { type KloqView, type PlacedEvent, snapMinutes } from "../lib/calendar-types";
import { fullDate, plural } from "../lib/event-text";
import { bucketByDay, layoutDay } from "../lib/overlap";
import { withoutSegment } from "../lib/recurrence";
import { rovingTab } from "../lib/roving";
import { eventKeyOf } from "../lib/selection";
import { useLatest } from "../lib/use-latest";
import { ContextMenu, ContextMenuTrigger } from "../ui/context-menu";
import type { EventLayout } from "./event-block";
import {
  EventContextMenu,
  fallbackDays,
  GridContextMenu,
  useCalendarContextMenu,
} from "./event-context-menu";
import { useKloqSettings } from "./settings-context";
import { useSlots } from "./slots";
import { TimeShade, type WorkingHours } from "./time-shade";
import { useMarquee } from "./use-marquee";
import { hasSelectionModifier, selectionModifiers, useKloqSelection } from "./use-selection";

interface WeekGridProps {
  events: PlacedEvent[];
  dayCount: number;
  dayNamesShort: string[];
  todayIndex: number;
  canvasRef: React.RefObject<HTMLDivElement | null>;
  draftRef: React.RefObject<HTMLDivElement | null>;
  registerNode: (id: string, node: HTMLElement | null) => void;
  /** placement-id → node map shared with the engine; lets the marquee hit-test without DOM queries */
  registry?: Map<string, HTMLElement>;
  onCanvasPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onCanvasDoubleClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onEventPointerDown: (e: React.PointerEvent<HTMLElement>, event: PlacedEvent) => void;
  selectedId: string | null;
  /** false = no working-hours tint */
  workingHours: WorkingHours | false;
  /** Real date per visible column; without it the menu assumes `fallbackDays`. */
  days?: Date[];
  /** Select an event (opens the panel). `isNew` marks a draft so Escape discards it. */
  onSelect?: (id: string | null, opts?: { isNew?: boolean }) => void;
  viewSetting?: KloqView;
  /** omit and the menu's view-switch items don't render */
  onSwitchView?: (view: KloqView) => void;
  /** Scroll container, used only to auto-scroll a marquee dragged past the edge. */
  scrollRef?: React.RefObject<HTMLDivElement | null>;
  /** The one event carrying `tabIndex={0}` — see `lib/roving.ts`. */
  rovingId?: string | null;
  /** columns under ~64px: blocks show a title only */
  cramped?: boolean;
}

/** Per-column accessible name: "Tuesday 5 August, 3 events". */
function columnLabel(date: Date | undefined, n: number, locale?: string): string {
  const when = date ? fullDate(date, locale) : "";
  const events = n === 0 ? "no events" : plural(n, "event");
  return when ? `${when}, ${events}` : events;
}

const CONTENTS: React.CSSProperties = { display: "contents" };
const SOLO_LAYOUT: EventLayout = { col: 0, cols: 1 };

/** The grid before the calendar knows its date: the hour axis and its rules, no day columns. */
export function WeekGridFrame() {
  const C = useSlots();
  const g = useKloqSettings();
  // hour labels are printed only when they cannot differ between server and browser:
  // foreign-zone hours depend on the day, and `hour12` without a locale formats in the runtime's
  const deterministic =
    g.timeZones.length === 0 && (g.locale !== undefined || g.hour12 === undefined);
  return (
    <div className="flex min-w-0 flex-1">
      {deterministic ? (
        <C.TimeGutter
          minutesToPx={g.minutesToPx}
          startHour={g.dayStartHour + 1}
          endHour={g.dayEndHour}
          height={g.canvasHeight}
          formatHour={(hour) => g.formatMinutes(hour * 60)}
        />
      ) : (
        <div className="w-(--kloq-gutter-width) shrink-0" />
      )}
      <div className="cal-hour-lines min-w-0 flex-1" style={{ height: g.canvasHeight }} />
    </div>
  );
}

export function WeekGrid({
  events,
  dayCount,
  dayNamesShort,
  todayIndex,
  canvasRef,
  draftRef,
  registerNode,
  registry,
  onCanvasPointerDown,
  onCanvasDoubleClick,
  onEventPointerDown,
  selectedId,
  workingHours,
  days,
  onSelect,
  viewSetting,
  onSwitchView,
  scrollRef,
  rovingId,
  cramped = false,
}: WeekGridProps) {
  const C = useSlots();
  const g = useKloqSettings();
  const selection = useKloqSelection();
  const { timed, columnEvents, layouts } = useMemo(() => {
    const timed = events.filter((e) => !e.allDay);
    const columnEvents = bucketByDay(timed, dayCount);
    const layouts = new Map<string, EventLayout>();
    for (let day = 0; day < dayCount; day++) {
      const dayLayout = layoutDay(columnEvents[day]);
      for (const [id, l] of dayLayout) layouts.set(id, l);
    }
    return { timed, columnEvents, layouts };
  }, [events, dayCount]);

  const columns = days ?? fallbackDays(dayCount, todayIndex);
  const menu = useCalendarContextMenu({
    hostRef: canvasRef,
    events: timed,
    dayCount,
  });

  // read per rAF frame, so the hit test goes through a ref and must not allocate
  const timedRef = useLatest(timed);
  const boxRef = useRef<HTMLDivElement>(null);
  const marquee = useMarquee({
    canvasRef,
    boxRef,
    scrollRef,
    registry,
    dayCount,
    getEvents: () => timedRef.current,
    onCommit: (ids, additive) => selection?.applyMarquee(ids, additive),
  });

  // marquee gets first refusal on the pointerdown; create-drag only if it declines
  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (selection && marquee.tryStart(e)) return;
      onCanvasPointerDown(e);
    },
    [selection, marquee, onCanvasPointerDown],
  );

  // where a paste lands; a ref write, never a render input — measured once per frame, not per move
  const hoverPoint = useRef({ x: 0, y: 0 });
  const hoverFrame = useRef(0);
  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.buttons !== 0) return;
      const hover = selection?.hover;
      if (!hover) return;
      hoverPoint.current = { x: e.clientX, y: e.clientY };
      if (hoverFrame.current) return;
      hoverFrame.current = requestAnimationFrame(() => {
        hoverFrame.current = 0;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const { x, y } = hoverPoint.current;
        const col = Math.max(
          0,
          Math.min(dayCount - 1, Math.floor(((x - rect.left) / rect.width) * dayCount)),
        );
        const startMin = Math.max(
          g.dayStartMin,
          Math.min(
            g.dayEndMin - g.snapMinutes,
            snapMinutes(g.pxToMinutes(y - rect.top), g.snapMinutes),
          ),
        );
        hover.current = { col, startMin };
      });
    },
    [selection, canvasRef, dayCount, g],
  );

  const onPointerLeave = useCallback(() => {
    cancelAnimationFrame(hoverFrame.current);
    hoverFrame.current = 0;
    if (selection) selection.hover.current = null;
  }, [selection]);
  useEffect(() => () => cancelAnimationFrame(hoverFrame.current), []);

  // modifier-clicks select and must not arm a drag; refs keep the handlers stable
  const latest = useLatest({ selection, onEventPointerDown, onSelect });
  const onBlockPointerDown = useCallback(
    (e: React.PointerEvent<HTMLElement>, event: PlacedEvent) => {
      const { selection, onEventPointerDown } = latest.current;
      if (selection && e.button === 0 && hasSelectionModifier(e)) {
        e.preventDefault();
        e.stopPropagation();
        selection.click(event.id, selectionModifiers(e));
        return;
      }
      onEventPointerDown(e, event);
    },
    [],
  );
  const onBlockActivate = useCallback((ev: PlacedEvent) => latest.current.onSelect?.(ev.id), []);

  // keyed by event key, not placement id: both segments of a cross-midnight event light up
  const selectedIndex = new Map<string, number>();
  if (selection) {
    for (let i = 0; i < selection.ids.length; i++)
      selectedIndex.set(withoutSegment(selection.ids[i]), i + 1);
  }
  const isSelected = (e: PlacedEvent) =>
    selection ? selectedIndex.has(eventKeyOf(e)) : eventKeyOf(e) === selectedId;
  const selectionIndexOf = (e: PlacedEvent) => selectedIndex.get(eventKeyOf(e)) ?? 0;

  return (
    <div className="flex min-w-0 flex-1">
      <C.TimeGutter
        minutesToPx={g.minutesToPx}
        /* the first hour sits at y=0 where a centred label would clip, so labels start one hour in */
        startHour={g.dayStartHour + 1}
        endHour={g.dayEndHour}
        height={g.canvasHeight}
        formatHour={(hour) => g.formatMinutes(hour * 60)}
      />

      {/* `render` keeps the canvas the same element the engine measures against */}
      <ContextMenu open={menu.open} onOpenChange={menu.onOpenChange}>
        <ContextMenuTrigger
          onContextMenuCapture={menu.onContextMenuCapture}
          render={
            <div
              ref={canvasRef}
              data-cal-canvas
              data-cramped={cramped || undefined}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerLeave={onPointerLeave}
              onDoubleClick={onCanvasDoubleClick}
              data-craft="intent-threshold"
              className="relative min-w-0 flex-1 touch-none select-none cal-hour-lines"
              style={{ height: g.canvasHeight }}
            />
          }
        >
          <TimeShade todayIndex={todayIndex} dayCount={dayCount} workingHours={workingHours} />

          {Array.from({ length: dayCount }, (_, i) => (
            <div
              key={i}
              aria-hidden
              className="pointer-events-none absolute inset-y-0 border-s border-border/70"
              style={{ left: `${(i / dayCount) * 100}%` }}
            />
          ))}

          {/* not `role="grid"`: `lib/keyboard-scope` would treat it as owning its own keys */}
          {Array.from({ length: dayCount }, (_, day) => {
            const column = columnEvents[day];
            return (
              <div
                key={day}
                role="list"
                aria-label={columnLabel(columns[day], column.length, g.locale)}
                className="pointer-events-none absolute inset-0"
              >
                {column.map((event) => (
                  <div key={event.id} role="listitem" style={CONTENTS}>
                    <C.EventBlock
                      event={event}
                      dayCount={dayCount}
                      dayNamesShort={dayNamesShort}
                      layout={layouts.get(event.id) ?? SOLO_LAYOUT}
                      selected={isSelected(event)}
                      selection={
                        selection && selection.count > 1 && isSelected(event)
                          ? {
                              index: selectionIndexOf(event),
                              count: selection.count,
                            }
                          : undefined
                      }
                      tabIndex={rovingTab(rovingId, event.id)}
                      registerNode={registerNode}
                      onPointerDown={onBlockPointerDown}
                      onActivate={onBlockActivate}
                    />
                  </div>
                ))}
              </div>
            );
          })}

          <div ref={draftRef} hidden data-cal-draft className="absolute z-30">
            <span aria-hidden data-slot="draft-bar" />
            <span data-slot="draft-label" />
          </div>

          <div
            ref={boxRef}
            hidden
            aria-hidden
            data-cal-marquee
            data-craft="intent-threshold"
            className="pointer-events-none absolute start-0 top-0 z-40 rounded-xs border border-primary/70 bg-primary/10"
          />

          <C.NowIndicator todayIndex={todayIndex} dayCount={dayCount} />
        </ContextMenuTrigger>

        {menu.target?.kind === "event" ? (
          <EventContextMenu
            event={menu.target.event}
            selected={isSelected(menu.target.event)}
            host={canvasRef}
            days={columns}
            onSelect={onSelect}
            close={menu.close}
          />
        ) : menu.target ? (
          <GridContextMenu
            slot={menu.target}
            host={canvasRef}
            days={columns}
            todayIndex={todayIndex}
            viewSetting={viewSetting}
            onSwitchView={onSwitchView}
            onSelect={onSelect}
            close={menu.close}
          />
        ) : null}
      </ContextMenu>
    </div>
  );
}
