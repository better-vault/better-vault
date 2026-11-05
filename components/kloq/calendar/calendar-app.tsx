"use client";

import {
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { flushSync } from "react-dom";
import { DesignModeHint, DesignModeOverlay, DesignModeProvider } from "../design-mode";
import { createSettings, type KloqConfig } from "../lib/calendar-config";
import type { OnCommit, PersistenceAdapter } from "../lib/calendar-store";
import {
  type CalEvent,
  displayDate,
  instantPlus,
  type KloqView,
  minutesOfDate,
  parseInstant,
  startOfLocalDay,
} from "../lib/calendar-types";
import { EASE_OUT, prefersReducedMotion } from "../lib/springs";
import { configureStorage, type StorageSetting } from "../lib/storage";
import { getScheme, themeTransition, watchSystemScheme } from "../lib/themes";
import { useLatest } from "../lib/use-latest";
import { PortalContainerProvider, usePortalContainer } from "../ui/portal-container";
import { StoreProvider } from "./store-context";
import { capabilitiesOf } from "./view-registry";

const UNSET = Symbol("unset");

import type React from "react";
import {
  announceColor,
  announceDeleted,
  announceDuplicated,
  announceRedo,
  announceResized,
  announceUndo,
  type WhenRef,
} from "../lib/announce";
import { attendeeStatus, findAttendee } from "../lib/attendees";
import {
  filterVisibleEvents,
  resolveDefaultCalendar,
  resolveEventColor,
  useCalendarSources,
} from "../lib/calendar-sources";
import { createConstraints, type KloqConstraints, slotAllowed } from "../lib/constraints";
import { getDensityState, getServerDensityState, subscribeDensity } from "../lib/density";
import type { Keymap } from "../lib/keymap";
import { byResourceId, type Lane, type LaneAdapter } from "../lib/lane";
import { isoWeek, type NavigationKeys } from "../lib/navigation";
import { type Projection, projectEvents } from "../lib/projection";
import {
  applyPlan,
  deleteOccurrence,
  masterIdOf,
  nodeFor,
  withoutSegment,
} from "../lib/recurrence";
import { type ResponsiveSetting, effectiveView as resolveEffectiveView } from "../lib/responsive";
import { focusAfterRemoval, rovingTarget } from "../lib/roving";
import { eventKeyOf, selectionOrder } from "../lib/selection";
import { projectTimeline } from "../lib/timeline-projection";
import { resolveWindow, type TimelineWindowConfig } from "../lib/timeline-window";
import { useIsClient } from "../lib/use-is-client";
import { cn } from "../lib/utils";
import { type DayLoad, densityByDay } from "../lib/year-grid";
import { panelPlacement } from "../timeline/panel-placement";
import { TimelineApp } from "../timeline/timeline-app";
import { AgendaView } from "./agenda-view";
import { AllDayLane, AllDayLaneFrame } from "./all-day-lane";
import { ChromeProvider, type KloqChrome, KloqNav, KloqReset, KloqToolbar } from "./chrome";
import { ConstraintsProvider } from "./constraints-context";
import { GutterZoneLabels } from "./gutter-zone-labels";
import { JumpToNow } from "./jump-to-now";
import { DEFAULT_QUICK_ADD_MIN, KloqCommandMenu } from "./kloq-command";
import { AnnounceProvider, LiveRegions, useAnnouncer } from "./live-region";
import { MonthView } from "./month-view";
import { GUTTER_WIDTH, multiZoneGutterWidth, ZONE_CAPTION } from "./multi-tz-gutter";
import { SettingsProvider, useKloqSettings } from "./settings-context";
import { ShortcutsOverlay } from "./shortcuts-overlay";
import { DEFAULT_COMPONENTS, type KloqComponents, SlotsProvider, useSlots } from "./slots";
import { GutterDateProvider, gutterDateFor } from "./time-gutter";
import type { WorkingHours } from "./time-shade";
import { useCalendarKeys } from "./use-calendar-keys";
import { useDragEngine } from "./use-drag-engine";
import { useEventStore } from "./use-event-store";
import { useFocusFollow } from "./use-focus-follow";
import { useGridMount } from "./use-grid-mount";
import { useHistory } from "./use-history";
import { usePlacementCommits } from "./use-placement-commits";
import { useQuickCreate } from "./use-quick-create";
import { RecurrenceScopeProvider, useRecurrenceScope } from "./use-recurrence-scope";
import { useRevertAnimation } from "./use-revert-animation";
import {
  type KloqSelectionHandle,
  SelectionProvider,
  useSelectionController,
} from "./use-selection";
import { useViewNavigation, useViewTransitions, viewLabel } from "./use-view-navigation";
import { captureSnapshot } from "./view-morph";
import { WeekGrid, WeekGridFrame } from "./week-grid";
import { YearView } from "./year-view";

/** How a view names itself out loud. */
export interface KloqProps extends KloqConfig {
  /** Your own chrome, rendered above the surface inside the root; it can read view state via `useKloq()`. */
  children?: ReactNode;
  /** Merged onto the root element's classes. The root is `h-full`. */
  className?: string;
  /**
   * Scope a theme to this calendar: stamps `data-kloq-theme` on the root and its
   * portal container, nothing else. Omit to follow the page (`setTheme` / `<html>`).
   */
  theme?: string;
  /** Pin this calendar's colour scheme regardless of the page's `.dark`. Omit to follow the page. */
  scheme?: "light" | "dark";
  /**
   * The current view — `"day"`, `"week"`, `"month"`, `"agenda"`, `"year"`, or an n-day span (2–14).
   * Controlled when provided: the switcher and ⌘K only request a change through `onViewChange`.
   */
  view?: KloqView;
  /** Uncontrolled starting view; default `"week"`. Ignored when `view` is set. */
  defaultView?: KloqView;
  /** Fired whenever something asks to change the view, controlled or not. */
  onViewChange?: (view: KloqView) => void;
  /** Slot overrides — swap any visual piece while the engine keeps the physics. See slots.ts. */
  components?: Partial<KloqComponents>;
  /** 0 = Sunday … 6 = Saturday; default Monday */
  weekStartsOn?: number;
  /** Anchor date for the view. Controlled when provided, like `view`: navigation only reports via `onDateChange`. */
  date?: Date;
  /** Uncontrolled starting anchor; defaults to today. Ignored when `date` is set. */
  defaultDate?: Date;
  /** Fired whenever something asks to move the anchor date. */
  onDateChange?: (date: Date) => void;
  /** The visible range changed — `[start, end)`. Fires once on mount, then on every view or date change. */
  onRangeChange?: (start: Date, end: Date) => void;
  /** Days to widen the range `onRangeChange` reports; a number pads both ends. Default 0. */
  rangePadding?: number | { before: number; after: number };
  /** Controlled events. Providing this switches the internal store off — pair with `onEventsChange`. */
  events?: CalEvent[];
  /** Fired with the full next event list on every committed change (controlled mode). */
  onEventsChange?: (events: CalEvent[]) => void;
  /** Uncontrolled starting events; default: none. */
  defaultEvents?: CalEvent[];
  /** Uncontrolled persistence: `false` = ephemeral, omit = localStorage, or your own adapter. */
  persistence?: false | PersistenceAdapter;
  /**
   * Everything kloq keeps in localStorage — events, theme, scheme, density,
   * zoom. `false` keeps it all in memory; a string namespaces the keys (per
   * user, per embed); an object sets both. Default: `"kloq"`.
   */
  storage?: StorageSetting;
  /** Optimistic seam — called on every committed change; a rejected promise reverts it. */
  onCommit?: OnCommit;
  /** Figma-style design mode (⌥D). Default on; `{ hint: false }` hides the pill. */
  designMode?: boolean | { hint?: boolean };
  /**
   * ⌘K. `false` removes the binding and the menu — the key is left untouched for the host's
   * own palette. `{ commands }` narrows the built-ins to the listed ids: spread
   * `BUILT_IN_COMMANDS` and filter. Registered commands always render, and registering a
   * built-in's id replaces that built-in. Default on, all built-ins.
   */
  commandPalette?: boolean | { commands?: readonly string[] };
  /** Working-hours tint boundaries (default 9–17); `false` disables the tint. */
  workingHours?: WorkingHours | false;
  /**
   * What the grid refuses: date bounds (`minDate`/`maxDate`), a per-slot refusal
   * (`isSlotDisabled`) and a per-event drop veto (`canDrop`). Refused time is hatched,
   * and every gesture honours it — drag, resize, keyboard, quick create, ⌥-duplicate.
   * Only gestures are constrained: events already in refused time render and stay put.
   */
  constraints?: KloqConstraints;
  /** Controlled-mode undo — ⌘Z calls it. Ignored in uncontrolled mode, where history is built in. */
  onUndo?: () => void;
  /** Controlled-mode redo — ⇧⌘Z calls it. Ignored in uncontrolled mode. */
  onRedo?: () => void;
  /**
   * Collapse to a single-day view when the box is too narrow for a multi-column grid. Default on.
   * `view` is never rewritten — the collapse is derived, reported via `onViewChange`, undone on widening.
   */
  responsive?: ResponsiveSetting;
  /** An event was clicked (not dragged). The placement id differs from the event id for a recurring instance. */
  onEventClick?: (event: CalEvent, placementId: string) => void;
  /** Double-click on an event. Fires after `onEventClick`, as the DOM does. */
  onEventDoubleClick?: (event: CalEvent, placementId: string) => void;
  /** An empty slot was clicked, snapped like drag-create; `end` is the default length, not a selection. */
  onSlotClick?: (slot: { start: Date; end: Date; allDay: boolean }) => void;
  /** The selection changed. Fires with every selected event, in reading order. */
  onSelectionChange?: (events: CalEvent[]) => void;
  /** Let ⌘K / ⌘Z / ⌥D fire when focus is outside the calendar. Off by default; other keys are always scoped. */
  globalShortcuts?: boolean;
  /** Who "you" are, as an email. Enables RSVP, per-person conflict detection and `showDeclinedEvents`. */
  currentUserEmail?: string;
  /** ISO 8601 week numbers in the time grid's gutter corner. Off by default; time-grid views only. */
  showWeekNumbers?: boolean;
  /**
   * Draw events you have declined. On by default. With `false` and a `currentUserEmail` marked
   * declined on an event, that event is hidden from every view but stays in the store and ⌘K search.
   */
  showDeclinedEvents?: boolean;
  /** What `←`/`→` move by: the visible range (default) or one day. `PageUp`/`PageDown` always step the range. */
  navigationKeys?: NavigationKeys;
  /** The gutter-corner zone labels were pressed; providing it renders them as a button. The host owns the picker. */
  onTimeZonesClick?: () => void;
  /** Overrides for the remappable keyboard mnemonics (see `lib/keymap.ts`). Unknown ids and unusable keys are ignored. */
  keymap?: Keymap;
  /** "Customize shortcuts…" was pressed in the "?" sheet. Omit and the button isn't rendered. */
  onCustomizeKeybinds?: () => void;
  /**
   * Render the event layer on the server too. Off by default; only hydration-safe when `events` is
   * controlled, `date`/`defaultDate` is supplied and `displayTimeZone` is supplied.
   */
  ssr?: boolean;
  /** Rows for `view="timeline"`. Ignored by every other view. Empty by default — nothing renders without lanes. */
  lanes?: readonly Lane[];
  /** How an event maps onto a lane. Defaults to `byResourceId()`, reading `event.resourceId`. */
  laneAdapter?: LaneAdapter;
  /**
   * The timeline's visible span and slot size. Pass both `start` and `end` to
   * control the window exactly; omit them (the default) and the window is
   * derived from the current anchor date instead, so `stepAnchor`/next-prev
   * move it like every other view's range. See `TimelineWindowConfig`.
   */
  timelineWindow?: TimelineWindowConfig;
}

/** Has `email` declined this event? Only a real `declined` RSVP counts. */
function hasDeclined(e: CalEvent, email: string): boolean {
  const me = findAttendee(e.attendees, email);
  return me !== undefined && attendeeStatus(me) === "declined";
}

// View-switch FLIP: capture geometry before the switch, morph after.

/** Stable empty projection for the pre-hydration render — see `isClient`. */
const EMPTY_PROJECTION: Projection = { all: [], timed: [], allDay: [] };

/** Midday on a day — a stable instant for reading a zone's offset off it. */
function atNoon(day: Date | undefined): Date {
  const d = day ? new Date(day) : new Date();
  d.setHours(12, 0, 0, 0);
  return d;
}

export function CalendarApp({
  weekStartsOn = 1,
  components,
  theme: themeProp,
  scheme: schemeProp,
  storage,
  persistence,
  designMode = true,
  commandPalette = true,
  workingHours = { start: 9, end: 17 },
  onEventClick,
  globalShortcuts = false,
  hourHeight,
  density,
  zoom,
  dayStartHour,
  dayEndHour,
  snapMinutes: snapMin,
  snapFineMinutes,
  minEventMinutes,
  locale,
  hour12,
  displayTimeZone,
  timeZones,
  ...storeProps
}: KloqProps = {}) {
  const slots = useMemo(() => ({ ...DEFAULT_COMPONENTS, ...components }), [components]);
  // a body-level home for portals that still carries the calendar's tokens
  const [portalEl, setPortalEl] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    const el = document.createElement("div");
    el.setAttribute("data-kloq-root", "");
    el.setAttribute("data-kloq-portal", "");
    document.body.appendChild(el);
    setPortalEl(el);
    return () => {
      el.remove();
    };
  }, []);
  // a scoped theme/scheme prop lands through one transition, like a page-level `setTheme()`
  const [look, setLook] = useState({ theme: themeProp, scheme: schemeProp });
  useLayoutEffect(() => {
    if (look.theme === themeProp && look.scheme === schemeProp) return;
    const next = { theme: themeProp, scheme: schemeProp };
    let sync = true;
    themeTransition(() => {
      if (sync) setLook(next);
      else flushSync(() => setLook(next));
    });
    sync = false;
  }, [themeProp, schemeProp, look]);
  const { theme, scheme } = look;
  // the portals live under <body>, outside the root
  useLayoutEffect(() => {
    if (!portalEl) return;
    if (theme && theme !== "coss") portalEl.setAttribute("data-kloq-theme", theme);
    else portalEl.removeAttribute("data-kloq-theme");
    portalEl.classList.toggle("dark", scheme === "dark");
    portalEl.classList.toggle("light", scheme === "light");
  }, [portalEl, theme, scheme]);
  // during render, not an effect: children hydrate theme/density in their own layout effects, which run first
  const storageSeen = useRef<StorageSetting | symbol>(UNSET);
  if (storageSeen.current !== storage) {
    storageSeen.current = storage;
    configureStorage(storage);
  }
  // memo keyed on primitives (and timeZones by content) so an inlined array doesn't rebuild settings
  const zonesKey = timeZones
    ? timeZones.map((z) => (typeof z === "string" ? z : `${z.timeZone}|${z.label ?? ""}`)).join(",")
    : "";
  // the live density/zoom store (toolbar controls) fills in whatever the props leave open
  const live = useSyncExternalStore(subscribeDensity, getDensityState, getServerDensityState);
  const settings = useMemo(
    () =>
      createSettings({
        hourHeight,
        density: density ?? live.density,
        zoom: zoom ?? live.zoom,
        dayStartHour,
        dayEndHour,
        snapMinutes: snapMin,
        snapFineMinutes,
        minEventMinutes,
        locale,
        hour12,
        displayTimeZone,
        timeZones,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      hourHeight,
      density ?? live.density,
      zoom ?? live.zoom,
      dayStartHour,
      dayEndHour,
      snapMin,
      snapFineMinutes,
      minEventMinutes,
      locale,
      hour12,
      displayTimeZone,
      zonesKey,
    ],
  );
  return (
    <PortalContainerProvider value={portalEl}>
      <SettingsProvider value={settings}>
        <SlotsProvider value={slots}>
          {/* above CalendarAppInner because it calls `useRecurrenceScope()` itself */}
          <RecurrenceScopeProvider>
            <CalendarAppInner
              weekStartsOn={weekStartsOn}
              theme={theme}
              scheme={scheme}
              designMode={designMode}
              commandPalette={commandPalette}
              workingHours={workingHours}
              globalShortcuts={globalShortcuts}
              persistence={storage === false && persistence === undefined ? false : persistence}
              {...storeProps}
            />
          </RecurrenceScopeProvider>
        </SlotsProvider>
      </SettingsProvider>
    </PortalContainerProvider>
  );
}

