import { type KloqView, MIN_N_DAY_VIEW, viewKind } from "./calendar-types";

/** Tailwind's `sm`; below it a week column is ~83px and can't fit time + title on one line. */
export const NARROW_BREAKPOINT = 640;
/** Below this a 7-column week still truncates every title; three days read fine. */
export const MEDIUM_BREAKPOINT = 900;
export const MEDIUM_DAYS = 3;

const NARROW_SAFE_VIEWS: readonly KloqView[] = ["day", "agenda", "month", "year"];

interface ResponsiveConfig {
  breakpoint?: number;
  collapseTo?: KloqView;
  /** width under which a week becomes `mediumDays`; `0` disables the tier */
  mediumBreakpoint?: number;
  mediumDays?: number;
}

export type ResponsiveSetting = boolean | ResponsiveConfig | undefined;

export interface ResolvedResponsive {
  readonly enabled: boolean;
  readonly breakpoint: number;
  readonly collapseTo: KloqView;
  readonly mediumBreakpoint: number;
  readonly mediumDays: number;
}

export const RESPONSIVE_DEFAULT: ResolvedResponsive = {
  enabled: true,
  breakpoint: NARROW_BREAKPOINT,
  collapseTo: "day",
  mediumBreakpoint: MEDIUM_BREAKPOINT,
  mediumDays: MEDIUM_DAYS,
};

export const RESPONSIVE_OFF: ResolvedResponsive = {
  ...RESPONSIVE_DEFAULT,
  enabled: false,
};

export function resolveResponsive(setting: ResponsiveSetting): ResolvedResponsive {
  if (setting === false) return RESPONSIVE_OFF;
  if (setting === undefined || setting === true) return RESPONSIVE_DEFAULT;
  const bp = Number.isFinite(setting.breakpoint)
    ? Math.max(1, setting.breakpoint as number)
    : NARROW_BREAKPOINT;
  const medium = Number.isFinite(setting.mediumBreakpoint)
    ? Math.max(0, setting.mediumBreakpoint as number)
    : MEDIUM_BREAKPOINT;
  const days = Number.isFinite(setting.mediumDays)
    ? Math.max(MIN_N_DAY_VIEW, Math.floor(setting.mediumDays as number))
    : MEDIUM_DAYS;
  const collapseTo =
    setting.collapseTo !== undefined &&
    isNarrowSafe(setting.collapseTo) &&
    setting.collapseTo !== "month" &&
    setting.collapseTo !== "year"
      ? setting.collapseTo
      : "day";
  return {
    enabled: true,
    breakpoint: bp,
    collapseTo,
    mediumBreakpoint: Math.max(bp, medium),
    mediumDays: days,
  };
}

/** Day, agenda, (compact) month and a two-column year read well narrow; a numeric `1` is the day view spelled differently. */
export function isNarrowSafe(view: KloqView | undefined): boolean {
  if (view === undefined) return false;
  if (typeof view === "number") return view < MIN_N_DAY_VIEW;
  return NARROW_SAFE_VIEWS.includes(view);
}

export function isMultiColumn(view: KloqView): boolean {
  const kind = viewKind(view);
  // year included — twelve mini-months are the most column-hungry surface there is
  return kind === "week" || kind === "days" || kind === "month" || kind === "year";
}

export function isNarrow(width: number, cfg: ResolvedResponsive): boolean {
  return Number.isFinite(width) && width > 0 && width < cfg.breakpoint;
}

export interface EffectiveView {
  readonly intent: KloqView;
  readonly effective: KloqView;
  readonly collapsed: boolean;
}

/**
 * Resolve intent + width into the view that renders. An unmeasured box (0, NaN — SSR,
 * `display: none`) is "no opinion", not "narrow", so server and client agree.
 */
export function effectiveView(
  width: number,
  intent: KloqView,
  cfg: ResolvedResponsive,
): EffectiveView {
  const same = { intent, effective: intent, collapsed: false } as const;
  if (!cfg.enabled) return same;
  // a timeline has no narrower n-day span to collapse to — it scrolls instead
  if (viewKind(intent) === "timeline") return same;
  if (!Number.isFinite(width) || width <= 0) return same;
  if (width < cfg.breakpoint) {
    if (isNarrowSafe(intent)) return same;
    return { intent, effective: cfg.collapseTo, collapsed: true };
  }
  if (cfg.mediumBreakpoint > 0 && width < cfg.mediumBreakpoint) {
    const wide = intent === "week" || (typeof intent === "number" && intent > cfg.mediumDays);
    if (wide) return { intent, effective: cfg.mediumDays, collapsed: true };
  }
  return same;
}

/**
 * What to request now for a host that adopted an earlier collapse: the original
 * intent once it fits again, the next tier's view when the box moved between
 * tiers, or `null` when nothing should change. Stands down as soon as the host
 * picks something other than what we reported.
 */
export function reconcileIntent(
  width: number,
  intent: KloqView,
  collapsedFrom: KloqView | null,
  collapsedTo: KloqView | null,
  cfg: ResolvedResponsive,
): KloqView | null {
  if (!cfg.enabled || collapsedFrom === null) return null;
  if (!Number.isFinite(width) || width <= 0) return null;
  if (collapsedTo !== null && intent !== collapsedTo) return null;
  const next = effectiveView(width, collapsedFrom, cfg);
  if (!next.collapsed) return intent === collapsedFrom ? null : collapsedFrom;
  return next.effective === intent ? null : next.effective;
}

/** @deprecated use {@link reconcileIntent} */
export const restoreIntent = reconcileIntent;
