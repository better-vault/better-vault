import type { EventColor } from "./calendar-types";

/**
 * Event tint palette. `ink` sets `--kloq-event-ink`, which {@link EVENT_TEXT_CSS} mixes against;
 * the classes are literal because Tailwind's scanner cannot see template literals.
 */
export const EVENT_COLORS: Record<
  EventColor,
  {
    tint: string;
    bar: string;
    /** @deprecated unused by the built-in blocks; no contrast guarantee */
    text: string;
    ink: string;
    solid: string;
    ring: string;
  }
> = {
  blue: {
    tint: "bg-blue-500/12 hover:bg-blue-500/18 dark:bg-blue-400/16 dark:hover:bg-blue-400/22",
    bar: "bg-blue-500 dark:bg-blue-400",
    text: "text-blue-800 dark:text-blue-200",
    ink: "[--kloq-event-ink:var(--color-blue-950)] dark:[--kloq-event-ink:var(--color-blue-100)]",
    solid: "var(--color-blue-500)",
    ring: "ring-blue-500/70 dark:ring-blue-400/70",
  },
  violet: {
    tint: "bg-violet-500/12 hover:bg-violet-500/18 dark:bg-violet-400/16 dark:hover:bg-violet-400/22",
    bar: "bg-violet-500 dark:bg-violet-400",
    text: "text-violet-800 dark:text-violet-200",
    ink: "[--kloq-event-ink:var(--color-violet-950)] dark:[--kloq-event-ink:var(--color-violet-100)]",
    solid: "var(--color-violet-500)",
    ring: "ring-violet-500/70 dark:ring-violet-400/70",
  },
  emerald: {
    tint: "bg-emerald-500/12 hover:bg-emerald-500/18 dark:bg-emerald-400/16 dark:hover:bg-emerald-400/22",
    bar: "bg-emerald-500 dark:bg-emerald-400",
    text: "text-emerald-800 dark:text-emerald-200",
    ink: "[--kloq-event-ink:var(--color-emerald-950)] dark:[--kloq-event-ink:var(--color-emerald-100)]",
    solid: "var(--color-emerald-500)",
    ring: "ring-emerald-500/70 dark:ring-emerald-400/70",
  },
  amber: {
    tint: "bg-amber-500/14 hover:bg-amber-500/20 dark:bg-amber-400/16 dark:hover:bg-amber-400/22",
    bar: "bg-amber-500 dark:bg-amber-400",
    text: "text-amber-800 dark:text-amber-200",
    ink: "[--kloq-event-ink:var(--color-amber-950)] dark:[--kloq-event-ink:var(--color-amber-100)]",
    solid: "var(--color-amber-500)",
    ring: "ring-amber-500/70 dark:ring-amber-400/70",
  },
  rose: {
    tint: "bg-rose-500/12 hover:bg-rose-500/18 dark:bg-rose-400/16 dark:hover:bg-rose-400/22",
    bar: "bg-rose-500 dark:bg-rose-400",
    text: "text-rose-800 dark:text-rose-200",
    ink: "[--kloq-event-ink:var(--color-rose-950)] dark:[--kloq-event-ink:var(--color-rose-100)]",
    solid: "var(--color-rose-500)",
    ring: "ring-rose-500/70 dark:ring-rose-400/70",
  },
};

export const EVENT_COLOR_KEYS = Object.keys(EVENT_COLORS) as EventColor[];

/** Ramp steps the `ink` classes must use, per scheme. */
export const EVENT_INK_STEPS = { light: 950, dark: 100 } as const;

/** Share of the ink in the title colour; the rest is `--foreground`. */
export const EVENT_INK_MIX = 0.7;
/** Share of the title colour kept in the time line; 0.9 is as far as it fades before the worst pairing misses AA. */
export const EVENT_TIME_KEEP = 0.9;

/** The event title's colour. */
export const EVENT_TEXT_CSS = `color-mix(in oklab, var(--kloq-event-ink) ${Math.round(
  EVENT_INK_MIX * 100,
)}%, var(--foreground))`;

/** The time line — the same hue, one step quieter. */
export const EVENT_TIME_CSS = `color-mix(in oklab, ${EVENT_TEXT_CSS} ${Math.round(
  EVENT_TIME_KEEP * 100,
)}%, var(--background))`;

/** One `bg-<ramp>/<alpha>` layer. */
interface TintLayer {
  /** e.g. `blue-500` */
  ramp: string;
  /** 0–1 */
  alpha: number;
}

interface TintSpec {
  rest: TintLayer;
  hover: TintLayer;
}

const TINT_RE = /^(dark:)?(hover:)?bg-([a-z]+-\d+)\/(\d+)$/;
const INK_RE = /^(dark:)?\[--kloq-event-ink:var\(--color-([a-z]+-\d+)\)\]$/;

/** Read the tint back out of the Tailwind class string, so the contrast test scores what is painted. */
export function parseTint(className: string): Record<"light" | "dark", TintSpec> {
  const out: Record<string, Partial<TintSpec>> = { light: {}, dark: {} };
  for (const token of className.split(/\s+/).filter(Boolean)) {
    const m = TINT_RE.exec(token);
    if (!m) continue;
    const [, dark, hover, ramp, alpha] = m;
    out[dark ? "dark" : "light"][hover ? "hover" : "rest"] = {
      ramp,
      alpha: Number(alpha) / 100,
    };
  }
  for (const scheme of ["light", "dark"] as const) {
    if (!out[scheme].rest) throw new Error(`tint: no rest layer for ${scheme} in "${className}"`);
    out[scheme].hover ??= out[scheme].rest;
  }
  return out as Record<"light" | "dark", TintSpec>;
}

/** Which ramp step each scheme's `ink` class resolves to. */
export function parseInk(className: string): Record<"light" | "dark", string> {
  const out: Partial<Record<"light" | "dark", string>> = {};
  for (const token of className.split(/\s+/).filter(Boolean)) {
    const m = INK_RE.exec(token);
    if (!m) continue;
    out[m[1] ? "dark" : "light"] = m[2];
  }
  if (!out.light || !out.dark) throw new Error(`ink: missing a scheme in "${className}"`);
  return out as Record<"light" | "dark", string>;
}