CalendarApp.Toolbar = KloqToolbar;
CalendarApp.Nav = KloqNav;
CalendarApp.Reset = KloqReset;

interface InnerProps
  extends Pick<
    KloqProps,
    | "events"
    | "onEventsChange"
    | "defaultEvents"
    | "persistence"
    | "onCommit"
    | "onUndo"
    | "onRedo"
    | "view"
    | "defaultView"
    | "onViewChange"
    | "date"
    | "defaultDate"
    | "onDateChange"
    | "onRangeChange"
    | "rangePadding"
    | "constraints"
    | "children"
    | "className"
    | "lanes"
    | "laneAdapter"
    | "timelineWindow"
    | "theme"
    | "scheme"
  > {
  weekStartsOn: number;
  designMode: boolean | { hint?: boolean };
  commandPalette: boolean | { commands?: readonly string[] };
  workingHours: WorkingHours | false;
  onEventClick?: KloqProps["onEventClick"];
  onEventDoubleClick?: KloqProps["onEventDoubleClick"];
  onSlotClick?: KloqProps["onSlotClick"];
  onSelectionChange?: KloqProps["onSelectionChange"];
  globalShortcuts: boolean;
  responsive?: ResponsiveSetting;
  currentUserEmail?: string;
  showWeekNumbers?: boolean;
  showDeclinedEvents?: boolean;
  navigationKeys?: NavigationKeys;
  onTimeZonesClick?: () => void;
  ssr?: boolean;
  keymap?: Keymap;
  onCustomizeKeybinds?: () => void;
}

