import type { KloqViewKind } from "../lib/view";

export interface ViewCapabilities {
  /** does this view own a scrollable time canvas the drag engine drives? */
  timeGrid: boolean;
  /** can it render meaningfully on the server, before the client zone is known? */
  ssr: boolean;
  /** which projection feeds it */
  projects: "day-columns" | "range" | "lanes";
}

const GRID: ViewCapabilities = { timeGrid: true, ssr: true, projects: "day-columns" };
const LIST: ViewCapabilities = { timeGrid: false, ssr: true, projects: "day-columns" };

export const VIEW_CAPABILITIES: Record<KloqViewKind, ViewCapabilities> = {
  day: GRID,
  days: GRID,
  week: GRID,
  month: LIST,
  agenda: LIST,
  year: { timeGrid: false, ssr: true, projects: "range" },
  timeline: { timeGrid: true, ssr: false, projects: "lanes" },
};

/** Capabilities for a kind, with a safe non-grid fallback for anything unknown. */
export function capabilitiesOf(kind: KloqViewKind): ViewCapabilities {
  return VIEW_CAPABILITIES[kind] ?? LIST;
}
