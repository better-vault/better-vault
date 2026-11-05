"use client";

import * as React from "react";
import type { KloqSettings } from "../lib/calendar-config";
import { formatDaySpan, formatRange } from "../lib/calendar-types";
import { type CraftEvent, craftBus } from "../lib/craft-bus";
import { displayDate, minutesOfDate } from "../lib/instant";
import {
  getMotion,
  MOTION_DEFAULTS,
  type MotionState,
  resetMotion,
  type SpringSpec,
  setMotion,
  springSamples,
  subscribeMotion,
} from "../lib/springs";
import { Button } from "../ui/button";
import { useDesignMode } from "./design-mode-provider";
import { Range, Row, Section, Segmented, Toggle } from "./panel";
import { timelineAxisOf } from "./timeline-axis";

const SPARK_W = 240;
const SPARK_H = 36;
const MIN_V = 300;

/* ── telemetry: written straight to DOM per frame ────────────────── */

function Telemetry({ settings }: { settings: KloqSettings }) {
  const { scopeRef } = useDesignMode();
  const kindRef = React.useRef<HTMLSpanElement>(null);
  const rangeRef = React.useRef<HTMLSpanElement>(null);
  const velRef = React.useRef<HTMLSpanElement>(null);
  const peakRef = React.useRef<HTMLSpanElement>(null);
  const framesRef = React.useRef<HTMLSpanElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const g = React.useRef(settings);
  React.useEffect(() => {
    g.current = settings;
  });

  React.useEffect(() => {
    const canvas = canvasRef.current!;
    const dpr = devicePixelRatio || 1;
    canvas.width = SPARK_W * dpr;
    canvas.height = SPARK_H * dpr;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(dpr, dpr);
    const samples: number[] = [];
    let peak = 0;
    let started = 0;
    const accent = () => getComputedStyle(canvas).color;
    const draw = () => {
      ctx.clearRect(0, 0, SPARK_W, SPARK_H);
      if (samples.length < 2) return;
      ctx.beginPath();
      const n = samples.length;
      const top = Math.max(MIN_V, ...samples);
      for (let i = 0; i < n; i++) {
        const x = (i / (n - 1)) * SPARK_W;
        const y = SPARK_H - Math.min(samples[i] / top, 1) * (SPARK_H - 2) - 1;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = accent();
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.lineTo(SPARK_W, SPARK_H);
      ctx.lineTo(0, SPARK_H);
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = accent();
      ctx.fill();
      ctx.globalAlpha = 1;
    };
    const set = (ref: React.RefObject<HTMLElement | null>, v: string) => {
      if (ref.current) ref.current.textContent = v;
    };
    const idle = () => {
      set(kindRef, "idle");
      set(rangeRef, "—");
      set(velRef, "0 px/s");
    };
    idle();
    set(peakRef, "—");
    set(framesRef, "—");
    const unsub = craftBus.subscribe((e: CraftEvent) => {
      if (e.type === "design-mode") return;
      if (e.type === "drag:start") {
        samples.length = 0;
        peak = 0;
        started = performance.now();
      }
      if (e.type === "drag:end") {
        idle();
        set(kindRef, e.cancelled ? "canceled" : "dropped");
        set(framesRef, `${samples.length} · ${Math.round(performance.now() - started)} ms`);
        return;
      }
      const f = e.frame;
      samples.push(f.velocity);
      if (samples.length > 240) samples.shift();
      peak = Math.max(peak, f.velocity);
      set(kindRef, f.kind);
      // a timeline frame counts minutes from its window start, not from midnight
      const axis = timelineAxisOf(scopeRef?.current ?? null);
      const origin = axis
        ? minutesOfDate(displayDate(axis.startMs + f.startMin * 60_000, g.current.displayZone)) -
          f.startMin
        : 0;
      set(
        rangeRef,
        f.endDayIndex != null && !axis
          ? `${formatDaySpan(f.dayIndex, f.endDayIndex)} · all day`
          : formatRange(origin + f.startMin, origin + f.endMin, g.current.timeFormat),
      );
      set(velRef, `${Math.round(f.velocity)} px/s`);
      set(peakRef, `${Math.round(peak)} px/s`);
      draw();
    });
    return unsub;
  }, [scopeRef]);

  return (
    <>
      <Row label="gesture">
        <span ref={kindRef} />
      </Row>
      <Row label="time">
        <span ref={rangeRef} />
      </Row>
      <Row label="velocity">
        <span ref={velRef} />
      </Row>
      <canvas
        ref={canvasRef}
        width={SPARK_W}
        height={SPARK_H}
        className="h-9 w-full rounded-md border bg-muted/40 text-primary"
        role="img"
        aria-label="Drag velocity over the last gesture"
      />
      <Row label="peak">
        <span ref={peakRef} />
      </Row>
      <Row label="frames">
        <span ref={framesRef} />
      </Row>
    </>
  );
}

/* ── springs ─────────────────────────────────────────────────────── */

function SpringCurve({ spec }: { spec: SpringSpec }) {
  const pts = React.useMemo(() => {
    const s = springSamples(spec.stiffness, spec.damping);
    const n = Math.max(s.length, 2);
    const lo = Math.min(0, ...s);
    const hi = Math.max(1, ...s);
    return s
      .map(
        (y, i) =>
          `${((i / (n - 1)) * 240).toFixed(1)},${(34 - ((y - lo) / (hi - lo)) * 32).toFixed(1)}`,
      )
      .join(" ");
  }, [spec.stiffness, spec.damping]);
  return (
    <svg
      viewBox="0 0 240 36"
      preserveAspectRatio="none"
      className="h-9 w-full rounded-md border bg-muted/40"
      aria-hidden
    >
      <line
        x1="0"
        y1="2"
        x2="240"
        y2="2"
        className="stroke-border"
        strokeDasharray="2 2"
        vectorEffect="non-scaling-stroke"
      />
      <polyline
        points={pts}
        fill="none"
        className="stroke-primary"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function SpringRow({
  id,
  label,
  spec,
  onChange,
}: {
  id: keyof MotionState & ("drag" | "resize" | "keyboard");
  label: string;
  spec: SpringSpec;
  onChange: (s: SpringSpec) => void;
}) {
  const changed = JSON.stringify(spec) !== JSON.stringify(MOTION_DEFAULTS[id]);
  const settle = springSamples(spec.stiffness, spec.damping).length;
  return (
    <div className="flex flex-col gap-2 border-t pt-2">
      <div className="flex min-h-6 items-center justify-between gap-2">
        <span className="font-sans text-xs font-medium">{label}</span>
        {changed ? (
          <Button variant="ghost" size="xs" onClick={() => onChange(MOTION_DEFAULTS[id])}>
            Reset
          </Button>
        ) : null}
      </div>
      <SpringCurve spec={spec} />
      <Row label="settles in">{`${settle} f · ${Math.round((settle / 60) * 1000)} ms`}</Row>
      <Range
        label="stiffness"
        value={spec.stiffness}
        min={50}
        max={1500}
        step={10}
        onChange={(v) => onChange({ ...spec, stiffness: v })}
      />
      <Range
        label="damping"
        value={spec.damping}
        min={4}
        max={80}
        onChange={(v) => onChange({ ...spec, damping: v })}
      />
      <Range
        label="duration"
        value={spec.ms}
        min={80}
        max={1200}
        step={10}
        unit="ms"
        onChange={(v) => onChange({ ...spec, ms: v })}
      />
    </div>
  );
}

export function useMotion(): MotionState {
  return React.useSyncExternalStore(subscribeMotion, getMotion, getMotion);
}

const SPEEDS = [
  { value: 1, label: "1×" },
  { value: 2, label: "½" },
  { value: 4, label: "¼" },
  { value: 10, label: "⅒" },
];

export function MotionSection({ settings }: { settings: KloqSettings }) {
  const m = useMotion();
  const tweaked = m !== MOTION_DEFAULTS && JSON.stringify(m) !== JSON.stringify(MOTION_DEFAULTS);
  return (
    <Section
      id="motion"
      title="Motion"
      summary={
        m.scale !== 1
          ? `${SPEEDS.find((s) => s.value === m.scale)?.label ?? m.scale} speed`
          : tweaked
            ? "tuned"
            : "defaults"
      }
    >
      <Telemetry settings={settings} />
      <div className="flex items-center justify-between gap-2 border-t pt-2">
        <span className="font-sans text-xs">Playback</span>
        <Segmented
          label="Animation speed"
          value={m.scale}
          options={SPEEDS}
          onChange={(scale) => setMotion({ scale })}
        />
      </div>
      <Toggle
        id="dm-reduced"
        label="Simulate reduced motion"
        checked={m.reducedMotion}
        onChange={(reducedMotion) => setMotion({ reducedMotion })}
      />
      <Row label="snap">{`${settings.snapMinutes} min · ⌥ ${settings.snapFineMinutes} min`}</Row>
      <Row label="intent">4 px before a drag exists</Row>
      <SpringRow
        id="drag"
        label="Drag settle"
        spec={m.drag}
        onChange={(drag) => setMotion({ drag })}
      />
      <SpringRow
        id="resize"
        label="Resize overshoot"
        spec={m.resize}
        onChange={(resize) => setMotion({ resize })}
      />
      <SpringRow
        id="keyboard"
        label="Keyboard nudge"
        spec={m.keyboard}
        onChange={(keyboard) => setMotion({ keyboard })}
      />
      {tweaked ? (
        <Button variant="outline" size="xs" onClick={resetMotion} className="mt-1 self-start">
          Reset all motion
        </Button>
      ) : null}
    </Section>
  );
}