/** A callback with a fixed identity that always runs the latest closure. */
function useStable<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R {
  const latest = useLatest(fn);
  return useCallback((...args: A) => latest.current(...args), [latest]);
}

const durationMs = (value: string, fallback: number) => {
  const n = parseFloat(value);
  if (!Number.isFinite(n)) return fallback;
  return value.trim().endsWith("ms") ? n : n * 1000;
};

/**
 * Lets the event panel leave: when its child unmounts, a static copy fades out over the shared
 * overlay exit tokens. The copy is inert, and skipped entirely under reduced motion.
 */
function ExitPresence({ children }: { children: ReactNode }) {
  const id = useId();
  const present = children !== null && children !== undefined && children !== false;
  const [was, setWas] = useState(present);
  const [ghost, setGhost] = useState<HTMLElement | null>(null);
  if (was !== present) {
    setWas(present);
    // render phase, on purpose: the panel is still in the document here and gone by the next effect
    const live =
      present || prefersReducedMotion() ? null : document.getElementById(id)?.firstElementChild;
    if (live) {
      const copy = live.cloneNode(true) as HTMLElement;
      const fields = live.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
        "input, textarea",
      );
      copy
        .querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input, textarea")
        .forEach((field, i) => {
          field.value = fields[i]?.value ?? "";
        });
      setGhost(copy);
    } else setGhost(null);
  }

  useLayoutEffect(() => {
    if (!ghost) return;
    const host = document.getElementById(id);
    if (!host) return;
    ghost.setAttribute("inert", "");
    ghost.setAttribute("aria-hidden", "true");
    ghost.removeAttribute("role");
    ghost.removeAttribute("aria-label");
    ghost.setAttribute("data-exiting", "");
    host.appendChild(ghost);
    const tokens = getComputedStyle(host);
    const card = ghost.querySelector<HTMLElement>('[data-slot="card"]') ?? ghost;
    const exit = card.animate(
      [
        { opacity: 1, transform: "none" },
        {
          opacity: 0,
          transform: ghost.hasAttribute("data-sheet") ? "translateY(1rem)" : "scale(0.98)",
        },
      ],
      {
        duration: durationMs(tokens.getPropertyValue("--overlay-exit"), 100),
        easing: tokens.getPropertyValue("--overlay-ease").trim() || EASE_OUT,
        fill: "forwards",
      },
    );
    let live = true;
    void exit.finished.then(
      () => live && setGhost(null),
      () => {},
    );
    return () => {
      live = false;
      exit.cancel();
      ghost.remove();
    };
  }, [ghost, id]);

  return (
    <div id={id} className="contents">
      {children}
    </div>
  );
}

