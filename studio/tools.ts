import {
  Cards01Icon,
  ChartBarBigIcon,
  CubeIcon,
  HelpSquareIcon,
  HierarchySquare02Icon,
  News01Icon,
  Presentation01Icon,
  Table02Icon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";

/** Every Studio tool, in the order they appear in the Studio sheet (two per row). */
export const studioToolIds = [
  "report",
  "flashcards",
  "quiz",
  "mind-map",
  "data-table",
  "anatomy",
  "slide-deck",
  "infographic",
] as const;

export type StudioToolId = (typeof studioToolIds)[number];

export interface StudioToolMeta {
  id: StudioToolId;
  icon: IconSvgElement;
  /** Text colour for the icon: a theme token from Panel's chart ramp. */
  tint: string;
  /** Usable in this version. Others are shown as coming soon. */
  available: boolean;
  /** Not in NotebookLM: marked "New". */
  isNew?: boolean;
}

export const studioTools: Record<StudioToolId, StudioToolMeta> = {
  report: { id: "report", icon: News01Icon, tint: "text-chart-2", available: true },
  flashcards: { id: "flashcards", icon: Cards01Icon, tint: "text-chart-4", available: true },
  quiz: { id: "quiz", icon: HelpSquareIcon, tint: "text-chart-3", available: true },
  "mind-map": {
    id: "mind-map",
    icon: HierarchySquare02Icon,
    tint: "text-chart-5",
    available: true,
  },
  "data-table": { id: "data-table", icon: Table02Icon, tint: "text-chart-2", available: true },
  anatomy: { id: "anatomy", icon: CubeIcon, tint: "text-chart-3", available: true, isNew: true },
  "slide-deck": {
    id: "slide-deck",
    icon: Presentation01Icon,
    tint: "text-chart-4",
    available: false,
  },
  infographic: { id: "infographic", icon: ChartBarBigIcon, tint: "text-chart-5", available: false },
};

export function isStudioToolId(value: unknown): value is StudioToolId {
  return typeof value === "string" && (studioToolIds as readonly string[]).includes(value);
}
