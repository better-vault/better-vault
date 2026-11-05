import { useMemo, useSyncExternalStore } from "react";
import type { KloqStore } from "../lib/calendar-store";
import type { CalEvent } from "../lib/calendar-types";
import { parseInstant } from "../lib/calendar-types";
import { type ConflictScope, conflictScopeOf, conflictsFor } from "../lib/conflicts";
import { eventWindow, mayOverlapWindow } from "../lib/event-window";

const NONE: CalEvent[] = [];

// everything but the free text: a conflict never depends on what an event is called
const shape = (e: CalEvent | undefined) =>
  e
    ? JSON.stringify(e, (key, v) =>
        key === "title" || key === "description" || key === "location" || key === "meetingUrl"
          ? undefined
          : v,
      )
    : "";

/** A snapshot reader with its own memory, so the store can be asked on every change for free. */
function conflictSelector(store: KloqStore, id: string, viewer: string | undefined) {
  let seen: readonly CalEvent[] | null = null;
  let own = "";
  let value = NONE;
  let scope: ConflictScope | undefined;
  return () => {
    const events = store.getSnapshot();
    // a resource view on this store narrows a conflict to bookings that share a lane
    const sameResource = conflictScopeOf(store);
    if (events === seen && sameResource === scope) return value;
    const self = events.find((e) => e.id === id);
    const selfShape = shape(self);
    const prev = seen;
    const rescoped = sameResource !== scope;
    seen = events;
    scope = sameResource;
    // the common case while typing: only this event changed, and not in a way that matters
    if (
      !rescoped &&
      prev &&
      prev.length === events.length &&
      selfShape === own &&
      events.every((e, i) => e === prev[i] || e.id === id)
    )
      return value;
    own = selfShape;
    if (!self) return (value = NONE);
    const startMs = parseInstant(self.start);
    const endMs = parseInstant(self.end);
    let nearby = events;
    if (!Number.isNaN(startMs) && !Number.isNaN(endMs)) {
      const w = eventWindow(new Date(startMs), new Date(endMs));
      nearby = events.filter((e) => mayOverlapWindow(e, w));
    }
    const next = conflictsFor(self, nearby, {
      requireSharedAttendee: true,
      viewer,
      sameResource,
    });
    const same = next.length === value.length && next.every((e, i) => e === value[i]);
    if (!same) value = next.length ? next : NONE;
    return value;
  };
}

/**
 * The events that conflict with one event. The scan runs only when something a conflict
 * depends on changed, and the result keeps its identity until its members do — typing a
 * title neither rescans the store nor re-renders through this subscription.
 */
export function useConflicts(store: KloqStore, id: string, viewer: string | undefined): CalEvent[] {
  const getSnapshot = useMemo(() => conflictSelector(store, id, viewer), [store, id, viewer]);
  return useSyncExternalStore(store.subscribe, getSnapshot, () => NONE);
}
