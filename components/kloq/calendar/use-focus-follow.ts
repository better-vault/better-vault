import { type RefObject, useCallback, useEffect, useRef } from "react";
import { announceSelection } from "../lib/announce";
import { INTERACTIVE_WIDGET_SELECTOR } from "../lib/keyboard-scope";
import { nodeFor } from "../lib/recurrence";
import { shouldFollowFocus } from "../lib/roving";

export function useFocusFollow({
  rootRef,
  surfaceRef,
  registry,
  rovingId,
  selectedId,
  count,
  announce,
}: {
  rootRef: RefObject<HTMLElement | null>;
  surfaceRef: RefObject<HTMLElement | null>;
  registry: Map<string, HTMLElement>;
  rovingId: string | null;
  selectedId: string | null;
  count: number;
  announce: (message: string) => void;
}) {
  // move focus to an event, or the surface; guarded so it never steals focus from the host or the panel
  const focusEvent = useCallback(
    (id: string | null) => {
      const active = document.activeElement;
      const root = rootRef.current;
      const ownsFocus = active === null || active === document.body || !!root?.contains(active);
      const widgetHasFocus =
        active instanceof Element && active.closest(INTERACTIVE_WIDGET_SELECTOR) !== null;
      const dragging =
        document.body.hasAttribute("data-cal-grabbing") ||
        document.body.hasAttribute("data-cal-resizing");
      if (!shouldFollowFocus({ ownsFocus, widgetHasFocus, dragging })) return;
      const node = id ? nodeFor(registry, id) : null;
      // `preventScroll`: the keyboard layer already scrolls smoothly; focus scroll would jump first
      (node ?? surfaceRef.current)?.focus({ preventScroll: true });
    },
    [registry, rootRef, surfaceRef],
  );

  // focus follows the roving index
  const lastRoving = useRef<string | null>(null);
  useEffect(() => {
    if (rovingId === lastRoving.current) return;
    lastRoving.current = rovingId;
    if (!rovingId || selectedId !== rovingId) return;
    focusEvent(rovingId);
  }, [rovingId, selectedId, focusEvent]);

  // selection size is announced, not identity — the focused block's name already says which
  const lastCount = useRef(count);
  useEffect(() => {
    if (count === lastCount.current) return;
    const previous = lastCount.current;
    lastCount.current = count;
    if (count > 1 || (previous > 1 && count === 0)) announce(announceSelection(count));
  }, [count, announce]);

  return focusEvent;
}
