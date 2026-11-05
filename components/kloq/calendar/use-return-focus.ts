import { useEffect, useState } from "react";

const POPUP = "[data-slot$='-popup']";
// an overlay that is open now, or the event panel: focus there was put there on purpose
const TAKEN = "[data-slot$='-popup']:not([data-closed]), [data-event-panel]";
let lastOutside: HTMLElement | null = null;

function track(e: FocusEvent) {
  const el = e.target as HTMLElement | null;
  if (el && !el.closest(POPUP)) lastOutside = el;
}

/**
 * `finalFocus` for a dialog opened without a trigger: whatever held focus before it
 * opened. It stands down when something else has taken focus since.
 */
export function useReturnFocus(open: boolean | undefined): () => HTMLElement | boolean {
  const [wasOpen, setWasOpen] = useState(false);
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    document.addEventListener("focusin", track);
    return () => document.removeEventListener("focusin", track);
  }, []);

  if (Boolean(open) !== wasOpen) {
    setWasOpen(Boolean(open));
    if (open && typeof document !== "undefined") {
      const active = document.activeElement as HTMLElement | null;
      setTarget(
        active && active !== document.body && !active.closest(POPUP) ? active : lastOutside,
      );
    }
  }
  return () => {
    const active = document.activeElement as HTMLElement | null;
    if (active?.closest(TAKEN)) return false;
    return target?.isConnected ? target : true;
  };
}
