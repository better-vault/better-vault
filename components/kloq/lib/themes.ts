import { prefersReducedMotion } from "./springs";
/** kloq themes — metadata and apply/persist for the `[data-kloq-theme]` token blocks in CSS. */

import { storageEnabled, storageKey } from "./storage";

/** Default keys; `configureStorage()` re-prefixes them. */
export const THEME_STORAGE_KEY = "kloq-theme";
export const SCHEME_STORAGE_KEY = "kloq-scheme";

export interface KloqTheme {
  id: string;
  name: string;
  /** picker chip colors: [background, primary, accent] */
  swatch: [string, string, string];
  /** "editor" = a port of a well-known code-editor theme; "saas" = the look of a well-known product, rebuilt from its public CSS */
  family: "coss" | "editor" | "saas";
  /** the scheme the theme was designed in — the picker leads with it */
  origin?: "light" | "dark";
  credit?: string;
}

export const THEMES: KloqTheme[] = [
  { id: "coss", name: "Coss", family: "coss", swatch: ["#ffffff", "#262626", "#a3a3a3"] },
  {
    id: "midnight",
    name: "Midnight",
    family: "coss",
    origin: "dark",
    swatch: ["#0a0f1e", "#6366f1", "#38bdf8"],
  },
  { id: "paper", name: "Paper", family: "coss", swatch: ["#f7f2e9", "#3f3428", "#b45309"] },
  { id: "forest", name: "Forest", family: "coss", swatch: ["#f4f7f4", "#166534", "#65a30d"] },
  {
    id: "ultraviolet",
    name: "Ultraviolet",
    family: "coss",
    swatch: ["#f5f1fe", "#7c3aed", "#d946ef"],
  },
  {
    id: "terminal",
    name: "Terminal",
    family: "coss",
    origin: "dark",
    swatch: ["#0a0f0a", "#22c55e", "#86efac"],
  },
  { id: "rose", name: "Rosé", family: "coss", swatch: ["#fdf4f6", "#be185d", "#fb7185"] },

  // editor ports: published palettes mapped onto coss tokens in styles/kloq.css
  {
    id: "dracula",
    name: "Dracula",
    family: "editor",
    origin: "dark",
    credit: "Dracula / Alucard",
    swatch: ["#282a36", "#bd93f9", "#ff79c6"],
  },
  {
    id: "nord",
    name: "Nord",
    family: "editor",
    origin: "dark",
    credit: "Nord",
    swatch: ["#2e3440", "#88c0d0", "#81a1c1"],
  },
  {
    id: "tokyo-night",
    name: "Tokyo Night",
    family: "editor",
    origin: "dark",
    credit: "Tokyo Night / Day",
    swatch: ["#1a1b26", "#7aa2f7", "#bb9af7"],
  },
  {
    id: "catppuccin",
    name: "Catppuccin",
    family: "editor",
    origin: "dark",
    credit: "Catppuccin Mocha / Latte",
    swatch: ["#1e1e2e", "#cba6f7", "#89b4fa"],
  },
  {
    id: "gruvbox",
    name: "Gruvbox",
    family: "editor",
    origin: "dark",
    credit: "Gruvbox",
    swatch: ["#282828", "#fabd2f", "#83a598"],
  },
  {
    id: "solarized",
    name: "Solarized",
    family: "editor",
    origin: "light",
    credit: "Solarized",
    swatch: ["#fdf6e3", "#268bd2", "#2aa198"],
  },
  {
    id: "one",
    name: "One",
    family: "editor",
    origin: "dark",
    credit: "One Dark / One Light",
    swatch: ["#282c34", "#61afef", "#c678dd"],
  },

  // saas looks: radius, borders, shadow stacks and type measured from each product's public site
  {
    id: "calcom",
    name: "Cal.com",
    family: "saas",
    origin: "light",
    credit: "Cal.com",
    swatch: ["#ffffff", "#111827", "#6b7280"],
  },
  {
    id: "graphite",
    name: "Graphite",
    family: "saas",
    origin: "dark",
    credit: "Inspired by Linear",
    swatch: ["#08090a", "#5e6ad2", "#8a8f98"],
  },
  {
    id: "ember",
    name: "Ember",
    family: "saas",
    origin: "dark",
    credit: "Inspired by Raycast",
    swatch: ["#07080a", "#e6e6e6", "#ff6363"],
  },
  {
    id: "geist",
    name: "Geist",
    family: "saas",
    origin: "dark",
    credit: "Inspired by Vercel",
    swatch: ["#000000", "#ededed", "#0070f3"],
  },
  {
    id: "ivory",
    name: "Ivory",
    family: "saas",
    origin: "light",
    credit: "Inspired by ChatGPT",
    swatch: ["#f9f9f9", "#0d0d0d", "#b4b4b4"],
  },
];

