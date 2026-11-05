"use client";

import * as React from "react";
import { storageEnabled, storageKey } from "../lib/storage";

export type Corner = "tl" | "tr" | "bl" | "br";

export interface Overlays {
  grid: boolean;
  dim: boolean;
  hitAreas: boolean;
  snapLines: boolean;
}

export interface PanelState {
  corner: Corner;
  collapsed: boolean;
  open: Record<string, boolean>;
  overlays: Overlays;
  /** simulated host width in px; null = fill */
  width: number | null;
}

const key = () => storageKey("design-panel");

const DEFAULT_PANEL: PanelState = {
  corner: "br",
  collapsed: false,
  open: { inspect: true, motion: false, overlays: false, theme: false, network: false },
  overlays: { grid: false, dim: false, hitAreas: false, snapLines: false },
  width: null,
};

function load(): PanelState {
  const fresh = innerWidth < 640 ? { ...DEFAULT_PANEL, collapsed: true } : DEFAULT_PANEL;
  if (!storageEnabled()) return fresh;
  try {
    const raw = localStorage.getItem(key());
    if (!raw) return fresh;
    const saved = JSON.parse(raw) as Partial<PanelState>;
    return {
      ...DEFAULT_PANEL,
      ...saved,
      open: { ...DEFAULT_PANEL.open, ...saved.open },
      overlays: { ...DEFAULT_PANEL.overlays, ...saved.overlays },
    };
  } catch {
    return DEFAULT_PANEL;
  }
}

export function usePanelState(): [PanelState, (patch: Partial<PanelState>) => void] {
  // client-only: the overlay never renders on the server
  const [state, setState] = React.useState<PanelState>(() =>
    typeof window === "undefined" ? DEFAULT_PANEL : load(),
  );
  const patch = React.useCallback((p: Partial<PanelState>) => {
    setState((prev) => {
      const next = { ...prev, ...p };
      if (storageEnabled()) {
        try {
          localStorage.setItem(key(), JSON.stringify(next));
        } catch {
          /* quota or privacy mode */
        }
      }
      return next;
    });
  }, []);
  return [state, patch];
}
