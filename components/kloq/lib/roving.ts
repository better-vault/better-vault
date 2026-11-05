export function rovingTarget(order: readonly string[], lead: string | null): string | null {
  if (lead !== null && order.includes(lead)) return lead;
  return order[0] ?? null;
}

export function rovingTabIndex(order: readonly string[], lead: string | null, id: string): 0 | -1 {
  return rovingTarget(order, lead) === id ? 0 : -1;
}

/** Focus after `removed` are deleted: next survivor after the last removed, else previous; `null` = none. */
export function focusAfterRemoval(
  order: readonly string[],
  removed: readonly string[],
): string | null {
  const gone = new Set(removed);
  const survivors = order.filter((id) => !gone.has(id));
  if (survivors.length === 0) return null;
  let last = -1;
  for (let i = 0; i < order.length; i++) if (gone.has(order[i])) last = i;
  if (last === -1) return null;
  for (let i = last + 1; i < order.length; i++) if (!gone.has(order[i])) return order[i];
  for (let i = last - 1; i >= 0; i--) if (!gone.has(order[i])) return order[i];
  return null;
}

interface FocusGuard {
  ownsFocus: boolean;
  widgetHasFocus: boolean;
  dragging: boolean;
}

export function shouldFollowFocus(g: FocusGuard): boolean {
  return g.ownsFocus && !g.widgetHasFocus && !g.dragging;
}

/** `0` for the roving event, `-1` for the rest, `undefined` when the host opted out. */
export function rovingTab(rovingId: string | null | undefined, id: string): 0 | -1 | undefined {
  return rovingId === undefined ? undefined : rovingId === id ? 0 : -1;
}
