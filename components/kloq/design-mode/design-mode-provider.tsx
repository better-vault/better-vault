"use client";

import * as React from "react";
import { craftBus } from "../lib/craft-bus";
import { isTypingEvent, watchKeyboardScope } from "../lib/keyboard-scope";

interface DesignModeContextValue {
  enabled: boolean;
  setEnabled: (on: boolean) => void;
  toggle: () => void;
  /** the calendar this instance belongs to; `null` = the whole page */
  scopeRef: React.RefObject<HTMLElement | null> | null;
}

const DesignModeContext = React.createContext<DesignModeContextValue | null>(null);

export function useDesignMode(): DesignModeContextValue {
  const ctx = React.useContext(DesignModeContext);
  if (!ctx) throw new Error("useDesignMode must be used within <DesignModeProvider>");
  return ctx;
}

interface DesignModeProviderProps {
  children: React.ReactNode;
  /** when given, ⌥D only fires while that subtree owns the keyboard */
  scopeRef?: React.RefObject<HTMLElement | null>;
  /** force ⌥D page-wide; defaults to `true` iff no `scopeRef` */
  globalToggle?: boolean;
}

export function DesignModeProvider({
  children,
  scopeRef,
  globalToggle,
}: DesignModeProviderProps): React.ReactElement {
  const [enabled, setEnabledState] = React.useState(false);

  const setEnabled = React.useCallback((on: boolean) => {
    setEnabledState(on);
  }, []);

  const toggle = React.useCallback(() => {
    setEnabledState((prev) => !prev);
  }, []);

  React.useEffect(() => {
    const root = document.documentElement;
    if (enabled) root.setAttribute("data-design-mode", "true");
    else root.removeAttribute("data-design-mode");
    craftBus.emit({ type: "design-mode", enabled });
  }, [enabled]);

  const isGlobal = globalToggle ?? !scopeRef;
  React.useEffect(() => {
    const scope = watchKeyboardScope(() => scopeRef?.current ?? null);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (!(e.code === "KeyD" && e.altKey && !e.metaKey && !e.ctrlKey)) return;
      // ⌥d types a character on some layouts, so match on `code` and skip while typing
      if (isTypingEvent(e)) return;
      if (!isGlobal && !scope.owns()) return;
      e.preventDefault();
      toggle();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      scope.dispose();
    };
  }, [toggle, scopeRef, isGlobal]);

  const value = React.useMemo(
    () => ({ enabled, setEnabled, toggle, scopeRef: scopeRef ?? null }),
    [enabled, setEnabled, toggle, scopeRef],
  );

  return <DesignModeContext.Provider value={value}>{children}</DesignModeContext.Provider>;
}