const CRAMPED_COLUMN = 64;

/** Stable empty density for every view that is not a year. */
const EMPTY_DENSITY: ReadonlyMap<string, DayLoad> = new Map();

/** Stable identity so a host that never passes `lanes` doesn't rebuild the timeline projection every render. */
const EMPTY_LANES: readonly Lane[] = [];
const DEFAULT_LANE_ADAPTER: LaneAdapter = byResourceId();

function CalendarAppInner({
  weekStartsOn,
  theme,
  scheme,
  view: viewProp,
  defaultView,
  onViewChange,
  date: dateProp,
  defaultDate,
  onDateChange,
  onRangeChange,
  rangePadding = 0,
  constraints,
  events: eventsProp,
  onEventsChange,
  defaultEvents,
  persistence,
  onCommit,
  designMode,
  commandPalette,
  workingHours,
  onEventClick,
  onEventDoubleClick,
  onSlotClick,
  onSelectionChange,
  globalShortcuts,
  responsive,
  currentUserEmail,
  showWeekNumbers = false,
  showDeclinedEvents = true,
  navigationKeys = "range",
  onTimeZonesClick,
  ssr = false,
  keymap,
  onCustomizeKeybinds,
  onUndo,
  onRedo,
  children,
  className,
  lanes,
  laneAdapter,
  timelineWindow,
}: InnerProps) {
  const C = useSlots();
  const g = useKloqSettings();
  // only stamp an authoring zone when the host asked for a display zone; else it's a machine-dependent claim
  const authoredZone = g.hasDisplayZone ? ({ timeZone: g.timeZone } as const) : undefined;
  const dmEnabled = designMode !== false;
  const dmHint = dmEnabled && (designMode === true || designMode.hint !== false);
  // the most recent drag-created event — the panel autofocuses its title only for this one
  const {
    store: calendarStore,
    events,
    controlled,
  } = useEventStore({
    events: eventsProp,
    onEventsChange,
    defaultEvents,
    persistence,
    onCommit,
    onReverted: (ids) => handleReverted(ids),
  });
  const [newId, setNewId] = useState<string | null>(null);
  // the panel is not the selection: it shows only while `panelId` is also the selection lead
  const [panelId, setPanelId] = useState<string | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  // hosts with no scheme convention at all (no `dark`/`light` on <html>) follow the OS, scoped to the calendar
  const portalEl = usePortalContainer();
  useLayoutEffect(() => {
    const els = [rootRef.current, portalEl].filter((el): el is HTMLElement => !!el);
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const html = document.documentElement;
    const apply = () => {
      if (scheme) return; // a pinned `scheme` owns the class
      const bare = !html.classList.contains("dark") && !html.classList.contains("light");
      const on = bare && getScheme() === "system" && mq.matches;
      for (const el of els) el.classList.toggle("dark", on);
    };
    apply();
    mq.addEventListener("change", apply);
    const mo = new MutationObserver(apply);
    mo.observe(html, { attributes: true, attributeFilter: ["class"] });
    return () => {
      mq.removeEventListener("change", apply);
      mo.disconnect();
    };
  }, [portalEl, scheme]);
  const nav = useViewNavigation({
    viewProp,
    defaultView,
    onViewChange,
    dateProp,
    defaultDate,
    onDateChange,
    responsive,
    weekStartsOn,
    rangePadding,
    onRangeChange,
    rootRef,
    // invoked at event time, after everything below is initialised
    onNavigate: () => {
      selection.clear();
      setNewId(null);
    },
    onViewSwitched: () => requestAnimationFrame(() => focusEvent(null)),
    announce: (m) => announce(m),
  });
  const {
    viewSetting,
    effectiveView,
    responsiveView,
    anchorDate,
    view,
    lastStep,
    switchView,
    jumpToDay,
    openMonth,
    step,
    stepDay,
    goToday,
    applyDate,
    range,
    rangeLabel,
    pending,
    ready,
  } = nav;
  const pendingMorph = pending.morph;
  const caps = capabilitiesOf(view.kind);
  // columns too narrow for a bar, a time and a title: blocks drop to the title alone
  const cramped =
    responsiveView.width > 0 &&
    (responsiveView.width - GUTTER_WIDTH) / view.dayCount < CRAMPED_COLUMN;
  const isTimeGrid = caps.timeGrid;
  const resolvedTimelineWindow = useMemo(
    () => resolveWindow(timelineWindow, anchorDate),
    [timelineWindow, anchorDate],
  );

  // a second zone reads ONE day's offsets — today's if visible, else the first (DST can differ by day)
  const gutterDate = gutterDateFor(view.days, view.todayIndex);
  const gutterWidth = useMemo(
    () =>
      g.timeZones.length === 0
        ? GUTTER_WIDTH
        : multiZoneGutterWidth(g.timeZones, g.fromDisplay(atNoon(gutterDate)), g.timeZone),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [g, gutterDate?.getTime()],
  );

  // the event layer waits one render: placement depends on today + localStorage, unknowable on the server
  const isClient = useIsClient();
  const { accounts, sources } = useCalendarSources();
  // both filters return their input untouched when nothing is hidden, so nothing downstream re-projects
  const visibleEvents = useMemo(() => {
    const onVisibleCalendars = filterVisibleEvents(events, sources);
    if (showDeclinedEvents || !currentUserEmail) return onVisibleCalendars;
    const kept = onVisibleCalendars.filter((e) => !hasDeclined(e, currentUserEmail));
    return kept.length === onVisibleCalendars.length ? onVisibleCalendars : kept;
  }, [events, sources, showDeclinedEvents, currentUserEmail]);
  /** Where a newly created event lands — the default ACCOUNT's calendar. */
  const newEventCalendar = useMemo(
    () => resolveDefaultCalendar(accounts, sources)?.id,
    [accounts, sources],
  );
  // spread into create paths; an explicit `undefined` key would persist as null
  const onDefaultCalendar = useMemo(
    () => (newEventCalendar ? ({ calendarId: newEventCalendar } as const) : undefined),
    [newEventCalendar],
  );
  // calendar colour is folded onto a derived copy so an inheriting event never stores a colour
  const coloured = useMemo(
    () =>
      sources.length === 0
        ? visibleEvents
        : visibleEvents.map((e) => {
            const color = resolveEventColor(e, sources);
            return color === e.color ? e : { ...e, color };
          }),
    [visibleEvents, sources],
  );
  // a year view is not projected (365 columns for one integer per day); it aggregates off the store
  const isYear = caps.projects === "range";
  const projected = useMemo(
    () =>
      (ssr || isClient) && ready && !isYear
        ? projectEvents(coloured, view, {
            dayStartMin: g.dayStartMin,
            dayEndMin: g.dayEndMin,
            timeZone: g.displayZone,
          })
        : EMPTY_PROJECTION,
    [coloured, view, ssr, isClient, ready, isYear, g.dayStartMin, g.dayEndMin, g.displayZone],
  );
  // a timeline's bars are lane placements over its own window, not day columns
  const timelineStart = resolvedTimelineWindow.start.getTime();
  const timelineEnd = resolvedTimelineWindow.end.getTime();
  const timelinePlaced = useMemo(
    () =>
      view.kind !== "timeline"
        ? null
        : (ssr || isClient) && ready
          ? projectTimeline(
              coloured,
              lanes ?? EMPTY_LANES,
              resolvedTimelineWindow,
              laneAdapter ?? DEFAULT_LANE_ADAPTER,
            ).all
          : EMPTY_PROJECTION.all,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      view.kind,
      ssr,
      isClient,
      ready,
      coloured,
      lanes,
      laneAdapter,
      timelineStart,
      timelineEnd,
      resolvedTimelineWindow.slotMinutes,
    ],
  );
  const placed = timelinePlaced ?? projected.all;

  // everything below the app bar — the element a range step slides
  const surfaceRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const draftRef = useRef<HTMLDivElement>(null);
  const laneRef = useRef<HTMLDivElement>(null);
  const laneDraftRef = useRef<HTMLDivElement>(null);
  const registry = useRef(new Map<string, HTMLElement>()).current;

  const selection = useSelectionController({
    store: calendarStore,
    view,
    projected: placed,
    registry,
  });
  const selectionSeen = useRef<readonly string[] | null>(null);
  useEffect(() => {
    if (selectionSeen.current === selection.ids) return;
    const first = selectionSeen.current === null;
    selectionSeen.current = selection.ids;
    if (first && selection.ids.length === 0) return;
    const seen = new Set<string>();
    const events: CalEvent[] = [];
    for (const id of selection.ids) {
      const ev = calendarStore.get(masterIdOf(id));
      if (ev && !seen.has(ev.id)) {
        seen.add(ev.id);
        events.push(ev);
      }
    }
    onSelectionChange?.(events);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection.ids]);
  const selectedId = selection.lead;

  // announcements happen on commit, never per frame
  const { announce, politeRef, assertiveRef } = useAnnouncer();

  /** How an event's time reads out loud, from a placement or a patch. */
  const whenOf = useCallback(
    (p: {
      dayIndex: number;
      endDayIndex?: number;
      startMin?: number;
      endMin?: number;
      allDay?: boolean;
    }): WhenRef =>
      p.allDay
        ? {
            day:
              p.endDayIndex !== undefined && p.endDayIndex !== p.dayIndex
                ? `${view.namesLong[p.dayIndex] ?? ""} to ${view.namesLong[p.endDayIndex] ?? ""}`
                : view.namesLong[p.dayIndex],
            allDay: true,
          }
        : {
            day: view.namesLong[p.dayIndex],
            time:
              p.startMin !== undefined && p.endMin !== undefined
                ? g.formatRange(p.startMin, p.endMin)
                : undefined,
          },
    [view, g],
  );

  /** The store event behind a placement id, for its title. */
  const eventOf = useCallback(
    (id: string) => calendarStore.get(masterIdOf(id)) ?? { title: undefined },
    [calendarStore],
  );

  // roving tabindex: one event carries `tabIndex={0}`, the selection lead — see `lib/roving.ts`
  const order = useMemo(() => selectionOrder(placed), [placed]);
  const rovingId = rovingTarget(order, selectedId);

  const focusEvent = useFocusFollow({
    rootRef,
    surfaceRef,
    registry,
    rovingId,
    selectedId,
    count: selection.count,
    announce,
  });

  const handleReverted = useRevertAnimation({ registry, announce, eventOf });

  useViewTransitions({ rootRef, surfaceRef, pending, view, projected });

  const density = useMemo(
    () =>
      (ssr || isClient) && ready && isYear
        ? densityByDay(coloured, {
            start: range.start,
            end: range.end,
            timeZone: g.displayZone,
          })
        : EMPTY_DENSITY,
    [ssr, isClient, ready, isYear, coloured, range, g.displayZone],
  );

  const registerNode = useCallback(
    (id: string, node: HTMLElement | null) => {
      if (node) registry.set(id, node);
      else registry.delete(id);
    },
    [registry],
  );

  // engine reads events per-frame through a ref — no engine re-wiring on render
  const projectedRef = useRef(projected);
  projectedRef.current = projected;

  const resolvedConstraints = useMemo(() => createConstraints(constraints), [constraints]);
  const constraintScope = useMemo(
    () => ({ constraints: resolvedConstraints, days: view.days }),
    [resolvedConstraints, view.days],
  );

  const askScope = useRecurrenceScope();
  const {
    commitPlacement,
    commitCreate,
    commitMove,
    commitResize,
    commitSpan,
    commitDuplicate,
    toggleAllDay,
    moveByDays,
    keyboardPatch,
  } = usePlacementCommits({
    store: calendarStore,
    view,
    projectedRef,
    askScope,
    constraints: resolvedConstraints,
    announce,
    whenOf,
    eventOf,
    onDefaultCalendar,
    authoredZone,
    snapshot: (masterId) => {
      pendingMorph.current = captureSnapshot(rootRef.current, true, masterId);
    },
    onPlanSelected: (from, to) => {
      selection.setLead(to);
      setPanelId((cur) => (cur === from ? to : cur));
    },
    onCreated: setNewId,
  });

  const { onCanvasPointerDown, onEventPointerDown, onLanePointerDown, flashEdges } = useDragEngine({
    view,
    settings: g,
    scrollRef,
    canvasRef,
    draftRef,
    laneRef,
    laneDraftRef,
    openEditor: (id) => {
      setNewId((cur) => (cur === id ? cur : null));
      selection.setLead(id);
      setPanelId(id);
      // the engine only reaches here on a true click, never a drag
      const ev = calendarStore.get(masterIdOf(id));
      if (ev) onEventClick?.(ev, id);
    },
    onCanvasClick: (e) => {
      setNewId(null);
      selection.clear();
      if (onSlotClick && e) {
        const slot = slotAtPointer(e);
        if (slot && slotAllowed(resolvedConstraints, slot)) onSlotClick(slot);
      }
    },
    commitCreate,
    commitMove,
    commitResize,
    commitSpan,
    commitDuplicate,
    getTimedEvents: () => projectedRef.current.timed,
    constraints: resolvedConstraints,
    announce,
  });

  const history = useHistory(calendarStore, registry);
  // announce, then re-focus the lead if it survived, else the surface
  const withHistory = (run: () => void, say: string) => () => {
    run();
    announce(say);
    requestAnimationFrame(() => focusEvent(selectedId));
  };
  const undo = withHistory(controlled ? (onUndo ?? (() => {})) : history.undo, announceUndo());
  const redo = withHistory(controlled ? (onRedo ?? (() => {})) : history.redo, announceRedo());

  // announcement + post-delete focus wrapped around the selection handle once, not at each call site
  const speakingSelection = useMemo<KloqSelectionHandle>(
    () => ({
      ...selection,
      remove: (ids) => {
        const requested = ids ? [...ids] : [...selection.ids];

        // a single recurring instance asks which occurrences; `masterIdOf` here would delete the whole series
        if (requested.length === 1) {
          const placed = projectedRef.current.all.find((e) => e.id === requested[0]);
          const occurrence = placed?.occurrence;
          const master = placed?.source;
          if (occurrence && master && !master.readOnly && askScope) {
            // computed before the delete, while the reading order still contains it
            const next = focusAfterRemoval(order, [requested[0]]);
            void askScope({
              action: "delete",
              event: master,
              occurrence,
            }).then((scope) => {
              if (!scope) return;
              applyPlan(calendarStore, deleteOccurrence(master, occurrence, scope));
              selection.clear();
              announce(announceDeleted([master]));
              requestAnimationFrame(() => focusEvent(next));
            });
            return;
          }
        }

        // `withoutSegment` (a split lead is `${id}@0`), NOT `masterIdOf` — that would delete a whole series
        const targets = requested
          .map((id) => calendarStore.get(id) ?? calendarStore.get(withoutSegment(id)))
          .filter((e): e is CalEvent => e !== undefined && !e.readOnly);
        if (targets.length === 0) return;
        // next focus target, computed before the delete in placement ids
        const removedIds = new Set(targets.map((e) => e.id));
        const next = focusAfterRemoval(
          order,
          requested.filter((id) => removedIds.has(withoutSegment(id))),
        );
        selection.remove(ids);
        announce(announceDeleted(targets));
        requestAnimationFrame(() => focusEvent(next));
      },
      recolor: (color) => {
        selection.recolor(color);
        announce(announceColor(selection.selectedEvents(), color));
      },
      duplicate: () => {
        const events = selection.selectedEvents();
        selection.duplicate();
        if (events.length === 1) announce(announceDuplicated(events[0], {}));
        else if (events.length > 1) announce(`${events.length} events duplicated`);
      },
    }),
    [selection, order, calendarStore, announce, focusEvent, askScope],
  );

  const [commandOpen, setCommandOpen] = useState(false);
  const paletteOn = commandPalette !== false;
  const paletteCommands = typeof commandPalette === "object" ? commandPalette.commands : undefined;
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  /** Create a snap-sized event, pop it in, select it, reveal it. */
  const { quickCreate, slotAtPointer, onCanvasDoubleClick } = useQuickCreate({
    store: calendarStore,
    view,
    registry,
    canvasRef,
    onDefaultCalendar,
    authoredZone,
    constraints: resolvedConstraints,
    announce,
    whenOf,
    onCreated: (id) => {
      setNewId(id);
      selection.setLead(id);
      setPanelId(id);
    },
  });

  useCalendarKeys({
    rootRef,
    globalShortcuts,
    keymap,
    flashEdges,
    projected: placed,
    view,
    selectedId,
    registry,
    select: (id) => {
      setNewId(null);
      selection.setLead(id);
      setPanelId((cur) => (cur !== null ? id : null));
    },
    panelOpen: panelId !== null && panelId === selectedId,
    openPanel: (id) => setPanelId(id),
    clearSelection: () => {
      setNewId(null);
      setPanelId(null);
      selection.clear();
    },
    updateEvent: keyboardPatch,
    quickCreate: () => quickCreate(),
    undo,
    redo,
    openCommand: () => setCommandOpen((v) => !v),
    commandPalette: paletteOn,
    openShortcuts: () => setShortcutsOpen(true),
    stepRange: step,
    stepDay,
    navigationKeys,
    goToday,
    switchView,
    selection: speakingSelection,
  });

  useEffect(() => watchSystemScheme(), []);
  const { initialScrollTop } = useGridMount({ rootRef, scrollRef, canvasRef, laneRef, isTimeGrid });

  // A rule edit can rename the occurrence under the panel (`id` → `id#instant`
  // when an event starts repeating) or drop it entirely (weekly → monthly).
  // Stay on the same series instead of losing the panel mid-edit.
  const selectedEvent = selectedId ? (placed.find((e) => e.id === selectedId) ?? null) : null;
  // the panel reads day-column placements; a timeline bar is re-expressed as one
  const timelinePanel =
    timelinePlaced && selectedEvent ? panelPlacement(selectedEvent, g.displayZone, g.locale) : null;

  // the selection follows its series through a rule edit (see use-selection);
  // the panel follows the selection, render-phase so it never unmounts in between
  if (
    panelId !== null &&
    selectedId !== null &&
    panelId !== selectedId &&
    masterIdOf(panelId) === masterIdOf(selectedId)
  ) {
    setPanelId(selectedId);
  }

  const panelOpen = panelId !== null && panelId === selectedId;

  // pointer and Enter selection: opens the panel unless told not to
  const select = useStable((id: string | null, opts?: { isNew?: boolean; open?: boolean }) => {
    setNewId(opts?.isNew ? id : null);
    selection.setLead(id);
    setPanelId(opts?.open === false ? null : id);
  });
  const onMoveByDays = useStable(moveByDays);
  const resetAll = useStable(() => {
    selection.clear();
    calendarStore.reset();
  });
  const openShortcuts = useStable(() => setShortcutsOpen(true));
  const paletteQuickCreate = useStable(() => quickCreate());
  const paletteSelectEvent = useStable((e: CalEvent) => {
    pendingMorph.current = captureSnapshot(rootRef.current);
    setNewId(null);
    applyDate(new Date(parseInstant(e.start)));
    selection.setLead(e.id);
    setPanelId(e.id);
    requestAnimationFrame(() =>
      requestAnimationFrame(() =>
        registry.get(e.id)?.scrollIntoView({ block: "center", behavior: "smooth" }),
      ),
    );
  });
  const closePanel = useStable(() => {
    setNewId(null);
    setPanelId(null);
  });
  // the panel's discard path: a just-created event is thrown away, anything else just closes
  const discardPanel = useStable(() => {
    if (newId !== null && selectedEvent && eventKeyOf(selectedEvent) === newId) {
      calendarStore.remove(newId);
      selection.clear();
    }
    setNewId(null);
    setPanelId(null);
  });

  // what the chrome parts and `useKloq()` see; memoised so unrelated state doesn't re-render consumers
  const chrome: KloqChrome = useMemo(
    () => ({
      view,
      viewSetting: effectiveView,
      collapsed: responsiveView.collapsed,
      narrow: responsiveView.width > 0 ? responsiveView.narrow : undefined,
      ready,
      timeline: lanes !== undefined,
      fits: (v: KloqView) =>
        !resolveEffectiveView(responsiveView.width, v, responsiveView.config).collapsed,
      date: anchorDate,
      atToday: view.todayIndex >= 0,
      lastStep,
      step,
      goToday,
      switchView,
      jumpToDay,
      goToDate: applyDate,
      reset: () => {
        selection.clear();
        calendarStore.reset();
      },
      openCommand: paletteOn ? () => setCommandOpen((v) => !v) : () => {},
      openShortcuts: () => setShortcutsOpen(true),
      keymap,
    }),
    [
      view,
      effectiveView,
      viewSetting,
      responsiveView.collapsed,
      responsiveView.narrow,
      responsiveView.width,
      responsiveView.config,
      anchorDate,
      lastStep,
      step,
      goToday,
      switchView,
      jumpToDay,
      applyDate,
      selection,
      calendarStore,
      keymap,
      paletteOn,
      lanes,
      ready,
    ],
  );

  return (
    <DesignModeProvider scopeRef={rootRef} globalToggle={globalShortcuts}>
      <AnnounceProvider value={announce}>
        <StoreProvider value={calendarStore}>
          <SelectionProvider value={speakingSelection}>
            <ChromeProvider value={chrome}>
              <ConstraintsProvider value={constraintScope}>
                {/* `h-full`, never `h-dvh`: the component fills whatever box the host gives it */}
                <div
                  ref={rootRef}
                  data-kloq-root
                  data-kloq-theme={theme && theme !== "coss" ? theme : undefined}
                  onDoubleClick={(e) => {
                    if (!onEventDoubleClick) return;
                    const el = (e.target as Element).closest<HTMLElement>("[data-cal-event]");
                    const id = el?.dataset.calEvent;
                    if (!id) return;
                    const ev = calendarStore.get(masterIdOf(id));
                    if (ev) onEventDoubleClick(ev, id);
                  }}
                  className={cn("flex h-full flex-col overflow-hidden", scheme, className)}
                  style={
                    {
                      "--kloq-hour-height": `${g.hourHeight}px`,
                      "--kloq-gutter-width": `${gutterWidth}px`,
                    } as React.CSSProperties
                  }
                >
                  {children}

                  <LiveRegions politeRef={politeRef} assertiveRef={assertiveRef} />

                  {/* the focus target of last resort; `tabIndex={-1}` so it is not an extra tab stop */}
                  <div
                    ref={surfaceRef}
                    role="region"
                    tabIndex={-1}
                    aria-label={
                      ready ? `${viewLabel(viewSetting)}, ${rangeLabel}` : viewLabel(viewSetting)
                    }
                    /* no focus ring: a landing pad, never tabbed to */
                    className="relative isolate flex min-h-0 flex-1 flex-col outline-none"
                  >
                    {/* not ready = no date to print yet: the structure at its final size, nothing that names a day */}
                    {!ready && !isTimeGrid ? null : view.kind === "year" ? (
                      <YearView
                        view={view}
                        weekStartsOn={weekStartsOn}
                        density={density}
                        onOpenDay={jumpToDay}
                        onOpenMonth={openMonth}
                      />
                    ) : view.kind === "month" ? (
                      <MonthView
                        view={view}
                        compact={responsiveView.narrow}
                        events={projected.all}
                        selectedId={selectedId}
                        registerNode={registerNode}
                        onSelect={select}
                        onOpenDay={jumpToDay}
                        viewSetting={effectiveView}
                        onSwitchView={switchView}
                        rovingId={rovingId}
                        onMoveByDays={onMoveByDays}
                      />
                    ) : view.kind === "agenda" ? (
                      <AgendaView
                        view={view}
                        events={projected.all}
                        selectedId={selectedId}
                        registerNode={registerNode}
                        onSelect={select}
                        onOpenDay={jumpToDay}
                        viewSetting={effectiveView}
                        onSwitchView={switchView}
                        rovingId={rovingId}
                      />
                    ) : view.kind === "timeline" ? (
                      <TimelineApp
                        lanes={lanes ?? EMPTY_LANES}
                        adapter={laneAdapter ?? DEFAULT_LANE_ADAPTER}
                        window={resolvedTimelineWindow}
                        selectedId={selectedId}
                        onSelect={select}
                        registerNode={registerNode}
                        workingHours={workingHours}
                        rovingId={rovingId}
                        onDefaultCalendar={onDefaultCalendar}
                        authoredZone={authoredZone}
                        announce={announce}
                        events={timelinePlaced ?? undefined}
                        keymap={keymap}
                      />
                    ) : (
                      <GutterDateProvider value={gutterDate}>
                        {!ready ? (
                          <div aria-hidden className="h-9 shrink-0 border-b" />
                        ) : (
                          <div
                            className="relative grid shrink-0 border-b ps-(--kloq-gutter-width)"
                            style={{
                              gridTemplateColumns: `repeat(${view.dayCount}, minmax(0, 1fr))`,
                            }}
                          >
                            {/* gutter corner: the ISO week of the first visible day, and the sticky zone labels */}
                            <div className="absolute inset-y-0 start-0 flex w-(--kloq-gutter-width) flex-col items-stretch justify-center gap-0.5">
                              {showWeekNumbers && view.days.length > 0 ? (
                                <abbr
                                  title={`ISO week ${isoWeek(view.days[0])}`}
                                  className={cn(ZONE_CAPTION, "self-center no-underline")}
                                >
                                  W{isoWeek(view.days[0])}
                                </abbr>
                              ) : null}
                              <GutterZoneLabels day={gutterDate} onPress={onTimeZonesClick} />
                            </div>
                            {view.days.map((d, i) => (
                              <C.DayHeader
                                key={d.toDateString()}
                                date={d}
                                index={i}
                                isToday={i === view.todayIndex}
                                nameShort={view.namesShort[i]}
                              />
                            ))}
                          </div>
                        )}

                        {!ready ? (
                          <AllDayLaneFrame />
                        ) : (
                          <AllDayLane
                            events={projected.allDay}
                            dayCount={view.dayCount}
                            dayNamesShort={view.namesShort}
                            laneRef={laneRef}
                            laneDraftRef={laneDraftRef}
                            selectedId={selectedId}
                            registerNode={registerNode}
                            onLanePointerDown={onLanePointerDown}
                            onEventPointerDown={onEventPointerDown}
                            days={view.days}
                            onSelect={select}
                            rovingId={rovingId}
                            cramped={cramped}
                          />
                        )}

                        <div className="relative flex min-h-0 flex-1 flex-col">
                          {/* before the grid in the DOM: its tab stop comes and goes with the time of day,
                    and must never sit between the grid and the event panel */}
                          {ready ? (
                            <JumpToNow
                              scrollRef={scrollRef}
                              todayIndex={view.todayIndex}
                              narrow={responsiveView.narrow}
                            />
                          ) : null}
                          <div
                            ref={scrollRef}
                            data-cal-scroll
                            data-craft="edge-scroll"
                            className="min-h-0 flex-1 overflow-y-auto overscroll-none"
                          >
                            {!ready ? (
                              <WeekGridFrame />
                            ) : (
                              <WeekGrid
                                events={projected.timed}
                                dayCount={view.dayCount}
                                dayNamesShort={view.namesShort}
                                todayIndex={view.todayIndex}
                                canvasRef={canvasRef}
                                scrollRef={scrollRef}
                                draftRef={draftRef}
                                registerNode={registerNode}
                                registry={registry}
                                onCanvasPointerDown={onCanvasPointerDown}
                                onCanvasDoubleClick={onCanvasDoubleClick}
                                onEventPointerDown={onEventPointerDown}
                                selectedId={selectedId}
                                workingHours={workingHours}
                                days={view.days}
                                viewSetting={effectiveView}
                                onSwitchView={switchView}
                                onSelect={select}
                                rovingId={rovingId}
                                cramped={cramped}
                              />
                            )}
                          </div>
                          {ssr || !ready ? (
                            /* pre-paint scroll: the layout effect runs at hydration, after SSR HTML painted at midnight */
                            <script
                              dangerouslySetInnerHTML={{
                                __html: `(function(){var s=document.currentScript;if(!s)return;var el=s.previousElementSibling;if(el&&!el.scrollTop)el.scrollTop=${initialScrollTop};})()`,
                              }}
                            />
                          ) : null}
                        </div>
                      </GutterDateProvider>
                    )}
                  </div>

                  <ExitPresence>
                    {selectedEvent && panelOpen ? (
                      <C.EventPanel
                        event={timelinePanel?.event ?? selectedEvent}
                        onSelectOccurrence={(id, date) => {
                          const day = startOfLocalDay(date).getTime();
                          if (!view.days.some((d) => startOfLocalDay(d).getTime() === day))
                            applyDate(date);
                          selection.setLead(id);
                          setPanelId(id);
                        }}
                        currentUserEmail={currentUserEmail}
                        dayNamesLong={timelinePanel?.namesLong ?? view.namesLong}
                        dayNamesShort={timelinePanel?.namesShort ?? view.namesShort}
                        /* `eventKeyOf`: a new event can already be split, with lead placement `${id}@0` */
                        isNew={newId !== null && eventKeyOf(selectedEvent) === newId}
                        getAnchor={(id) => nodeFor(registry, id) ?? null}
                        onToggleAllDay={(allDay) => toggleAllDay(selectedEvent, allDay)}
                        onEditTime={(startMin, endMin) => {
                          // minutes are in the event's OWN day (endMin past 1440 = next day), anchored off its real start
                          const was = minutesOfDate(
                            displayDate(parseInstant(selectedEvent.start), g.displayZone),
                          );
                          const start = instantPlus(
                            selectedEvent.start,
                            startMin - was,
                            g.displayZone,
                          );
                          void commitPlacement(
                            selectedEvent.id,
                            {
                              start,
                              end: instantPlus(start, endMin - startMin, g.displayZone),
                            },
                            announceResized(selectedEvent.source, {
                              time: g.formatRange(startMin, endMin),
                            }),
                          );
                        }}
                        onClose={closePanel}
                        onCancel={discardPanel}
                      />
                    ) : null}
                  </ExitPresence>

                  {paletteOn ? (
                    <KloqCommandMenu
                      keymap={keymap}
                      commands={paletteCommands}
                      open={commandOpen}
                      onOpenChange={setCommandOpen}
                      selectedEvent={selectedEvent?.source ?? null}
                      selectedOccurrence={selectedEvent?.occurrence ?? null}
                      days={view.days}
                      namesLong={view.namesLong}
                      viewSetting={effectiveView}
                      onSwitchView={switchView}
                      onJumpToDay={jumpToDay}
                      onToday={goToday}
                      onQuickCreate={paletteQuickCreate}
                      onReset={resetAll}
                      onShortcuts={openShortcuts}
                      /* search reads the whole store, not the visible projection */
                      events={events}
                      onStepRange={step}
                      defaultDurationMin={DEFAULT_QUICK_ADD_MIN}
                      onSelectEvent={paletteSelectEvent}
                    />
                  ) : null}
                  <ShortcutsOverlay
                    open={shortcutsOpen}
                    onOpenChange={setShortcutsOpen}
                    keymap={keymap}
                    commandPalette={paletteOn}
                    onCustomize={onCustomizeKeybinds}
                  />

                  {dmEnabled ? <DesignModeOverlay /> : null}
                  {dmHint ? <DesignModeHint /> : null}
                </div>
              </ConstraintsProvider>
            </ChromeProvider>
          </SelectionProvider>
        </StoreProvider>
      </AnnounceProvider>
    </DesignModeProvider>
  );
}
