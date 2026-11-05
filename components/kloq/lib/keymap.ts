export const KEY_ACTIONS = [
  { id: "today", label: "Back to today", group: "Navigate", defaultKey: "t" },
  {
    id: "prev-period",
    label: "Previous range",
    group: "Navigate",
    defaultKey: null,
  },
  {
    id: "next-period",
    label: "Next range",
    group: "Navigate",
    defaultKey: null,
  },
  { id: "view-day", label: "Day view", group: "Navigate", defaultKey: "d" },
  {
    id: "view-3days",
    label: "3-day view",
    group: "Navigate",
    defaultKey: "3",
  },
  { id: "view-week", label: "Week view", group: "Navigate", defaultKey: "w" },
  { id: "view-month", label: "Month view", group: "Navigate", defaultKey: "m" },
  { id: "view-year", label: "Year view", group: "Navigate", defaultKey: "y" },
  {
    id: "view-agenda",
    label: "Schedule view",
    group: "Navigate",
    defaultKey: "a",
  },
  {
    id: "create",
    label: "New event at the next hour",
    group: "Create & edit",
    defaultKey: "c",
  },
  {
    id: "shortcuts",
    label: "Keyboard shortcuts sheet",
    group: "App",
    defaultKey: "?",
  },
] as const;

export type KeyActionId = (typeof KEY_ACTIONS)[number]["id"];

/** Host overrides; `null` = unbound on purpose. Unknown ids and unusable keys are dropped. */
export type Keymap = Partial<Record<KeyActionId, string | null>>;

const RESERVED = new Set([
  "arrowup",
  "arrowdown",
  "arrowleft",
  "arrowright",
  "pageup",
  "pagedown",
  "backspace",
  "delete",
  "escape",
  "enter",
  "tab",
  " ",
]);

export function isBindableKey(key: string): boolean {
  const k = key.toLowerCase();
  if (RESERVED.has(k)) return false;
  return !["shift", "alt", "meta", "control", "os", "dead"].includes(k);
}

/** The binding a captured keypress asks for, or `null` (chorded, reserved, bare modifier). */
export function bindingFromEvent(e: {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
}): string | null {
  if (e.metaKey || e.ctrlKey || e.altKey) return null;
  return isBindableKey(e.key) ? e.key.toLowerCase() : null;
}

export interface ResolvedKeymap {
  byAction: Record<KeyActionId, string | null>;
  byKey: ReadonlyMap<string, KeyActionId>;
}

/**
 * Defaults + overrides → one consistent map. On a key collision the loser is
 * unbound: overrides beat defaults, then table order.
 */
export function resolveKeymap(overrides?: Keymap): ResolvedKeymap {
  const byAction = {} as Record<KeyActionId, string | null>;
  const overridden = new Set<KeyActionId>();

  for (const spec of KEY_ACTIONS) {
    const raw = overrides?.[spec.id];
    if (raw === null) {
      byAction[spec.id] = null;
      overridden.add(spec.id);
    } else if (typeof raw === "string" && isBindableKey(raw)) {
      byAction[spec.id] = raw.toLowerCase();
      overridden.add(spec.id);
    } else {
      byAction[spec.id] = spec.defaultKey;
    }
  }

  // a loser is unbound, not re-defaulted — its default could collide again, transitively
  const byKey = new Map<string, KeyActionId>();
  const tiers: KeyActionId[][] = [[], []];
  for (const spec of KEY_ACTIONS) {
    tiers[overridden.has(spec.id) ? 0 : 1].push(spec.id);
  }
  for (const tier of tiers) {
    for (const id of tier) {
      const key = byAction[id];
      if (key === null) continue;
      if (byKey.has(key)) byAction[id] = null;
      else byKey.set(key, id);
    }
  }

  return { byAction, byKey };
}

/** The action an unmodified keydown fires, or `null`. ⇧+letter never matches — reserved. */
export function actionForEvent(
  e: {
    key: string;
    metaKey: boolean;
    ctrlKey: boolean;
    altKey: boolean;
    shiftKey: boolean;
  },
  resolved: ResolvedKeymap,
): KeyActionId | null {
  if (e.metaKey || e.ctrlKey || e.altKey) return null;
  const key = e.key.toLowerCase();
  if (e.shiftKey && /^[a-z]$/.test(key)) return null;
  return resolved.byKey.get(key) ?? null;
}

export function displayKey(binding: string): string {
  if (binding === " ") return "Space";
  return binding.length === 1 ? binding.toUpperCase() : binding[0].toUpperCase() + binding.slice(1);
}
