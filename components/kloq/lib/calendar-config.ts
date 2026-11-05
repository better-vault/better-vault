import { createVerticalAxis, type KloqAxis } from "./axis";
import { displayDate, formatMinutes, formatRange, type TimeFormatOptions } from "./calendar-types";
import { MINUTES_PER_DAY } from "./date-math";
import {
  clampZoom,
  DEFAULT_DENSITY,
  type DensityTokens,
  densityTokens,
  isDensity,
  type KloqDensity,
  MAX_HOUR_HEIGHT,
  MIN_HOUR_HEIGHT,
  resolveHourHeight,
  ZOOM_DEFAULT,
} from "./density";
import { randomId } from "./ids";
import {
  coerceTimeZone,
  type InstantLike,
  isValidTimeZone,
  localZone,
  normalizeZoneColumns,
  sameZone,
  type TimeZoneColumn,
  unzonedInstant,
  zoneAbbr,
} from "./timezone";

/** Config as a host passes it — every field optional. */
export interface KloqConfig {
  /**
   * px per hour on the time grid, clamped to 8–480. Omit it and `density` picks
   * the base (64 comfortable, 44 compact); pass it and `zoom` multiplies yours.
   */
  hourHeight?: number;
  /** `"comfortable"` (default) or `"compact"` — hour height, event type size and padding together. */
  density?: KloqDensity;
  /** Live zoom as an index into `ZOOM_STEPS` (0–10, default 4 = 100%). */
  zoom?: number;
  /**
   * Id factory for everything the calendar creates — drag-create, quick-add,
   * duplicate, paste, detached occurrences. Default: a random UUID. Supply
   * yours when ids must match a server scheme.
   */
  makeId?: () => string;
  /** First hour the grid draws, 0–23; with `dayEndHour` this clips the day. */
  dayStartHour?: number;
  dayEndHour?: number;
  snapMinutes?: number;
  snapFineMinutes?: number;
  minEventMinutes?: number;
  /** BCP 47 tag for every date and time label; undefined means `en-US` 12-hour. */
  locale?: string;
  /** Force a 12- or 24-hour clock; omit and the locale decides. */
  hour12?: boolean;
  /** Draw the calendar in this IANA zone instead of the browser's; unknown ids fall back. */
  displayTimeZone?: string;
  /**
   * Extra gutter zone columns, in order, as ids or `{ timeZone, label }`.
   * Unknown zones and duplicates are dropped; `components.TimeGutter` still wins.
   */
  timeZones?: (string | TimeZoneColumn)[];
}

/** Resolved, validated config plus the px↔time and formatting functions. */
export interface KloqSettings {
  /** px per hour, density and zoom applied; nothing else may re-derive it from props. */
  readonly hourHeight: number;
  readonly density: KloqDensity;
  /** index into `ZOOM_STEPS`; 4 is 100% */
  readonly zoom: number;
  /** the type/padding half of the density — the geometry half is `hourHeight` */
  readonly densityTokens: DensityTokens;
  /** id factory for created events */
  readonly makeId: () => string;
  readonly dayStartHour: number;
  readonly dayEndHour: number;
  /** `dayStartHour * 60` — the top of the canvas in absolute minutes */
  readonly dayStartMin: number;
  /** `dayEndHour * 60` — the bottom of the canvas in absolute minutes */
  readonly dayEndMin: number;
  readonly dayMinutes: number;
  readonly canvasHeight: number;
  readonly snapMinutes: number;
  readonly snapFineMinutes: number;
  readonly minEventMinutes: number;
  readonly locale?: string;
  readonly hour12?: boolean;
  readonly timeFormat: TimeFormatOptions;

  /**
   * The zone the grid is drawn in; always a real IANA id.
   * SSR-unstable without `displayTimeZone` — gate rendering on `hasDisplayZone`.
   */
  readonly timeZone: string;
  /**
   * Zone for the trailing `timeZone` arg of the zone-aware helpers.
   * `undefined` whenever the resolved zone is the browser's; SSR-unstable.
   */
  readonly displayZone: string | undefined;
  /** Is the grid drawn in the browser's own zone? A fast-path flag; SSR-unstable. */
  readonly isLocalZone: boolean;
  /** Did the host ask for a display zone? Derived from props alone, so SSR-stable. */
  readonly hasDisplayZone: boolean;
  /** Extra gutter zone columns, normalised: object form, valid, deduped. */
  readonly timeZones: readonly TimeZoneColumn[];

  /** an instant → a `Date` whose local getters read the DISPLAY zone */
  toDisplay(t: InstantLike): Date;
  /** the inverse: a display-zone `Date` → epoch ms */
  fromDisplay(d: Date): number;
  displayNow(): Date;
  /** the display zone's short label at an instant — `"BST"`, `"JST"` */
  zoneLabel(at?: InstantLike): string;

