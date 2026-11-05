"use client";

import * as React from "react";
import type { KloqSettings } from "../lib/calendar-config";
import { getCalendarSources } from "../lib/calendar-sources";
import type { KloqStore } from "../lib/calendar-store";
import { type CalEvent, formatMinutes, parseInstant, snapMinutes } from "../lib/calendar-types";
import { displayDate, minutesOfDate } from "../lib/instant";
import { masterIdOf } from "../lib/recurrence";
import { Kbd } from "../ui/kbd";
import { useDesignMode } from "./design-mode-provider";
import { Row, Section, Toggle } from "./panel";
import { composite, contrastLabel, hex, pageBackground, resolveColor } from "./resolve-color";
import { timelineAxisOf } from "./timeline-axis";

interface InspectInfo {
  kind: "event" | "slot" | "lane" | "element";
  /** headline in the badge */
  label: string;
  rows: [string, string][];
  rect: DOMRect;
}

interface InspectState {
  info: InspectInfo | null;
  frozen: boolean;
}

let state: InspectState = { info: null, frozen: false };
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

const inspectStore = {
  get: () => state,
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  set(info: InspectInfo | null) {
    if (state.frozen) return;
    state = { ...state, info };
    notify();
  },
  freeze(on: boolean) {
    state = { ...state, frozen: on };
    notify();
  },
};

/* ── describing what's under the pointer ─────────────────────────── */

const px = (v: string) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? String(Math.round(n * 10) / 10) : "0";
};

function shorthand(t: string, r: string, b: string, l: string): string {
  const [T, R, B, L] = [px(t), px(r), px(b), px(l)];
  if (T === R && R === B && B === L) return T;
  if (T === B && R === L) return `${T} ${R}`;
  return `${T} ${R} ${B} ${L}`;
}

function describeElement(el: HTMLElement, rect: DOMRect): InspectInfo {
  const cs = getComputedStyle(el);
  const rows: [string, string][] = [
    ["size", `${Math.round(rect.width)} × ${Math.round(rect.height)}`],
  ];
  const radius = shorthand(
    cs.borderTopLeftRadius,
    cs.borderTopRightRadius,
    cs.borderBottomRightRadius,
    cs.borderBottomLeftRadius,
  );
  if (radius !== "0") rows.push(["radius", radius]);
  const pad = shorthand(cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft);
  if (pad !== "0") rows.push(["padding", pad]);
  if (el.textContent?.trim())
    rows.push(["type", `${px(cs.fontSize)}/${px(cs.lineHeight)} · ${cs.fontWeight}`]);
  if (/^(flex|grid|inline-flex|inline-grid)$/.test(cs.display)) {
    const gap = cs.columnGap === cs.rowGap ? px(cs.rowGap) : `${px(cs.rowGap)} ${px(cs.columnGap)}`;
    rows.push(["layout", `${cs.display}${gap !== "0" ? ` · gap ${gap}` : ""}`]);
  }
  if (px(cs.borderTopWidth) !== "0") rows.push(["border", px(cs.borderTopWidth)]);
  const tag = el.tagName.toLowerCase();
  const name = el.dataset.slot
    ? `${tag}[data-slot=${el.dataset.slot}]`
    : el.getAttribute("role")
      ? `${tag}[${el.getAttribute("role")}]`
      : tag;
  return { kind: "element", label: name, rows, rect };
}

const timeOf = (instant: string, g: KloqSettings) => {
  const ms = parseInstant(instant);
  if (Number.isNaN(ms)) return instant;
  return new Date(ms).toLocaleTimeString(g.locale, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: g.displayZone,
  });
};

function describeEvent(
  block: HTMLElement,
  event: CalEvent | undefined,
  g: KloqSettings,
  root: HTMLElement | null,
): InspectInfo {
  const rect = block.getBoundingClientRect();
  const cs = getComputedStyle(block);
  const bg = resolveColor(cs.backgroundColor);
  const ink = resolveColor(cs.color);
  const flatBg = bg ? composite(bg, pageBackground(root)) : null;
  const rows: [string, string][] = [];
  const id = block.dataset.calEvent ?? "";
  if (event) {
    rows.push(["id", id]);
    rows.push([
      "when",
      event.allDay
        ? `${event.start} → ${event.end}`
        : `${timeOf(event.start, g)} – ${timeOf(event.end, g)}`,
    ]);
    const cal = event.calendarId
      ? getCalendarSources().find((c) => c.id === event.calendarId)
      : undefined;
    if (cal) rows.push(["calendar", cal.name]);
    rows.push(["color", event.color ?? (cal ? `${cal.color} (inherited)` : "default")]);
    if (event.rrule) rows.push(["rrule", event.rrule]);
  } else rows.push(["id", id]);
  const { day, col, cols, endDay } = block.dataset;
  const lane = block.closest('[data-slot="timeline-lane"]')?.getAttribute("aria-label");
  if (lane) rows.push(["lane", lane]);
  else if (endDay !== undefined) rows.push(["days", `${Number(day) + 1} → ${Number(endDay) + 1}`]);
  else if (day !== undefined)
    rows.push(["column", `day ${Number(day) + 1} · ${Number(col) + 1}/${cols}`]);
  rows.push(["size", `${Math.round(rect.width)} × ${Math.round(rect.height)}`]);
  rows.push([
    "bg",
    `${hex(flatBg)}${bg && (bg.a ?? 1) < 1 ? ` · ${Math.round((bg.a ?? 1) * 100)}%` : ""}`,
  ]);
  rows.push(["ink", hex(ink)]);
  rows.push(["contrast", contrastLabel(ink, flatBg)]);
  return { kind: "event", label: event?.title || id, rows, rect };
}

