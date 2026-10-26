"use client";

import { Copy01Icon } from "@hugeicons/core-free-icons";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Segmented } from "@/components/common/segmented";
import { Icon } from "@/components/icon";
import { Button } from "@/components/panelui/button";
import type { ToolViewerProps } from "@/studio/shared/form";
import type { MindMapData } from "./definition";
import { DiagramView } from "./diagram-view";
import { parseMindmap } from "./tree";
import { MindMapTree } from "./tree-view";

type View = "tree" | "diagram";

/**
 * A mind map opens as an interactive tree, like NotebookLM's, with Pele's
 * drawing one switch away. Every other kind of diagram is drawn by Pele.
 */
export function MindMapViewer({ data }: ToolViewerProps<MindMapData>) {
  const { t } = useTranslation("studio");
  const root = useMemo(
    () => (data.diagram === "mindmap" ? parseMindmap(data.mermaid) : null),
    [data],
  );
  const [view, setView] = useState<View>("tree");

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {root ? (
          <Segmented<View>
            size="sm"
            aria-label={t("mind-map.diagram")}
            value={view}
            onValueChange={setView}
            options={[
              { value: "tree", label: t("mind-map.viewer.views.tree") },
              { value: "diagram", label: t("mind-map.viewer.views.diagram") },
            ]}
          />
        ) : (
          <span />
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            void navigator.clipboard?.writeText(data.mermaid);
            toast.success(t("viewer.copied"));
          }}
        >
          <Icon icon={Copy01Icon} size={16} />
          {t("mind-map.viewer.copyCode")}
        </Button>
      </div>
      {root && view === "tree" ? (
        <MindMapTree root={root} />
      ) : (
        <DiagramView mermaid={data.mermaid} />
      )}
    </div>
  );
}
