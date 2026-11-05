import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import {
  controlledStore,
  InternalStore,
  localStorageAdapter,
  type OnCommit,
  type PersistenceAdapter,
  SEED_EVENTS,
  useStoreEvents,
} from "../lib/calendar-store";
import type { CalEvent } from "../lib/event-types";
import { validateEventIds } from "../lib/ids";

const warned = new Set<string>();
function warnOnce(message: string) {
  if (warned.has(message)) return;
  warned.add(message);
  console.warn(message);
}

export interface EventStoreOptions {
  events?: CalEvent[];
  onEventsChange?: (events: CalEvent[]) => void;
  defaultEvents?: CalEvent[];
  persistence?: false | PersistenceAdapter;
  onCommit?: OnCommit;
  onReverted?: (ids: string[]) => void;
}

export function useEventStore({
  events,
  onEventsChange,
  defaultEvents,
  persistence,
  onCommit,
  onReverted,
}: EventStoreOptions) {
  const controlled = events !== undefined;

  // seam object is stable; its fields track the latest props
  const seam = useRef<{
    onCommit?: OnCommit;
    onReverted?: (ids: string[]) => void;
  }>({}).current;

  const internalRef = useRef<InternalStore | null>(null);
  if (!controlled && internalRef.current === null) {
    internalRef.current = new InternalStore(
      defaultEvents ?? SEED_EVENTS,
      persistence === false ? false : (persistence ?? localStorageAdapter()),
      seam,
    );
  }
  // memoised: a per-render facade would resubscribe `useSyncExternalStore` every host render
  const store = useMemo(
    () =>
      controlled
        ? controlledStore(events!, onEventsChange ?? (() => {}), seam)
        : internalRef.current!,
    [controlled, events, onEventsChange, seam],
  );
  const live = useStoreEvents(store);
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    for (const m of validateEventIds(live)) warnOnce(m);
  }, [live]);
  // mirrored into the seam post-render, never during it (abandoned concurrent renders)
  useEffect(() => {
    seam.onCommit = onCommit;
    seam.onReverted = onReverted;
  });
  // swap in the persisted copy before first paint (uncontrolled only); on the way out, write
  // anything still queued, in a layout cleanup so it lands before a remount hydrates
  useLayoutEffect(() => {
    store.hydrate();
    return () => internalRef.current?.flush();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return { store, events: live, controlled };
}