function dayLabel(canvas: HTMLElement, day: number): string {
  const lists = canvas.querySelectorAll<HTMLElement>(':scope > [role="list"]');
  const label = lists[day]?.getAttribute("aria-label") ?? "";
  return label.split(",")[0] || `day ${day + 1}`;
}

function describeSlot(canvas: HTMLElement, x: number, y: number, g: KloqSettings): InspectInfo {
  const rect = canvas.getBoundingClientRect();
  const dayCount = canvas.querySelectorAll(':scope > [role="list"]').length || 1;
  const colW = rect.width / dayCount;
  const day = Math.max(0, Math.min(dayCount - 1, Math.floor((x - rect.left) / colW)));
  const raw = g.clampMinutes(g.pxToMinutes(y - rect.top));
  const snapped = g.clampMinutes(snapMinutes(raw, g.snapMinutes));
  const top = rect.top + g.minutesToPx(snapped);
  const slotRect = new DOMRect(
    rect.left + day * colW,
    top,
    colW,
    g.minutesToPx(snapped + g.snapMinutes) - g.minutesToPx(snapped),
  );
  return {
    kind: "slot",
    label: `${dayLabel(canvas, day)} · ${formatMinutes(snapped, g.timeFormat)}`,
    rows: [
      ["day", dayLabel(canvas, day)],
      ["pointer", formatMinutes(raw, g.timeFormat)],
      [
        "snaps to",
        `${formatMinutes(snapped, g.timeFormat)} (${g.snapMinutes} min · ⌥ ${g.snapFineMinutes})`,
      ],
      ["scale", `${g.hourHeight}px / hour`],
      [
        "day range",
        `${formatMinutes(g.dayStartMin, g.timeFormat)} – ${formatMinutes(g.dayEndMin, g.timeFormat)}`,
      ],
    ],
    rect: slotRect,
  };
}

/** A timeline cell: the lane under the pointer and the slot it snaps to. */
function describeLaneSlot(row: HTMLElement, x: number, g: KloqSettings): InspectInfo | null {
  const axis = timelineAxisOf(row.closest('[data-slot="timeline"]'));
  if (!axis) return null;
  const rect = row.getBoundingClientRect();
  const perMin = axis.slotPx / axis.slotMinutes;
  const raw = Math.max(0, (x - rect.left) / perMin);
  const snapped = Math.floor(raw / axis.slotMinutes) * axis.slotMinutes;
  const clock = (min: number) =>
    formatMinutes(
      minutesOfDate(displayDate(axis.startMs + min * 60_000, g.displayZone)),
      g.timeFormat,
    );
  const lane =
    row.closest('[data-slot="timeline-lane"]')?.getAttribute("aria-label") ??
    row.dataset.lane ??
    "lane";
  return {
    kind: "slot",
    label: `${lane} · ${clock(snapped)}`,
    rows: [
      ["lane", lane],
      ["pointer", clock(raw)],
      ["snaps to", `${clock(snapped)} (${axis.slotMinutes} min)`],
      ["scale", `${Math.round(perMin * 60)}px / hour`],
      ["row", `${Math.round(rect.height)}px tall`],
    ],
    rect: new DOMRect(rect.left + snapped * perMin, rect.top, axis.slotPx, rect.height),
  };
}

