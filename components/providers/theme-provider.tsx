import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { accentStorageKey, accents, themeStorageKey, type Accent } from "@/lib/theme/script";

export type Theme = "system" | "light" | "dark";

interface ThemeState {
  theme: Theme;
  /** What is shown: the system's choice when the theme is "system". */
  resolvedTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
  /** The primary colour. */
  accent: Accent;
  setAccent: (accent: Accent) => void;
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

function readAccent(): Accent {
  try {
    const saved = window.localStorage.getItem(accentStorageKey);
    return (accents as readonly string[]).includes(saved ?? "") ? (saved as Accent) : "default";
  } catch {
    return "default";
  }
}

function save(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage can be blocked; the choice then lasts for this page only.
  }
  window.dispatchEvent(new Event(CHANGE));
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
  const systemDark = useSyncExternalStore(
    subscribeSystem,
    () => darkQuery().matches,
    () => false,
  );
  const accent = useSyncExternalStore(subscribeTheme, readAccent, () => "default" as Accent);
  const resolvedTheme = theme === "system" ? (systemDark ? "dark" : "light") : theme;

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", resolvedTheme === "dark");
    root.style.colorScheme = resolvedTheme;
  }, [resolvedTheme]);

  useEffect(() => {
    const root = document.documentElement;
    if (accent === "default") delete root.dataset.accent;
    else root.dataset.accent = accent;
  }, [accent]);

  const value = useMemo<ThemeState>(
    () => ({
      theme,
      resolvedTheme,
      setTheme: (next) => save(themeStorageKey, next),
      accent,
      setAccent: (next) => save(accentStorageKey, next),
    }),
    [theme, resolvedTheme, accent],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeState {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside <ThemeProvider>.");
  return context;
}
