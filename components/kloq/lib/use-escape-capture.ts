import { useEffect } from "react";

/** Capture-phase Escape while `active`, so a portaled popup wins over the calendar's own handler. */
export function useEscapeCapture(active: boolean, onEscape: () => void): void {
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      onEscape();
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [active, onEscape]);
}
