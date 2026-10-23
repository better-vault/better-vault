"use client";

import {
  ArrowDataTransferHorizontalIcon,
  Calendar03Icon,
  ChartScatterIcon,
  CodeSquareIcon,
  Database02Icon,
  FishFoodIcon,
  FlowchartIcon,
  HierarchySquare02Icon,
  KanbanIcon,
  Route01Icon,
  TimelineIcon,
  WorkflowCircle01Icon,
} from "@hugeicons/core-free-icons";
import { useTranslation } from "react-i18next";
import { ChoiceField, FocusField, OptionCards } from "@/studio/shared/fields";
import type { ToolFormProps } from "@/studio/shared/form";
import { details, diagramKinds, type DiagramKind, type MindMapOptions } from "./definition";

export const diagramIcons: Record<DiagramKind, typeof HierarchySquare02Icon> = {
  mindmap: HierarchySquare02Icon,
  flowchart: FlowchartIcon,
  timeline: TimelineIcon,
  sequence: ArrowDataTransferHorizontalIcon,
  state: WorkflowCircle01Icon,
  class: CodeSquareIcon,
  er: Database02Icon,
  quadrant: ChartScatterIcon,
  journey: Route01Icon,
  ishikawa: FishFoodIcon,
  kanban: KanbanIcon,
  gantt: Calendar03Icon,
};

export function MindMapForm({ value, onChange, focus, onFocusChange }: ToolFormProps<MindMapOptions>) {
  const { t } = useTranslation("studio");
  return (
    <>
      <OptionCards
        label={t("mind-map.diagram")}
        value={value.diagram}
        onChange={(diagram) => onChange({ ...value, diagram })}
        columns={3}
        options={diagramKinds.map((kind) => ({
          value: kind,
          title: t(`mind-map.diagrams.${kind}.name`),
          description: t(`mind-map.diagrams.${kind}.description`),
          icon: diagramIcons[kind],
        }))}
      />
      <ChoiceField
        label={t("mind-map.detail")}
        value={value.detail}
        onChange={(detail) => onChange({ ...value, detail })}
        options={details.map((detail) => ({ value: detail, label: t(`mind-map.details.${detail}`) }))}
      />
      <FocusField
        label={t("mind-map.focusLabel")}
        placeholder={t("mind-map.focusPlaceholder")}
        value={focus}
        onChange={onFocusChange}
        rows={2}
      />
    </>
  );
}
