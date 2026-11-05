import {
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { announceFolded, announceView, describeRange } from "../lib/announce";
import { formatDate } from "../lib/date-format";
import { addDays, startOfLocalDay } from "../lib/instant";
import {
  formatViewTitle,
  rangeOfView,
  type StepDirection,
  stepAnchor,
  todayAnchor,
} from "../lib/navigation";
import type { Projection } from "../lib/projection";
import type { ResponsiveSetting } from "../lib/responsive";
import { useIsClient } from "../lib/use-is-client";
import { useLatest } from "../lib/use-latest";
import { isTimeGridView, type KloqView, resolveView, type ViewDescriptor } from "../lib/view";
import { useKloqSettings } from "./settings-context";
import { useResponsiveView } from "./use-responsive";
import { captureSnapshot, playRangeSlide, playViewMorph, type Snapshot } from "./view-morph";
import { capabilitiesOf } from "./view-registry";

const MONTH_DAY: Intl.DateTimeFormatOptions = { month: "long", day: "numeric" };

/** What the structure is resolved around while the real date is unknown. Never printed. */
const NEUTRAL_DATE = new Date(2024, 0, 1);

export function viewLabel(view: KloqView): string {
  if (typeof view === "number") return `${view} day view`;
  return `${view[0].toUpperCase()}${view.slice(1)} view`;
}

export interface ViewNavigationOptions {
  viewProp?: KloqView;
  defaultView?: KloqView;
  onViewChange?: (view: KloqView) => void;
  dateProp?: Date;
  defaultDate?: Date;
  onDateChange?: (date: Date) => void;
  responsive?: ResponsiveSetting;
  weekStartsOn: number;
  rangePadding: number | { before: number; after: number };
  onRangeChange?: (start: Date, end: Date) => void;
  rootRef: RefObject<HTMLDivElement | null>;
  /** clear selection state before the view or date moves */
  onNavigate: () => void;
  /** after a view switch — selection is gone, so give focus a home */
  onViewSwitched: () => void;
  announce: (message: string) => void;
}

export interface PendingTransitions {
  morph: RefObject<Snapshot | null>;
  slide: RefObject<StepDirection | null>;
}

export function useViewNavigation({
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
  onNavigate,
  onViewSwitched,
  announce,
}: ViewNavigationOptions) {
  const g = useKloqSettings();
  const latest = useLatest({ onNavigate, onViewSwitched, announce });

  // view + anchor date: controlled when the prop is present
  const viewControlled = viewProp !== undefined;
  const [viewState, setViewState] = useState<KloqView>(defaultView ?? "week");
  const viewSetting = viewControlled ? viewProp : viewState;

  // responsive collapse: `viewSetting` is the intent, `effectiveView` is what renders
  const switchViewRef = useRef<(v: KloqView) => void>(() => {});
  const responsiveView = useResponsiveView({
    hostRef: rootRef,
    view: viewSetting,
    responsive,
    onRequestView: (v) => switchViewRef.current(v),
  });
  const effectiveView = responsiveView.effective;

  const dateControlled = dateProp !== undefined;
  // "today", the runtime's locale and its time zone are client facts. Without a host-supplied
  // date and locale the server and the hydration pass render a date-neutral frame instead.
  const isClient = useIsClient();
  const ready = isClient || ((dateProp ?? defaultDate) !== undefined && g.locale !== undefined);
  const [dateState, setDateState] = useState<Date | null>(() => defaultDate ?? null);
  // the uncontrolled anchor starts on the display zone's today, not the browser's
  const clientToday = useMemo(
    () => (isClient ? g.displayNow() : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isClient],
  );
  const anchorDate = dateControlled ? dateProp : (dateState ?? clientToday ?? NEUTRAL_DATE);

  const applyView = useCallback(
    (next: KloqView) => {
      if (!viewControlled) setViewState(next);
      onViewChange?.(next);
    },
    [viewControlled, onViewChange],
  );
  const applyDate = useCallback(
    (next: Date) => {
      if (!dateControlled) setDateState(next);
      onDateChange?.(next);
    },
    [dateControlled, onDateChange],
  );

  const dateKey = anchorDate.toDateString();
  const view = useMemo(
    () => {
      const resolved = resolveView(effectiveView, weekStartsOn, anchorDate, {
        locale: g.locale,
        // decides which column is "today"
        timeZone: g.displayZone,
      });
      // the server's "today" is not the visitor's
      return isClient ? resolved : { ...resolved, todayIndex: -1 };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [effectiveView, weekStartsOn, dateKey, g.locale, g.displayZone, isClient],
  );

  const switchView = useCallback(
    (next: KloqView) => {
      if (next === viewSetting) return;
      pendingMorph.current = captureSnapshot(rootRef.current);
      latest.current.onNavigate();
      applyView(next);
      latest.current.onViewSwitched();
    },
    [viewSetting, applyView],
  );
  switchViewRef.current = switchView;

  /** ⌘K "Jump to day" / a month or agenda date — day view on that date. */
  const jumpToDay = useCallback(
    (d: Date) => {
      pendingMorph.current = captureSnapshot(rootRef.current);
      latest.current.onNavigate();
      applyDate(d);
      applyView("day");
    },
    [applyDate, applyView],
  );

  /** A year view's month heading — the other half of drilling in. */
  const openMonth = useCallback(
    (month: Date) => {
      pendingMorph.current = captureSnapshot(rootRef.current);
      latest.current.onNavigate();
      applyDate(new Date(month.getFullYear(), month.getMonth(), 1));
      applyView("month");
    },
    [applyDate, applyView],
  );

  // `lastStep` is state because the nav reads it during render to pick its title's slide direction
  const [lastStep, setLastStep] = useState<StepDirection | null>(null);
  const pendingSlide = useRef<StepDirection | null>(null);
  const pendingMorph = useRef<Snapshot | null>(null);

  const step = useCallback(
    (dir: StepDirection) => {
      setLastStep(dir);
      pendingSlide.current = dir;
      latest.current.onNavigate();
      applyDate(stepAnchor(effectiveView, anchorDate, dir));
    },
    [effectiveView, anchorDate, applyDate],
  );

  // one day, whatever the view — `navigationKeys: "day"`
  const stepDay = useCallback(
    (dir: StepDirection) => {
      setLastStep(dir);
      pendingSlide.current = dir;
      latest.current.onNavigate();
      applyDate(addDays(startOfLocalDay(anchorDate), dir));
    },
    [anchorDate, applyDate],
  );

  const goToday = useCallback(() => {
    const next = todayAnchor(effectiveView);
    const dir: StepDirection = next.getTime() < startOfLocalDay(anchorDate).getTime() ? -1 : 1;
    setLastStep(dir);
    pendingSlide.current = dir;
    applyDate(next);
  }, [effectiveView, anchorDate, applyDate]);

  const range = useMemo(() => rangeOfView(view), [view]);

  // the surface's accessible name and the live-region sentence, built once so they can't drift
  const rangeLabel = useMemo(
    () =>
      capabilitiesOf(view.kind).projects === "range"
        ? formatViewTitle(view, g.locale)
        : describeRange(view.days, (d: Date) => formatDate(d, g.locale, MONTH_DAY)),
    [view, g.locale],
  );
  const rangeCb = useRef(onRangeChange);
  // declared BEFORE the effect that reads it, so the mount fire sees the real callback
  useEffect(() => {
    rangeCb.current = onRangeChange;
  });
  const rangeKey = `${range.start.getTime()}:${range.end.getTime()}`;
  const padBefore = typeof rangePadding === "number" ? rangePadding : rangePadding.before;
  const padAfter = typeof rangePadding === "number" ? rangePadding : rangePadding.after;
  useEffect(() => {
    if (!ready) return;
    rangeCb.current?.(addDays(range.start, -padBefore), addDays(range.end, padAfter));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeKey, padBefore, padAfter, ready]);

  // one "where am I" announcement watching the result, not the six call sites; silent on mount
  const lastWhere = useRef<string | null>(null);
  const lastIntent = useRef(viewSetting);
  useEffect(() => {
    if (!ready) return;
    const key = `${effectiveView}:${rangeKey}`;
    // asked for a view the box cannot fit: say so, since nothing else on screen does
    const folded = lastIntent.current !== viewSetting && responsiveView.collapsed;
    lastIntent.current = viewSetting;
    if (lastWhere.current === null) {
      lastWhere.current = key;
      return;
    }
    if (lastWhere.current === key && !folded) return;
    lastWhere.current = key;
    const where = announceView(viewLabel(effectiveView), rangeLabel);
    latest.current.announce(folded ? announceFolded(viewLabel(viewSetting), where) : where);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveView, rangeKey, viewSetting, ready]);

  return {
    viewSetting,
    effectiveView,
    responsiveView,
    anchorDate,
    view,
    /** false on the server and the hydration pass when the host gave no date + locale to render from */
    ready,
    isTimeGrid: isTimeGridView(view.kind),
    lastStep,
    switchView,
    jumpToDay,
    openMonth,
    step,
    stepDay,
    goToday,
    applyView,
    applyDate,
    range,
    rangeLabel,
    pending: { morph: pendingMorph, slide: pendingSlide } as PendingTransitions,
  };
}

/** Play a queued view morph or range slide once the render that lands it has committed. */
export function useViewTransitions({
  rootRef,
  surfaceRef,
  pending,
  view,
  projected,
}: {
  rootRef: RefObject<HTMLElement | null>;
  surfaceRef: RefObject<HTMLElement | null>;
  pending: PendingTransitions;
  view: ViewDescriptor;
  projected: Projection;
}) {
  useLayoutEffect(() => {
    if (pending.morph.current) {
      const snap = pending.morph.current;
      pending.morph.current = null;
      pending.slide.current = null;
      playViewMorph(rootRef.current, snap);
      return;
    }
    const dir = pending.slide.current;
    pending.slide.current = null;
    if (dir) playRangeSlide(surfaceRef.current, dir);
    // `projected` so a commit morph plays on the render that lands it
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, projected]);
}
