"use client";

import * as React from "react";
import { getNetworkSim, subscribeNetworkSim } from "./network-sim";
import { Range, Row, Section, Segmented, Toggle } from "./panel";

const FAILURE_STEPS = [
  { value: 0, label: "0%" },
  { value: 0.25, label: "25%" },
  { value: 0.5, label: "50%" },
];

/** Shown only when the host registered a network sim (see network-sim.ts). */
export function NetworkSection(): React.ReactElement | null {
  const [, force] = React.useReducer((n: number) => n + 1, 0);
  const sim = getNetworkSim();
  const inFlightRef = React.useRef<HTMLSpanElement>(null);
  const lastRef = React.useRef<HTMLSpanElement>(null);

  React.useEffect(() => {
    const wire = () => {
      const s = getNetworkSim();
      if (!s) return undefined;
      let latency = s.getLatency();
      let failureRate = s.getFailureRate();
      let enabled = s.getEnabled?.() ?? true;
      return s.subscribe(() => {
        if (inFlightRef.current) inFlightRef.current.textContent = String(s.getInFlight());
        if (lastRef.current) {
          const last = s.getLastResult();
          lastRef.current.textContent = last ?? "—";
          lastRef.current.style.color = last === "fail" ? "var(--destructive-foreground)" : "";
        }
        const nextLatency = s.getLatency();
        const nextFailureRate = s.getFailureRate();
        const nextEnabled = s.getEnabled?.() ?? true;
        if (nextLatency !== latency || nextFailureRate !== failureRate || nextEnabled !== enabled) {
          latency = nextLatency;
          failureRate = nextFailureRate;
          enabled = nextEnabled;
          force();
        }
      });
    };
    let unsubStats = wire();
    const unsubReg = subscribeNetworkSim(() => {
      unsubStats?.();
      unsubStats = wire();
      force();
    });
    return () => {
      unsubReg();
      unsubStats?.();
    };
  }, []);

  if (!sim) return null;
  const enabled = sim.getEnabled?.() ?? true;

  return (
    <Section
      id="network"
      title="Network"
      summary={
        enabled ? `${sim.getLatency()}ms · ${Math.round(sim.getFailureRate() * 100)}% fail` : "off"
      }
    >
      {sim.setEnabled ? (
        <Toggle
          id="dm-async"
          label="Async server"
          checked={enabled}
          onChange={(on) => sim.setEnabled?.(on)}
        />
      ) : null}
      <Row label="in flight">
        <span ref={inFlightRef}>{sim.getInFlight()}</span>
      </Row>
      <Row label="last">
        <span ref={lastRef}>{sim.getLastResult() ?? "—"}</span>
      </Row>
      <Range
        label="latency"
        value={sim.getLatency()}
        min={0}
        max={2000}
        step={50}
        unit="ms"
        onChange={(v) => sim.setLatency(v)}
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground">failure</span>
        <Segmented
          label="Failure rate"
          value={sim.getFailureRate()}
          options={FAILURE_STEPS}
          onChange={(rate) => sim.setFailureRate(rate)}
        />
      </div>
    </Section>
  );
}