  /**
   * The geometry seam. `minutesToPx` and its siblings below are delegates to
   * this; a view that runs time along x supplies its own axis instead.
   */
  readonly axis: KloqAxis;
  /** absolute minutes-from-midnight → y on the canvas */
  minutesToPx(min: number): number;
  /** a DURATION in minutes → a height in px (no window offset) */
  durationToPx(min: number): number;
  /** y on the canvas → absolute minutes-from-midnight */
  pxToMinutes(px: number): number;
  /** a px LENGTH → a duration in minutes (no window offset) */
  pxToDuration(px: number): number;
  clampMinutes(min: number): number;
  formatMinutes(min: number): string;
  formatRange(startMin: number, endMin: number): string;
}

/** The values `<Kloq>` uses when a host passes nothing. */
export const DEFAULT_CONFIG: Required<
  Omit<KloqConfig, "locale" | "hour12" | "displayTimeZone" | "timeZones" | "makeId">
> = {
  hourHeight: 64,
  density: DEFAULT_DENSITY,
  zoom: ZOOM_DEFAULT,
  dayStartHour: 0,
  dayEndHour: 24,
  snapMinutes: 15,
  snapFineMinutes: 5,
  minEventMinutes: 15,
};

const num = (v: number | undefined, fallback: number, lo: number, hi: number) =>
  v === undefined || !Number.isFinite(v) ? fallback : Math.min(hi, Math.max(lo, v));

/**
 * Resolve a config into the object everything downstream reads. Values are
 * clamped, not thrown on; an inverted day range becomes a one-hour window.
 */
export function createSettings(config: KloqConfig = {}): KloqSettings {
  // hourHeight is clamped before scaling so a host passing 0 lands on the floor, not 0 × zoom.
  const density: KloqDensity = isDensity(config.density) ? config.density : DEFAULT_DENSITY;
  const zoom = clampZoom(config.zoom);
  const hourHeight = resolveHourHeight({
    hourHeight:
      config.hourHeight === undefined
        ? undefined
        : num(config.hourHeight, DEFAULT_CONFIG.hourHeight, MIN_HOUR_HEIGHT, MAX_HOUR_HEIGHT),
    density,
    zoom,
  });
  const dayStartHour = num(config.dayStartHour, DEFAULT_CONFIG.dayStartHour, 0, 23);
  const dayEndHour = Math.max(
    dayStartHour + 1,
    num(config.dayEndHour, DEFAULT_CONFIG.dayEndHour, 1, 24),
  );
  const snap = num(config.snapMinutes, DEFAULT_CONFIG.snapMinutes, 1, MINUTES_PER_DAY);
  const snapFine = num(config.snapFineMinutes, DEFAULT_CONFIG.snapFineMinutes, 1, MINUTES_PER_DAY);
  const minEvent = num(config.minEventMinutes, DEFAULT_CONFIG.minEventMinutes, 1, MINUTES_PER_DAY);

  const dayStartMin = dayStartHour * 60;
  const dayEndMin = dayEndHour * 60;
  const dayMinutes = dayEndMin - dayStartMin;
  const perMin = hourHeight / 60;

  const timeFormat: TimeFormatOptions = {
    locale: config.locale,
    hour12: config.hour12,
  };

  // displayZone's undefined is load-bearing: helpers treat it as the browser's wall clock.
  const browser = localZone();
  const hasDisplayZone =
    config.displayTimeZone !== undefined && isValidTimeZone(config.displayTimeZone);
  const timeZone = coerceTimeZone(config.displayTimeZone, browser);
  const isLocalZone = sameZone(timeZone, browser);
  const displayZone = isLocalZone ? undefined : timeZone;
  const timeZones = normalizeZoneColumns(config.timeZones);

  const axis = createVerticalAxis({ hourHeight, dayStartMin, dayEndMin });

  return {
    hourHeight,
    density,
    zoom,
    densityTokens: densityTokens(density),
    makeId: typeof config.makeId === "function" ? config.makeId : () => randomId("ev"),
    dayStartHour,
    dayEndHour,
    dayStartMin,
    dayEndMin,
    dayMinutes,
    canvasHeight: dayMinutes * perMin,
    snapMinutes: snap,
    snapFineMinutes: snapFine,
    minEventMinutes: minEvent,
    locale: config.locale,
    hour12: config.hour12,
    timeFormat,

    axis,
    minutesToPx: (min) => axis.toPx(min),
    durationToPx: (min) => axis.durationToPx(min),
    pxToMinutes: (px) => axis.pxToMinutes(px),
    pxToDuration: (px) => axis.pxToDuration(px),
    clampMinutes: (min) => axis.clamp(min),
    formatMinutes: (min) => formatMinutes(min, timeFormat),
    formatRange: (a, b) => formatRange(a, b, timeFormat),

    timeZone,
    displayZone,
    isLocalZone,
    hasDisplayZone,
    timeZones,

    toDisplay: (t) => displayDate(t, displayZone),
    fromDisplay: (d) => (displayZone ? unzonedInstant(d, displayZone) : d.getTime()),
    displayNow: () => displayDate(Date.now(), displayZone),
    zoneLabel: (at) => zoneAbbr(at ?? Date.now(), timeZone),
  };
}

/** The settings a component gets with no `<Kloq>` above it. */
export const DEFAULT_SETTINGS: KloqSettings = createSettings();
