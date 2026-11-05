const TEXT_ENTRY_SELECTOR =
  'input, textarea, select, [contenteditable]:not([contenteditable="false"])';

const WIDGET_ROLES = [
  "textbox",
  "searchbox",
  "spinbutton",
  "combobox",
  "listbox",
  "option",
  "menu",
  "menubar",
  "menuitem",
  "menuitemcheckbox",
  "menuitemradio",
  "grid",
  "gridcell",
  "treegrid",
  "tree",
  "treeitem",
  "tablist",
  "tab",
  "slider",
  "application",
] as const;

export const INTERACTIVE_WIDGET_SELECTOR = [
  TEXT_ENTRY_SELECTOR,
  ...WIDGET_ROLES.map((r) => `[role="${r}"]`),
].join(", ");

interface ClosestLike {
  closest(selector: string): unknown;
}

function asClosestLike(target: unknown): ClosestLike | null {
  // duck-typed: HTMLElement doesn't exist in the node test suite
  return typeof target === "object" &&
    target !== null &&
    typeof (target as ClosestLike).closest === "function"
    ? (target as ClosestLike)
    : null;
}

export function isTypingTarget(target: unknown): boolean {
  const el = asClosestLike(target);
  return el !== null && el.closest(INTERACTIVE_WIDGET_SELECTOR) !== null;
}

/** Event-shaped convenience wrapper; IME composition counts as typing. */
export function isTypingEvent(e: { isComposing?: boolean; target: unknown }): boolean {
  return e.isComposing === true || isTypingTarget(e.target);
}

interface ContainsLike {
  contains(other: unknown): boolean;
}

/** `unowned` = nothing focused (`body`/`null`); see `ownsKeyboard`. */
type ScopeFocus = "inside" | "outside" | "unowned";

export function scopeFocusState(
  root: ContainsLike | null | undefined,
  active: unknown,
  body?: unknown,
  documentElement?: unknown,
): ScopeFocus {
  if (!root) return "outside";
  if (
    active == null ||
    (body !== undefined && active === body) ||
    (documentElement !== undefined && active === documentElement)
  )
    return "unowned";
  return root.contains(active) ? "inside" : "outside";
}

/**
 * `inside` → ours; `outside` → never; `unowned` → only if the last pointer press
 * landed in the root (clicking the non-focusable grid leaves activeElement on body).
 */
export function ownsKeyboard(state: ScopeFocus, pointerInside: boolean): boolean {
  if (state === "inside") return true;
  if (state === "unowned") return pointerInside;
  return false;
}

/** DOM side of `ownsKeyboard`. Capture phase, so a gesture that stops propagation still registers. */
export function watchKeyboardScope(getRoot: () => Element | null): {
  owns: () => boolean;
  dispose: () => void;
} {
  let pointerInside = false;
  const onPointerDown = (e: Event) => {
    const root = getRoot();
    pointerInside = !!root && root.contains(e.target as Node | null);
  };
  document.addEventListener("pointerdown", onPointerDown, true);
  return {
    owns: () => {
      const root = getRoot();
      const state = scopeFocusState(
        root,
        document.activeElement,
        document.body,
        document.documentElement,
      );
      return ownsKeyboard(state, pointerInside);
    },
    dispose: () => document.removeEventListener("pointerdown", onPointerDown, true),
  };
}
