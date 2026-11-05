import { type RefObject, useCallback } from "react";
import { announceCreated, announceRefused, type WhenRef } from "../lib/announce";
import type { KloqStore } from "../lib/calendar-store";
import { type Constraints, slotAllowed, timedSlot } from "../lib/constraints";
import { snapMinutes } from "../lib/grid-defaults";
import { instantAt, instantPlus, parseInstant } from "../lib/instant";
import { nodeFor } from "../lib/recurrence";
import { KEYBOARD_SPRING, KEYBOARD_SPRING_MS, prefersReducedMotion } from "../lib/springs";
import { useLatest } from "../lib/use-latest";
import type { ViewDescriptor } from "../lib/view";
import { DEFAULT_QUICK_ADD_MIN } from "./kloq-command";
import { useKloqSettings } from "./settings-context";
import type { WhenInput } from "./use-placement-commits";

export function useQuickCreate({
  store,
  view,
  registry,
  canvasRef,
  onDefaultCalendar,
  authoredZone,
  constraints,
  announce,
  whenOf,
  onCreated,
}: {
  store: KloqStore;
  view: ViewDescriptor;
  registry: Map<string, HTMLElement>;
  canvasRef: RefObject<HTMLDivElement | null>;
  onDefaultCalendar: { calendarId?: string } | undefined;
  authoredZone: { timeZone: string } | undefined;
  constraints?: Constraints;
  announce: (message: string) => void;
  whenOf: (p: WhenInput) => WhenRef;
  onCreated: (id: string) => void;
}) {
  const g = useKloqSettings();
  const cb = useLatest({ onCreated });

  // `pxToMinutes` already restores the day-window offset; don't add `dayStartMin` again
  const slotAt = (canvas: HTMLElement, e: { clientX: number; clientY: number }) => {
    const rect = canvas.getBoundingClientRect();
    const col = Math.max(
      0,
      Math.min(
        view.dayCount - 1,
        Math.floor(((e.clientX - rect.left) / rect.width) * view.dayCount),
      ),
    );
    const min = Math.min(
      g.dayEndMin - DEFAULT_QUICK_ADD_MIN,
      Math.max(g.dayStartMin, snapMinutes(g.pxToMinutes(e.clientY - rect.top), g.snapMinutes)),
    );
    return { col, min };
  };

  const quickCreate = useCallback(
    (col?: number, startMin?: number) => {
      const day = col ?? (view.todayIndex >= 0 ? view.todayIndex : 0);
      // the display zone's next whole hour, clamped into the configured day range
      const start =
        startMin ??
        Math.max(
          g.dayStartMin,
          Math.min((g.displayNow().getHours() + 1) * 60, g.dayEndMin - DEFAULT_QUICK_ADD_MIN),
        );
      if (
        constraints?.active &&
        !slotAllowed(
          constraints,
          timedSlot(view, day, start, start + DEFAULT_QUICK_ADD_MIN, g.fromDisplay),
        )
      ) {
        announce(announceRefused("create"));
        return;
      }
      const id = g.makeId();
      store.add({
        id,
        title: "",
        ...onDefaultCalendar,
        ...authoredZone,
        start: instantAt(view, day, start, g.displayZone),
        end: instantAt(view, day, start + DEFAULT_QUICK_ADD_MIN, g.displayZone),
      });
      cb.current.onCreated(id);
      announce(
        announceCreated(
          { title: "" },
          whenOf({
            dayIndex: day,
            startMin: start,
            endMin: start + DEFAULT_QUICK_ADD_MIN,
          }),
        ),
      );
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          const node = nodeFor(registry, id);
          if (!node) return;
          node.scrollIntoView({ block: "center", behavior: "smooth" });
          if (!prefersReducedMotion())
            node.animate(
              [
                { opacity: 0, transform: "scale(0.92)" },
                { opacity: 1, transform: "none" },
              ],
              { duration: KEYBOARD_SPRING_MS, easing: KEYBOARD_SPRING },
            );
        }),
      );
    },
    [view, store, registry, g, announce, whenOf, onDefaultCalendar, authoredZone, constraints, cb],
  );

  // promote to / demote from the all-day lane — the keyboard's only route in

  // snap a pointer position on the canvas to a slot, exactly as drag-create does
  const slotAtPointer = useCallback(
    (e: { clientX: number; clientY: number }) => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const { col, min } = slotAt(canvas, e);
      const start = instantAt(view, col, min, g.displayZone);
      return {
        start: new Date(parseInstant(start)),
        end: new Date(parseInstant(instantPlus(start, DEFAULT_QUICK_ADD_MIN, g.displayZone))),
        allDay: false,
      };
    },
    [view, g],
  );

  const onCanvasDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const canvas = canvasRef.current;
      if (!canvas || (e.target as HTMLElement).closest("[data-cal-event]")) return;
      const { col, min } = slotAt(canvas, e);
      quickCreate(col, min);
    },
    [view, quickCreate, g],
  );

  return { quickCreate, slotAtPointer, onCanvasDoubleClick };
}
