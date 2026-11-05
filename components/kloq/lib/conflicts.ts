import { attendeeStatus, emailKey } from "./attendees";
import { type CalEvent, isBusy, isDateOnly, parseInstant } from "./calendar-types";
import { eventTitle } from "./event-text";

/** Half-open epoch-ms range: `[start, end)`. */
export interface EventInterval {
  start: number;
  end: number;
}

/** An event's occupied time, or `null` if its instants don't parse or `end <= start`. */
export function eventInterval(event: CalEvent): EventInterval | null {
  const start = parseInstant(event.start);
  const end = parseInstant(event.end);
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  if (end <= start) return null;
  return { start, end };
}

/** Half-open overlap: touching is not overlapping. */
export function intervalsOverlap(a: EventInterval, b: EventInterval): boolean {
  return a.start < b.end && b.start < a.end;
}

/** Milliseconds two intervals share, or 0. */
export function overlapMs(a: EventInterval, b: EventInterval): number {
  return Math.max(0, Math.min(a.end, b.end) - Math.max(a.start, b.start));
}

/** Stands in for the calendar owner when an event names nobody; `\0`-prefixed so it never collides with an address. */
export const SELF_PARTICIPANT = "\u0000self";

export interface ConflictOptions {
  /** only report a collision when the two events share a person; default `false` */
  requireSharedAttendee?: boolean;
  /** who "you" are: an event you're on and an event with no attendees both count as yours */
  viewer?: string;
  /** whether an all-day event can conflict; default `false` */
  includeAllDay?: boolean;
  /** ignore attendees who declined; default `true` */
  ignoreDeclined?: boolean;
  /** resource views: two events only collide when this says they share a resource (a room, a person) */
  sameResource?: ConflictScope;
}

export type ConflictScope = (a: CalEvent, b: CalEvent) => boolean;

const scopes = new WeakMap<object, ConflictScope[]>();

/**
 * A mounted resource view registers how its store's events share resources.
 * Per store: nothing registered for one calendar is ever consulted for another.
 * Returns the function that takes this registration back out.
 */
export function registerConflictScope(store: object, scope: ConflictScope): () => void {
  const list = scopes.get(store) ?? [];
  scopes.set(store, [...list, scope]);
  return () => {
    const next = (scopes.get(store) ?? []).filter((s) => s !== scope);
    if (next.length) scopes.set(store, next);
    else scopes.delete(store);
  };
}

/** Replace every registration for this store with one scope; `null` clears them. */
export function setConflictScope(store: object, scope: ConflictScope | null): void {
  if (scope) scopes.set(store, [scope]);
  else scopes.delete(store);
}

/** The scope the most recently mounted resource view registered for this store. */
export function conflictScopeOf(store: object): ConflictScope | undefined {
  return scopes.get(store)?.at(-1);
}

function sharesResource(a: CalEvent, b: CalEvent, opts: ConflictOptions): boolean {
  return opts.sameResource ? opts.sameResource(a, b) : true;
}

/** Organiser plus attendees, lowercased; `SELF_PARTICIPANT` (and the viewer) when the event names nobody. */
export function participantsOf(event: CalEvent, opts: ConflictOptions = {}): Set<string> {
  const ignoreDeclined = opts.ignoreDeclined !== false;
  const out = new Set<string>();
  if (event.organizer) out.add(emailKey(event.organizer));
  for (const a of event.attendees ?? []) {
    if (ignoreDeclined && attendeeStatus(a) === "declined") continue;
    out.add(emailKey(a.email));
  }
  if (out.size === 0) {
    out.add(SELF_PARTICIPANT);
    if (opts.viewer) out.add(emailKey(opts.viewer));
  }
  return out;
}

/** Who both events occupy time for, in `a`'s order. */
export function sharedParticipants(a: CalEvent, b: CalEvent, opts: ConflictOptions = {}): string[] {
  const other = participantsOf(b, opts);
  return [...participantsOf(a, opts)].filter((p) => other.has(p));
}

/** Can this event collide with anything at all? */
export function isBlocking(event: CalEvent, opts: ConflictOptions = {}): boolean {
  if (!isBusy(event)) return false;
  if (!opts.includeAllDay && (event.allDay === true || isDateOnly(event.start))) return false;
  return eventInterval(event) !== null;
}

/** Two events, the time they share, and who's double-booked by it. */
export interface ConflictPair {
  a: CalEvent;
  b: CalEvent;
  /** the shared slice, epoch ms, half-open */
  overlap: EventInterval;
  /** who's on both; empty only when `requireSharedAttendee` is off */
  shared: string[];
}

/** Do these two conflict? Same-id pairs never do. */
export function isConflicting(a: CalEvent, b: CalEvent, opts: ConflictOptions = {}): boolean {
  return conflictBetween(a, b, opts) !== null;
}

