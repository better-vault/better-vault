import { type Instant, type PlacedEvent, type PlacementId, parseInstant } from "./calendar-types";
import { masterIdOf, occurrenceStartOf, withoutSegment } from "./recurrence";

/** The event id behind a placement, `@segment` suffix removed (guarded on `segment.n`, not the string). */
export const eventKeyOf = (e: PlacedEvent): string =>
  e.segment.n > 1 ? withoutSegment(e.id) : e.id;

/** An ordered (insertion-order), deduped set of event ids plus its two cursors. */
export interface SelectionState {
  readonly ids: readonly string[];
  /** the pivot ⇧-click extends from */
  readonly anchor: string | null;
  /** the most recently touched id — the panel target */
  readonly lead: string | null;
}

export const EMPTY_SELECTION: SelectionState = Object.freeze({
  ids: Object.freeze([]) as readonly string[],
  anchor: null,
  lead: null,
});

/** Modifier keys, normalised: ⌘/Ctrl toggles, ⇧ extends from the anchor. */
export interface SelectionModifiers {
  toggle?: boolean;
  range?: boolean;
}

const uniq = (ids: readonly string[]): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
};

/** Build a selection from an id list. The last id becomes both cursors. */
export function selectionFrom(
  ids: readonly string[],
  cursors?: { anchor?: string | null; lead?: string | null },
): SelectionState {
  const next = uniq(ids);
  if (next.length === 0) return EMPTY_SELECTION;
  const last = next[next.length - 1]!;
  const has = (id: string | null | undefined) => (id != null && next.includes(id) ? id : null);
  return {
    ids: next,
    anchor: has(cursors?.anchor) ?? last,
    lead: has(cursors?.lead) ?? last,
  };
}

export const isSelected = (sel: SelectionState, id: string): boolean => sel.ids.includes(id);

export const selectionSize = (sel: SelectionState): number => sel.ids.length;

export const isMultiSelection = (sel: SelectionState): boolean => sel.ids.length > 1;

/** 1-based position of `id` in the selection ("2 of 3 selected"); `0` when not selected. */
export const selectionIndex = (sel: SelectionState, id: string): number => sel.ids.indexOf(id) + 1;

export function selectOnly(id: string | null): SelectionState {
  return id === null ? EMPTY_SELECTION : { ids: [id], anchor: id, lead: id };
}

export function replaceSelection(ids: readonly string[]): SelectionState {
  return selectionFrom(ids);
}

export const clearSelection = (): SelectionState => EMPTY_SELECTION;

/** Add ids, keeping existing order; the last added becomes the lead. */
export function addToSelection(sel: SelectionState, ids: readonly string[]): SelectionState {
  if (ids.length === 0) return sel;
  const next = uniq([...sel.ids, ...ids]);
  if (next.length === sel.ids.length && sel.lead === ids[ids.length - 1]) return sel;
  const last = ids[ids.length - 1]!;
  return { ids: next, anchor: sel.anchor ?? last, lead: last };
}

/** Remove ids. A removed cursor falls back to the last surviving id, never dangles. */
export function removeFromSelection(sel: SelectionState, ids: readonly string[]): SelectionState {
  if (ids.length === 0) return sel;
  const drop = new Set(ids);
  const next = sel.ids.filter((id) => !drop.has(id));
  if (next.length === sel.ids.length) return sel;
  return selectionFrom(next, { anchor: sel.anchor, lead: sel.lead });
}

/** ⌘/Ctrl-click: flip one id's membership, and make it the new pivot. */
export function toggleSelection(sel: SelectionState, id: string): SelectionState {
  if (!isSelected(sel, id)) return addToSelection(sel, [id]);
  const next = sel.ids.filter((x) => x !== id);
  if (next.length === 0) return EMPTY_SELECTION;
  return selectionFrom(next, { anchor: sel.anchor, lead: sel.lead });
}

/** ⇧-click: the inclusive run from anchor to `id` in `order`; no anchor or unknown id → plain click. */
export function extendSelection(
  sel: SelectionState,
  id: string,
  order: readonly string[],
): SelectionState {
  const anchor = sel.anchor;
  if (anchor === null) return selectOnly(id);
  const a = order.indexOf(anchor);
  const b = order.indexOf(id);
  if (a < 0 || b < 0) return selectOnly(id);
  const [lo, hi] = a <= b ? [a, b] : [b, a];
  const run = order.slice(lo, hi + 1);
  // anchor preserved so a second ⇧-click re-extends from the original pivot
  return { ids: run, anchor, lead: id };
}

