import { type RefObject, useEffect, useLayoutEffect } from "react";
import { downloadICS } from "../lib/ics";
import type { PlacedEvent } from "../lib/placement";
import { useLatest } from "../lib/use-latest";
import { useAnnounce } from "./live-region";

// surfaces above the panel that answer Escape first
const OVERLAY_SELECTOR =
  '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"], [data-popup]';

/** Focus, announcement, focus-restore, Escape and ⌘⇧E for the open panel. */
export function usePanelKeys({
  wrapRef,
  inputRef,
  eventId,
  event,
  isNew,
  readOnly,
  getAnchor,
  onCancel,
}: {
  wrapRef: RefObject<HTMLDivElement | null>;
  inputRef: RefObject<HTMLInputElement | null>;
  eventId: string;
  event: PlacedEvent;
  isNew: boolean;
  readOnly: boolean;
  getAnchor: (id: string) => HTMLElement | null;
  onCancel: () => void;
}) {
  const announce = useAnnounce();
  // only a new event pulls focus; otherwise the grid's roving tabindex keeps it (non-modal)
  useEffect(() => {
    if (!isNew || readOnly) return;
    const t = requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    return () => cancelAnimationFrame(t);
  }, [isNew, eventId, readOnly, inputRef]);

  useEffect(() => {
    if (isNew) return;
    announce("Event details open, press Tab to edit");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // a layout cleanup runs while the panel is still attached: if it held focus, hand it to
  // the block, or to the grid when the event is gone
  const restoreRef = useLatest({ getAnchor, eventId });
  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    return () => {
      const active = document.activeElement;
      if (!wrap || !active || !wrap.contains(active)) return;
      const { getAnchor: get, eventId: id } = restoreRef.current;
      const root = wrap.closest("[data-kloq-root]");
      const next =
        get(id) ??
        root?.querySelector<HTMLElement>('[data-cal-event][tabindex="0"]') ??
        root?.querySelector<HTMLElement>("[role=region][tabindex]");
      next?.focus({ preventScroll: true });
    };
  }, [wrapRef, restoreRef]);

  // Escape abandons; a drag-created event is discarded rather than left untitled
  const cancelRef = useLatest(onCancel);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      const wrap = wrapRef.current;
      const target = e.target as Element | null;
      // topmost surface owns Escape; rrule/reminder fields stop it in capture — stay in bubble phase
      if (target?.closest?.(OVERLAY_SELECTOR) && !(wrap && wrap.contains(target))) return;
      // The panel owns this Escape even when focus remains on a timeline bar.
      // Mark it handled before closing so the calendar's document listener does
      // not see the newly closed panel and clear the selection on the same key.
      e.preventDefault();
      cancelRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [wrapRef, cancelRef]);

  // ⌘⇧E exports the selected event as .ics
  const eventRef = useLatest(event);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "KeyE" && e.shiftKey && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        downloadICS(eventRef.current);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [eventRef]);
}
