"use client";

import { createContext, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { themeStorageKey } from "@/lib/theme/script";

export type Theme = "system" | "light" | "dark";

interface ThemeState {
  theme: Theme;
  /** What is shown: the system's choice when the theme is "system". */
  resolvedTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeState | null>(null);
const CHANGE = "better-vault:theme-change";

function readTheme(): Theme {
  try {
    const saved = window.localStorage.getItem(themeStorageKey);
    return saved === "light" || saved === "dark" ? saved : "system";
  } catch {
    return "system";
  }
}

function subscribeTheme(onChange: () => void) {
  window.addEventListener(CHANGE, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE, onChange);
    window.removeEventListener("storage", onChange);
  };
}

const darkQuery = () => window.matchMedia("(prefers-color-scheme: dark)");

function subscribeSystem(onChange: () => void) {
  const query = darkQuery();
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** Light, dark or the system's choice, remembered in this browser. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useSyncExternalStore(subscribeTheme, readTheme, () => "system" as Theme);
  const systemDark = useSyncExternalStore(subscribeSystem, () => darkQuery().matches, () => false);
  const resolvedTheme = theme === "system" ? (systemDark ? "dark" : "light") : theme;

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", resolvedTheme === "dark");
    root.style.colorScheme = resolvedTheme;
  }, [resolvedTheme]);

  const value = useMemo<ThemeState>(
    () => ({
      theme,
      resolvedTheme,
      setTheme: (next) => {
        try {
          window.localStorage.setItem(themeStorageKey, next);
        } catch {
          // Storage can be blocked; the choice then lasts for this page only.
        }
        window.dispatchEvent(new Event(CHANGE));
      },
    }),
    [theme, resolvedTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeState {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside <ThemeProvider>.");
  return context;
}