export function applySelectionClick(
  sel: SelectionState,
  id: string,
  mods: SelectionModifiers,
  order: readonly string[],
): SelectionState {
  if (mods.range) return extendSelection(sel, id, order);
  if (mods.toggle) return toggleSelection(sel, id);
  return selectOnly(id);
}

/** ⌘A — everything currently on screen, in reading order. */
export function selectAll(order: readonly string[]): SelectionState {
  return selectionFrom(order);
}

/** Rewrite re-keyed placement ids via `resolve` (`undefined` = leave). Same object when unchanged. */
export function remapSelection(
  sel: SelectionState,
  resolve: (id: string) => string | undefined,
): SelectionState {
  let changed = false;
  const map = (id: string): string => {
    const next = resolve(id);
    if (next !== undefined && next !== id) {
      changed = true;
      return next;
    }
    return id;
  };
  const ids = sel.ids.map(map);
  const anchor = sel.anchor === null ? null : map(sel.anchor);
  const lead = sel.lead === null ? null : map(sel.lead);
  return changed ? selectionFrom(ids, { anchor, lead }) : sel;
}

/**
 * The placement of the same series closest to `near` — where a selection lands
 * when a rule edit renames its occurrence (`id` → `id#instant`) or removes it.
 */
export function nearestOfSeries(
  events: readonly PlacedEvent[],
  id: string,
  near: Instant | null,
): PlacementId | undefined {
  const master = masterIdOf(id);
  const at = near === null ? null : parseInstant(near);
  let best: PlacementId | undefined;
  let bestGap = Infinity;
  for (const e of events) {
    if (masterIdOf(e.id) !== master) continue;
    const start = occurrenceStartOf(e.id) ?? e.source.start;
    const gap = at === null ? 0 : Math.abs(parseInstant(start) - at);
    if (gap < bestGap) {
      best = e.id;
      bestGap = gap;
    }
  }
  return best;
}

/** Drop ids no longer in `existing`. Returns the SAME object when nothing changed. */
export function retainSelection(sel: SelectionState, existing: Iterable<string>): SelectionState {
  const live = existing instanceof Set ? existing : new Set(existing);
  const next = sel.ids.filter((id) => live.has(id));
  if (next.length === sel.ids.length) return sel;
  if (next.length === 0) return EMPTY_SELECTION;
  return selectionFrom(next, { anchor: sel.anchor, lead: sel.lead });
}

/** Reading order: column, all-day first, start, end, id. One entry per EVENT (first segment only). */
export function selectionOrder(events: readonly PlacedEvent[]): PlacementId[] {
  const seen = new Set<string>();
  const out: PlacementId[] = [];
  for (const e of [...events].sort(
    (a, b) =>
      a.dayIndex - b.dayIndex ||
      Number(b.allDay) - Number(a.allDay) ||
      a.startMin - b.startMin ||
      a.endMin - b.endMin ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  )) {
    const key = eventKeyOf(e);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e.id);
  }
  return out;
}

/** Canvas pixels; not required to be normalised. */
export interface MarqueeRect {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** Canvas geometry the hit test needs — the same numbers the grid draws with. */
export interface MarqueeGeometry {
  dayCount: number;
  width: number;
  minutesToPx: (min: number) => number;
}

const norm = (r: MarqueeRect): MarqueeRect => ({
  x1: Math.min(r.x1, r.x2),
  y1: Math.min(r.y1, r.y2),
  x2: Math.max(r.x1, r.x2),
  y2: Math.max(r.y1, r.y2),
});

/** Ids whose blocks the marquee intersects (full column cell, not overlap slice). One id per EVENT. */
export function eventsInMarquee(
  rect: MarqueeRect,
  events: readonly PlacedEvent[],
  geom: MarqueeGeometry,
): string[] {
  const r = norm(rect);
  if (r.x2 - r.x1 <= 0 && r.y2 - r.y1 <= 0) return [];
  const colWidth = geom.dayCount > 0 ? geom.width / geom.dayCount : 0;
  const hit: string[] = [];
  const seen = new Set<string>();
  for (const e of events) {
    if (e.allDay) continue;
    const left = e.dayIndex * colWidth;
    const right = (e.endDayIndex + 1) * colWidth;
    if (right <= r.x1 || left >= r.x2) continue;
    const top = geom.minutesToPx(e.startMin);
    const bottom = geom.minutesToPx(e.endMin);
    if (bottom <= r.y1 || top >= r.y2) continue;
    const key = eventKeyOf(e);
    if (seen.has(key)) continue;
    seen.add(key);
    hit.push(e.id);
  }
  return hit;
}