/** The pair, or `null` if these two don't conflict. */
export function conflictBetween(
  a: CalEvent,
  b: CalEvent,
  opts: ConflictOptions = {},
): ConflictPair | null {
  if (a.id === b.id) return null;
  if (!isBlocking(a, opts) || !isBlocking(b, opts)) return null;
  const ia = eventInterval(a);
  const ib = eventInterval(b);
  if (!ia || !ib || !intervalsOverlap(ia, ib)) return null;
  if (!sharesResource(a, b, opts)) return null;
  const shared = opts.requireSharedAttendee ? sharedParticipants(a, b, opts) : [];
  if (opts.requireSharedAttendee && shared.length === 0) return null;
  return {
    a,
    b,
    overlap: {
      start: Math.max(ia.start, ib.start),
      end: Math.min(ia.end, ib.end),
    },
    shared,
  };
}

/** Every conflicting pair in the list, via a sort-and-sweep; output order is stable. */
export function findConflicts(
  events: readonly CalEvent[],
  opts: ConflictOptions = {},
): ConflictPair[] {
  const blocking = events
    .filter((e) => isBlocking(e, opts))
    .map((e) => ({ event: e, interval: eventInterval(e)! }))
    .sort(
      (x, y) =>
        x.interval.start - y.interval.start ||
        x.interval.end - y.interval.end ||
        x.event.id.localeCompare(y.event.id),
    );

  const out: ConflictPair[] = [];
  const active: typeof blocking = [];
  for (const cur of blocking) {
    for (let i = active.length - 1; i >= 0; i--) {
      if (active[i].interval.end <= cur.interval.start) active.splice(i, 1);
    }
    for (const open of active) {
      const pair = conflictBetween(open.event, cur.event, opts);
      if (pair) out.push(pair);
    }
    active.push(cur);
  }
  return out;
}

/** The events that conflict with `event`, earliest first. `events` may contain `event` itself. */
export function conflictsFor(
  event: CalEvent,
  events: readonly CalEvent[],
  opts: ConflictOptions = {},
): CalEvent[] {
  if (!isBlocking(event, opts)) return [];
  const hits: { e: CalEvent; start: number }[] = [];
  for (const other of events) {
    if (!conflictBetween(event, other, opts)) continue;
    hits.push({ e: other, start: parseInstant(other.start) });
  }
  return hits.sort((x, y) => x.start - y.start || x.e.id.localeCompare(y.e.id)).map((h) => h.e);
}

/** Connected components of the conflict graph, ordered by earliest start; members by start then id. */
export function conflictClusters(
  events: readonly CalEvent[],
  opts: ConflictOptions = {},
): CalEvent[][] {
  const pairs = findConflicts(events, opts);
  if (pairs.length === 0) return [];

  const parent = new Map<string, string>();
  const find = (id: string): string => {
    let root = parent.get(id) ?? id;
    if (root !== id) {
      root = find(root);
      parent.set(id, root);
    }
    return root;
  };
  const union = (x: string, y: string) => {
    const rx = find(x);
    const ry = find(y);
    if (rx !== ry) parent.set(rx, ry);
  };

  const byId = new Map<string, CalEvent>();
  for (const p of pairs) {
    byId.set(p.a.id, p.a);
    byId.set(p.b.id, p.b);
    parent.set(p.a.id, parent.get(p.a.id) ?? p.a.id);
    parent.set(p.b.id, parent.get(p.b.id) ?? p.b.id);
    union(p.a.id, p.b.id);
  }

  const groups = new Map<string, CalEvent[]>();
  for (const [id, event] of byId) {
    const root = find(id);
    const group = groups.get(root);
    if (group) group.push(event);
    else groups.set(root, [event]);
  }

  const startOf = (e: CalEvent) => parseInstant(e.start);
  const clusters = [...groups.values()].map((g) =>
    g.sort((x, y) => startOf(x) - startOf(y) || x.id.localeCompare(y.id)),
  );
  return clusters.sort((x, y) => startOf(x[0]) - startOf(y[0]) || x[0].id.localeCompare(y[0].id));
}

/** "Overlaps Design review" / "Overlaps Design review and 2 others"; `""` for none. */
export function describeConflicts(conflicts: readonly CalEvent[]): string {
  if (conflicts.length === 0) return "";
  const first = eventTitle(conflicts[0]);
  if (conflicts.length === 1) return `Overlaps ${first}`;
  if (conflicts.length === 2) {
    const second = eventTitle(conflicts[1]);
    return `Overlaps ${first} and ${second}`;
  }
  return `Overlaps ${first} and ${conflicts.length - 1} others`;
}
