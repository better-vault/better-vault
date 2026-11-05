import { type RefObject, useCallback, useMemo } from "react";
import { flushSync } from "react-dom";
import {
  announceAllDay,
  announceColor,
  announceCreated,
  announceDuplicated,
  announceMoved,
  announceRefused,
  announceResized,
  announceSpanned,
  type WhenRef,
} from "../lib/announce";
import type { KloqStore } from "../lib/calendar-store";
import { allDaySlot, allows, type Constraints, type Slot } from "../lib/constraints";
import { MINUTES_PER_DAY } from "../lib/date-math";
import type { CommitResult } from "../lib/drag-engine/types";
import type { CalEvent, CalEventPatch } from "../lib/event-types";
import { dateOnlyAfter, dateOnlyAt, instantAt, instantPlus, parseInstant } from "../lib/instant";
import type { PlacedEvent } from "../lib/placement";
import { landedWhen, movedStart, wallDuration } from "../lib/placement-patch";
import type { Projection } from "../lib/projection";
import {
  applyPlan,
  editOccurrence,
  masterIdOf,
  type Occurrence,
  type RecurrencePlan,
  type RecurrenceScope,
} from "../lib/recurrence";
import { useLatest } from "../lib/use-latest";
import type { ViewDescriptor } from "../lib/view";
import { DEFAULT_QUICK_ADD_MIN } from "./kloq-command";
import { useKloqSettings } from "./settings-context";
import type { PlacedEventPatch } from "./use-calendar-keys";
import type { AskRecurrenceScope } from "./use-recurrence-scope";

/** A block demoted from all-day lands at 9am. */
const DEMOTED_START_MIN = 9 * 60;

export interface WhenInput {
  dayIndex: number;
  endDayIndex?: number;
  startMin?: number;
  endMin?: number;
  allDay?: boolean;
}

export interface PlacementCommitOptions {
  store: KloqStore;
  view: ViewDescriptor;
  projectedRef: RefObject<Projection>;
  askScope: AskRecurrenceScope | null;
  constraints?: Constraints;
  announce: (message: string) => void;
  whenOf: (p: WhenInput) => WhenRef;
  eventOf: (id: string) => { title?: string };
  onDefaultCalendar: { calendarId?: string } | undefined;
  authoredZone: { timeZone: string } | undefined;
  /** snapshot the blocks immediately before a mutation, so a deferred commit morphs from where they are THEN */
  snapshot: (masterId: string) => void;
  /** "this" / "this and following" mint a new event; the selection and panel must follow it */
  onPlanSelected: (from: string, to: string) => void;
  onCreated: (id: string) => void;
}