// What the last setter asked for and <html> does not show yet: a view transition
// writes the DOM a frame later, the getters answer from here in the meantime.
let pendingTheme: string | null = null;
let pendingDark: boolean | null = null;

function flushPending(): void {
  const root = document.documentElement;
  if (pendingTheme !== null) {
    if (pendingTheme === "coss") root.removeAttribute("data-kloq-theme");
    else root.setAttribute("data-kloq-theme", pendingTheme);
    pendingTheme = null;
  }
  if (pendingDark !== null) {
    root.classList.toggle("dark", pendingDark);
    pendingDark = null;
  }
}

export function getTheme(): string {
  if (typeof document === "undefined") return "coss";
  return pendingTheme ?? document.documentElement.getAttribute("data-kloq-theme") ?? "coss";
}

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => { finished: Promise<void>; ready?: Promise<void> };
};

/**
 * Runs `apply` inside one root view transition, so a theme or scheme swap is a single crossfade.
 * Where the API is missing or motion is reduced, `apply` runs synchronously.
 */
export function themeTransition(apply: () => void): void {
  const doc = document as ViewTransitionDocument;
  if (typeof doc.startViewTransition !== "function" || prefersReducedMotion()) {
    apply();
    return;
  }
  const root = document.documentElement;
  root.setAttribute("data-kloq-swapping", "");
  const done = () => root.removeAttribute("data-kloq-swapping");
  try {
    const transition = doc.startViewTransition(apply);
    // A transition skipped for the next one (a quick second swap) rejects `ready` with an
    // AbortError; `apply` still runs, so there's nothing to handle.
    transition.ready?.catch(() => {});
    transition.finished.then(done, done);
  } catch {
    done();
    apply();
  }
}

/**
 * Applies a theme: stamps <html data-kloq-theme>, persists, and crossfades unless motion is reduced.
 * `getTheme()` and storage reflect it as soon as this returns; under a crossfade the attribute
 * itself lands a frame later.
 */
export function setTheme(id: string): void {
  pendingTheme = id;
  themeTransition(flushPending);

  if (!storageEnabled()) return;
  try {
    if (id === "coss") localStorage.removeItem(storageKey("theme"));
    else localStorage.setItem(storageKey("theme"), id);
  } catch {
    /* storage unavailable */
  }
}

// colour scheme: `.dark` on <html> is the coss convention; only touched once `setScheme` is called

export type KloqScheme = "light" | "dark" | "system";

const systemPrefersDark = () =>
  typeof matchMedia !== "undefined" && matchMedia("(prefers-color-scheme: dark)").matches;

export function getScheme(): KloqScheme {
  if (!storageEnabled()) return "system";
  try {
    const s = localStorage.getItem(storageKey("scheme"));
    return s === "light" || s === "dark" ? s : "system";
  } catch {
    return "system";
  }
}

/** What's actually on screen — "system" collapsed to light or dark. */
export function resolveScheme(pref: KloqScheme = getScheme()): "light" | "dark" {
  return pref === "system" ? (systemPrefersDark() ? "dark" : "light") : pref;
}

/** Applies a scheme; "system" clears the stored preference and follows the OS. Synchronous like `setTheme`. */
export function setScheme(pref: KloqScheme): void {
  pendingDark = resolveScheme(pref) === "dark";
  themeTransition(flushPending);

  if (!storageEnabled()) return;
  try {
    if (pref === "system") localStorage.removeItem(storageKey("scheme"));
    else localStorage.setItem(storageKey("scheme"), pref);
  } catch {
    /* storage unavailable */
  }
}

export function toggleScheme(): "light" | "dark" {
  const next = resolveScheme() === "dark" ? "light" : "dark";
  setScheme(next);
  return next;
}

/** Re-applies on OS scheme changes while the preference is "system". Returns an unsubscribe. */
export function watchSystemScheme(): () => void {
  const mq = matchMedia("(prefers-color-scheme: dark)");
  const onChange = () => {
    if (getScheme() === "system") document.documentElement.classList.toggle("dark", mq.matches);
  };
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

/** Pre-paint restore of both theme and scheme for a storage prefix, to inline in `<head>`. */
export function themeRestoreScript(prefix = "kloq"): string {
  const theme = JSON.stringify(`${prefix}-theme`);
  const scheme = JSON.stringify(`${prefix}-scheme`);
  return `try{var d=document.documentElement;var t=localStorage.getItem(${theme});if(t)d.setAttribute("data-kloq-theme",t);var s=localStorage.getItem(${scheme});var m=window.matchMedia("(prefers-color-scheme: dark)").matches;if(s==="dark"||(s!=="light"&&m))d.classList.add("dark")}catch(e){}`;
}

/** `themeRestoreScript()` for the default prefix. */
export const THEME_RESTORE_SCRIPT = themeRestoreScript();