function describeAt(
  x: number,
  y: number,
  store: KloqStore | null,
  g: KloqSettings,
  root: HTMLElement | null,
): InspectInfo | null {
  const hit = document.elementFromPoint(x, y) as HTMLElement | null;
  if (
    !hit ||
    hit.closest("[data-design-overlay]") ||
    hit === document.documentElement ||
    hit === document.body
  )
    return null;
  // an embedded calendar inspects itself, never the page around it
  if (root && !root.contains(hit)) return null;
  const block = hit.closest<HTMLElement>("[data-cal-event]");
  if (block) {
    const id = block.dataset.calEvent ?? "";
    return describeEvent(block, store?.get(masterIdOf(id)), g, root);
  }
  const canvas = hit.closest<HTMLElement>("[data-cal-canvas]");
  if (canvas) return describeSlot(canvas, x, y, g);
  const laneRow = hit.closest<HTMLElement>('[data-slot="timeline-row"]');
  if (laneRow)
    return describeLaneSlot(laneRow, x, g) ?? describeElement(hit, hit.getBoundingClientRect());
  const lane = hit.closest<HTMLElement>("[data-cal-lane]");
  if (lane) {
    const rect = lane.getBoundingClientRect();
    return {
      kind: "lane",
      label: "all-day lane",
      rows: [["size", `${Math.round(rect.width)} × ${Math.round(rect.height)}`]],
      rect,
    };
  }
  return describeElement(hit, hit.getBoundingClientRect());
}

/* ── the layer: outline + badge, written imperatively ────────────── */

export function InspectLayer({
  store,
  settings,
}: {
  store: KloqStore | null;
  settings: KloqSettings;
}) {
  const { scopeRef } = useDesignMode();
  const outlineRef = React.useRef<HTMLDivElement>(null);
  const badgeRef = React.useRef<HTMLDivElement>(null);
  const latest = React.useRef({ store, settings, scopeRef });
  React.useEffect(() => {
    latest.current = { store, settings, scopeRef };
  });

  React.useEffect(() => {
    const outline = outlineRef.current!;
    const badge = badgeRef.current!;
    const paint = () => {
      const { info } = inspectStore.get();
      if (!info) {
        outline.style.visibility = "hidden";
        return;
      }
      const { rect } = info;
      outline.style.visibility = "visible";
      outline.style.transform = `translate(${rect.left}px, ${rect.top}px)`;
      outline.style.width = `${rect.width}px`;
      outline.style.height = `${rect.height}px`;
      outline.dataset.kind = info.kind;
      badge.textContent = info.label;
    };
    let raf = 0;
    let last = { x: -1, y: -1 };
    const describe = () => {
      const { store, settings, scopeRef } = latest.current;
      inspectStore.set(describeAt(last.x, last.y, store, settings, scopeRef?.current ?? null));
    };
    const schedule = () => {
      if (last.x < 0) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(describe);
    };
    const onMove = (e: MouseEvent) => {
      last = { x: e.clientX, y: e.clientY };
      schedule();
    };
    const onClick = (e: MouseEvent) => {
      if (!e.altKey || (e.target as HTMLElement).closest("[data-design-overlay]")) return;
      e.preventDefault();
      e.stopPropagation();
      inspectStore.freeze(!inspectStore.get().frozen);
      if (!inspectStore.get().frozen) describe();
    };
    const onLeave = () => inspectStore.set(null);
    const unsub = inspectStore.subscribe(paint);
    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("click", onClick, true);
    window.addEventListener("scroll", schedule, { capture: true, passive: true });
    document.documentElement.addEventListener("mouseleave", onLeave);
    return () => {
      cancelAnimationFrame(raf);
      unsub();
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("click", onClick, true);
      window.removeEventListener("scroll", schedule, { capture: true });
      document.documentElement.removeEventListener("mouseleave", onLeave);
      inspectStore.freeze(false);
      inspectStore.set(null);
    };
  }, []);

  return (
    <div ref={outlineRef} className="dm-inspect-outline start-0 top-0" aria-hidden>
      <div ref={badgeRef} className="dm-inspect-badge" />
    </div>
  );
}

/* ── the panel section ───────────────────────────────────────────── */

export function InspectSection() {
  const { info, frozen } = React.useSyncExternalStore(
    inspectStore.subscribe,
    inspectStore.get,
    inspectStore.get,
  );
  return (
    <Section id="inspect" title="Inspect" summary={info?.label ?? "hover anything"}>
      {info ? (
        <>
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate font-sans text-xs font-medium">{info.label}</span>
            <span className="shrink-0 text-muted-foreground">{info.kind}</span>
          </div>
          {info.rows.map(([k, v]) => (
            <Row key={k} label={k}>
              {v}
            </Row>
          ))}
        </>
      ) : (
        <p className="font-sans text-muted-foreground">
          Hover an event for its store record, color and contrast; a grid cell for the slot it snaps
          to.
        </p>
      )}
      <Toggle
        id="dm-freeze"
        label={
          <span>
            Freeze <Kbd>⌥</Kbd> click
          </span>
        }
        checked={frozen}
        onChange={inspectStore.freeze}
      />
    </Section>
  );
}