export function usePlacementCommits({
  store,
  view,
  projectedRef,
  askScope,
  constraints,
  announce,
  whenOf,
  eventOf,
  onDefaultCalendar,
  authoredZone,
  snapshot,
  onPlanSelected,
  onCreated,
}: PlacementCommitOptions) {
  const g = useKloqSettings();
  const zone = g.displayZone;
  const cb = useLatest({ snapshot, onPlanSelected, onCreated });
  const guard = useLatest({ constraints, announce });

  const timedWindow = (start: string, end: string): Slot => ({
    start: new Date(parseInstant(start)),
    end: new Date(parseInstant(end)),
    allDay: false,
  });

  /** Gesture-level refusal for the non-engine paths; the engine runs its own live probe. */
  const refuse = (
    gesture: "move" | "resize" | "duplicate",
    target: Slot,
    origin: Slot | undefined,
    event?: CalEvent,
  ): boolean => {
    const { constraints: c, announce: say } = guard.current;
    if (!c?.active) return false;
    if (allows(c, { gesture, target, origin, event })) return false;
    say(announceRefused(gesture, event));
    return true;
  };

  const commitPlacement = useCallback(
    (placementId: string, patch: CalEventPatch, say?: string): CommitResult => {
      const masterId = masterIdOf(placementId);
      const master = store.get(masterId);
      const occurrence: Occurrence | undefined = projectedRef.current.all.find(
        (e) => e.id === placementId,
      )?.occurrence;
      // a colour-only patch is not ambiguous and never asks
      const movesInTime = patch.start !== undefined || patch.end !== undefined;
      const snap = () => {
        if (movesInTime) cb.current.snapshot(masterId);
      };

      if (!master || !occurrence || !movesInTime) {
        snap();
        store.update(masterId, patch);
        if (say) announce(say);
        return;
      }

      const apply = (scope: RecurrenceScope) => {
        const plan = editOccurrence(master, occurrence, patch, scope, { makeId: g.makeId });
        applyPlan(store, plan);
        return plan;
      };

      // no asker mounted: fall back to the lossless whole-series shift
      if (!askScope) {
        snap();
        apply("all");
        if (say) announce(say);
        return;
      }

      return askScope({ action: "edit", event: master, occurrence }).then((scope) => {
        if (!scope) return false;
        // flush before resolving: the engine clears its transform on `true`
        let plan: RecurrencePlan | undefined;
        snap();
        flushSync(() => {
          plan = apply(scope);
        });
        if (plan?.selectId) cb.current.onPlanSelected(placementId, plan.selectId);
        if (say) announce(say);
        return true;
      });
    },
    [store, projectedRef, askScope, announce, cb, g.makeId],
  );

  const timedAt = (id: string) => projectedRef.current.timed.find((e) => e.id === id);

  const commitCreate = useCallback(
    (draft: {
      dayIndex: number;
      startMin: number;
      endMin: number;
      allDay?: boolean;
      endDayIndex?: number;
    }) => {
      const id = g.makeId();
      store.add(
        draft.allDay
          ? {
              id,
              title: "",
              ...onDefaultCalendar,
              allDay: true,
              start: dateOnlyAt(view, draft.dayIndex),
              end: dateOnlyAfter(view, draft.endDayIndex ?? draft.dayIndex),
            }
          : {
              id,
              title: "",
              ...onDefaultCalendar,
              ...authoredZone,
              start: instantAt(view, draft.dayIndex, draft.startMin, zone),
              end: instantAt(view, draft.dayIndex, draft.endMin, zone),
            },
      );
      cb.current.onCreated(id);
      announce(announceCreated({ title: "" }, whenOf(draft)));
      return id;
    },
    [store, view, zone, g, onDefaultCalendar, authoredZone, cb, announce, whenOf],
  );

  const commitMove = useCallback(
    (id: string, patch: { dayIndex: number; startMin: number }): CommitResult => {
      const ev = store.get(masterIdOf(id));
      if (!ev || ev.allDay) return;
      const placed = timedAt(id);
      const duration = wallDuration(ev, zone);
      const start = movedStart(placed, view, zone, patch);
      // returned: a promise tells the engine to keep the block welded until the scope is answered
      return commitPlacement(
        id,
        { start, end: instantPlus(start, duration, zone) },
        announceMoved(ev, whenOf(landedWhen(placed, zone, patch, duration))),
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store, view, zone, commitPlacement, whenOf],
  );

  const commitResize = useCallback(
    (id: string, patch: { startMin: number; endMin: number }): CommitResult => {
      const placed = timedAt(id);
      if (!placed) return;
      // on a segment only the edge that is really the event's edge may be written; midnight is a cut
      const first = placed.segment.i === 0;
      const last = placed.segment.i === placed.segment.n - 1;
      return commitPlacement(
        id,
        {
          start: first ? instantAt(view, placed.dayIndex, patch.startMin, zone) : placed.start,
          end: last ? instantAt(view, placed.dayIndex, patch.endMin, zone) : placed.end,
        },
        announceResized(eventOf(id), { time: g.formatRange(patch.startMin, patch.endMin) }),
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [view, zone, commitPlacement, eventOf, g],
  );

  const commitSpan = useCallback(
    (id: string, patch: { dayIndex: number; endDayIndex: number }): CommitResult =>
      commitPlacement(
        id,
        { start: dateOnlyAt(view, patch.dayIndex), end: dateOnlyAfter(view, patch.endDayIndex) },
        announceSpanned(eventOf(id), whenOf({ ...patch, allDay: true })),
      ),
    [view, commitPlacement, eventOf, whenOf],
  );

  const commitDuplicate = useCallback(
    (sourceId: string, patch: { dayIndex: number; startMin: number }): string => {
      const src = store.get(masterIdOf(sourceId));
      const id = g.makeId();
      if (!src || src.allDay) return id;
      const duration = wallDuration(src, zone);
      const placed = timedAt(sourceId);
      const start = movedStart(placed, view, zone, patch);
      const end = instantPlus(start, duration, zone);
      if (refuse("duplicate", timedWindow(start, end), undefined, src)) return id;
      // copy THAT occurrence, not the series: `...src` would carry the master's `rrule`
      const detach = src.rrule
        ? ({ rrule: undefined, exdates: undefined, recurrenceId: undefined } as const)
        : null;
      store.add({ ...src, ...detach, id, start, end });
      announce(announceDuplicated(src, whenOf(landedWhen(placed, zone, patch, duration))));
      return id;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store, view, zone, g, announce, whenOf],
  );

  const toggleAllDay = useCallback(
    (placed: PlacedEvent, allDay: boolean) => {
      // the placement id, not `source.id`: commitPlacement needs the occurrence
      const id = placed.id;
      if (placed.source.readOnly) return;
      if (allDay) {
        // the origin is discarded on an all-day-ness flip (`newlyOccupied`), so none is built
        if (
          refuse(
            "move",
            allDaySlot(view, placed.dayIndex, placed.endDayIndex),
            undefined,
            placed.source,
          )
        )
          return;
        void commitPlacement(
          id,
          {
            allDay: true,
            start: dateOnlyAt(view, placed.dayIndex),
            end: dateOnlyAfter(view, placed.endDayIndex),
          } as CalEventPatch,
          announceAllDay(placed.source, true, { day: view.namesLong[placed.dayIndex] }),
        );
        return;
      }
      const startMin = g.clampMinutes(DEMOTED_START_MIN);
      const endMin = Math.min(
        g.dayEndMin,
        startMin + Math.max(g.minEventMinutes, DEFAULT_QUICK_ADD_MIN),
      );
      const start = instantAt(view, placed.dayIndex, startMin, zone);
      const end = instantAt(view, placed.dayIndex, endMin, zone);
      if (refuse("move", timedWindow(start, end), undefined, placed.source)) return;
      void commitPlacement(
        id,
        { allDay: false, start, end } as CalEventPatch,
        announceAllDay(placed.source, false, {
          day: view.namesLong[placed.dayIndex],
          time: g.formatRange(startMin, endMin),
        }),
      );
    },
    [commitPlacement, view, zone, g],
  );

  /** Month/agenda chips: shift by whole days, anchored off the placement. */
  const moveByDays = useCallback(
    (id: string, days: number): CommitResult => {
      const placed = projectedRef.current.all.find((e) => e.id === id);
      if (!placed || placed.source.readOnly || days === 0) return;
      if (placed.allDay) {
        // clamp so the whole span stays on the grid
        const lo = Math.max(
          -placed.dayIndex,
          Math.min(view.dayCount - 1 - placed.endDayIndex, days),
        );
        if (lo === 0) return;
        if (
          refuse(
            "move",
            allDaySlot(view, placed.dayIndex + lo, placed.endDayIndex + lo),
            allDaySlot(view, placed.dayIndex, placed.endDayIndex),
            placed.source,
          )
        )
          return;
        return commitPlacement(
          id,
          {
            start: dateOnlyAt(view, placed.dayIndex + lo),
            end: dateOnlyAfter(view, placed.endDayIndex + lo),
          },
          announceMoved(
            placed.source,
            whenOf({
              dayIndex: placed.dayIndex + lo,
              endDayIndex: placed.endDayIndex + lo,
              allDay: true,
            }),
          ),
        );
      }
      const duration = wallDuration(placed, zone);
      const target = { dayIndex: placed.dayIndex + days, startMin: placed.startMin };
      const start = movedStart(placed, view, zone, target, true);
      const end = instantPlus(start, duration, zone);
      if (
        refuse(
          "move",
          timedWindow(start, end),
          timedWindow(placed.start, placed.end),
          placed.source,
        )
      )
        return;
      return commitPlacement(
        id,
        { start, end },
        announceMoved(placed.source, whenOf(landedWhen(placed, zone, target, duration, true))),
      );
    },
    [projectedRef, view, zone, commitPlacement, whenOf],
  );

  /** The keyboard patch is partial column space; reconstitute it against the full placement. */
  const keyboardPatch = useCallback(
    (id: string, patch: PlacedEventPatch) => {
      const placed = projectedRef.current.all.find((e) => e.id === id);
      if (!placed || placed.readOnly) return;
      const next: CalEventPatch = {};
      if (patch.color !== undefined) next.color = patch.color;
      const movesInTime =
        patch.dayIndex !== undefined ||
        patch.endDayIndex !== undefined ||
        patch.startMin !== undefined ||
        patch.endMin !== undefined;
      const col = patch.dayIndex ?? placed.dayIndex;
      if (movesInTime) {
        if (placed.allDay) {
          next.start = dateOnlyAt(view, col);
          next.end = dateOnlyAfter(view, patch.endDayIndex ?? placed.endDayIndex);
        } else if (placed.segment.n > 1) {
          // one day of a cross-midnight event: same delta/edge rules as the drag commits
          const first = placed.segment.i === 0;
          const last = placed.segment.i === placed.segment.n - 1;
          const startEdgeOnly =
            patch.startMin !== undefined &&
            patch.endMin === undefined &&
            patch.dayIndex === undefined;
          const endEdgeOnly =
            patch.endMin !== undefined &&
            patch.startMin === undefined &&
            patch.dayIndex === undefined;
          if (startEdgeOnly || endEdgeOnly) {
            if (startEdgeOnly && !first) return;
            if (endEdgeOnly && !last) return;
            next.start = startEdgeOnly
              ? instantAt(view, placed.dayIndex, patch.startMin!, zone)
              : placed.start;
            next.end = endEdgeOnly
              ? instantAt(view, placed.dayIndex, patch.endMin!, zone)
              : placed.end;
          } else {
            const delta =
              (col - placed.dayIndex) * MINUTES_PER_DAY +
              ((patch.startMin ?? placed.startMin) - placed.startMin);
            if (delta === 0) return;
            next.start = instantPlus(placed.start, delta, zone);
            next.end = instantPlus(next.start, wallDuration(placed, zone), zone);
          }
        } else {
          next.start = instantAt(view, col, patch.startMin ?? placed.startMin, zone);
          next.end = instantAt(view, col, patch.endMin ?? placed.endMin, zone);
        }
      }
      const resizeOnly =
        patch.startMin === undefined && patch.endMin !== undefined && patch.dayIndex === undefined;
      if (movesInTime) {
        const target = placed.allDay
          ? allDaySlot(view, col, patch.endDayIndex ?? placed.endDayIndex)
          : timedWindow(next.start as string, next.end as string);
        const origin = placed.allDay
          ? allDaySlot(view, placed.dayIndex, placed.endDayIndex)
          : timedWindow(placed.start, placed.end);
        if (refuse(resizeOnly ? "resize" : "move", target, origin, placed.source)) return;
      }
      // the announcement is handed to the commit, which may be deferred behind the scope dialog
      const say =
        patch.color !== undefined
          ? announceColor([placed.source], patch.color)
          : !movesInTime
            ? undefined
            : placed.allDay
              ? announceMoved(
                  placed.source,
                  whenOf({
                    dayIndex: col,
                    endDayIndex: patch.endDayIndex ?? placed.endDayIndex,
                    allDay: true,
                  }),
                )
              : resizeOnly
                ? announceResized(placed.source, {
                    time: g.formatRange(placed.startMin, patch.endMin!),
                  })
                : announceMoved(
                    placed.source,
                    whenOf(
                      placed.segment.n > 1
                        ? landedWhen(
                            placed,
                            zone,
                            { dayIndex: col, startMin: patch.startMin ?? placed.startMin },
                            wallDuration(placed, zone),
                          )
                        : {
                            dayIndex: col,
                            startMin: patch.startMin ?? placed.startMin,
                            endMin: patch.endMin ?? placed.endMin,
                          },
                    ),
                  );
      void commitPlacement(id, next, say);
    },
    [projectedRef, view, zone, commitPlacement, whenOf, g],
  );

  return useMemo(
    () => ({
      commitPlacement,
      commitCreate,
      commitMove,
      commitResize,
      commitSpan,
      commitDuplicate,
      toggleAllDay,
      moveByDays,
      keyboardPatch,
    }),
    [
      commitPlacement,
      commitCreate,
      commitMove,
      commitResize,
      commitSpan,
      commitDuplicate,
      toggleAllDay,
      moveByDays,
      keyboardPatch,
    ],
  );
}

export type PlacementCommits = ReturnType<typeof usePlacementCommits>;
