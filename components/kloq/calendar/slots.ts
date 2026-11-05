"use client";

/**
 * Component slots — every visual piece of the calendar can be swapped via
 * <Kloq components={{ ... }}>. The engine, grid math, and craft-bus stay
 * fixed; overrides plug into them through these contracts.
 *
 * Every contract documents the data-attributes and imperative hooks the
 * drag engine requires. Skip them and the physics break — honor them and a
 * custom component inherits the full interaction model for free.
 *
 * Engine contract summary:
 *  - EventBlock root:  data-cal-event={id}, registerNode(id, node),
 *    onPointerDown forwarding, a [data-slot="event-time"] text node for live
 *    label updates, [data-resize-edge="start" | "end"] resize zones.
 *  - AllDayChip root:  data-cal-event={id}, registerNode + pointerdown
 *    forwarding, [data-lane-edge="left" | "right"] resize zones.
 *  - TimeGutter: position labels with the provided minutesToPx — never a
 *    re-derived scale.
 *  - TimelineBlock root: data-cal-event={id}, registerNode(id, node),
 *    onPointerDown forwarding, a [data-slot="event-time"] text node, and
 *    [data-resize-edge="start" | "end"] resize zones — the timeline's own
 *    bar, mirroring EventBlock's contract exactly (see `../timeline/timeline-block.tsx`).
 *  - ResourceGutter: the sticky row label beside `TimelineRow`; no engine hooks.
 *  - TimelineHeader: the tick strip above the rows; no engine hooks.
 *  - TimelineRow: one lane's strip of canvas — the drag engine's horizontal
 *    origin is read off its own root (`use-timeline-drag.ts`'s `trackRef`),
 *    so an override must keep that root as the outermost positioned element.
 */

import type { ComponentType } from "react";
import { createContext, useContext } from "react";
import { ResourceGutter, type ResourceGutterProps } from "../timeline/resource-gutter";
import { TimelineBlock, type TimelineBlockProps } from "../timeline/timeline-block";
import { TimelineHeader, type TimelineHeaderProps } from "../timeline/timeline-header";
import { TimelineRow, type TimelineRowProps } from "../timeline/timeline-row";
import { AllDayChip, type AllDayChipProps } from "./all-day-chip";
import { DayHeader, type DayHeaderProps } from "./day-header";
import { EventBlock, type EventBlockProps } from "./event-block";
import { EventPanel, type EventPanelProps } from "./event-panel";
import { NowIndicator, type NowIndicatorProps } from "./now-indicator";
import { TimeGutter, type TimeGutterProps } from "./time-gutter";

export type {
  AllDayChipProps,
  DayHeaderProps,
  EventBlockProps,
  EventPanelProps,
  NowIndicatorProps,
  ResourceGutterProps,
  TimeGutterProps,
  TimelineBlockProps,
  TimelineHeaderProps,
  TimelineRowProps,
};

export interface KloqComponents {
  EventBlock: ComponentType<EventBlockProps>;
  AllDayChip: ComponentType<AllDayChipProps>;
  EventPanel: ComponentType<EventPanelProps>;
  TimeGutter: ComponentType<TimeGutterProps>;
  DayHeader: ComponentType<DayHeaderProps>;
  NowIndicator: ComponentType<NowIndicatorProps>;
  ResourceGutter: ComponentType<ResourceGutterProps>;
  TimelineHeader: ComponentType<TimelineHeaderProps>;
  TimelineRow: ComponentType<TimelineRowProps>;
  TimelineBlock: ComponentType<TimelineBlockProps>;
}

export const DEFAULT_COMPONENTS: KloqComponents = {
  EventBlock,
  AllDayChip,
  EventPanel,
  TimeGutter,
  DayHeader,
  NowIndicator,
  ResourceGutter,
  TimelineHeader,
  TimelineRow,
  TimelineBlock,
};

const SlotsContext = createContext<KloqComponents>(DEFAULT_COMPONENTS);

export const SlotsProvider = SlotsContext.Provider;

/** Resolved slot map — defaults merged with any overrides. */
export function useSlots(): KloqComponents {
  return useContext(SlotsContext);
}
