import { Copy01Icon } from "@hugeicons/core-free-icons";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Segmented } from "@/components/common/segmented";
import { Icon } from "@/components/icon";
import { Button } from "@/components/panelui/button";
import { Menu } from "@/components/panelui/menu";
import type { OutputChrome, ToolViewerProps } from "@/studio/shared/form";
import { OutputInfo } from "@/studio/shared/output-info";
import { OutputMenu } from "@/studio/shared/output-menu";
import type { MindMapData } from "./definition";
import { DiagramView } from "./diagram-view";
import { parseMindmap } from "./tree";
import { MindMapTree } from "./tree-view";

type View = "tree" | "diagram";

const floatingBar =
  "pointer-events-auto rounded-2xl border bg-background/95 p-1 shadow-sm backdrop-blur";

/**
 * A mind map opens as an interactive tree, like NotebookLM's, with Pele's
 * drawing one switch away. Every other kind of diagram is drawn by Pele.
 * It takes the whole Studio tab, like a whiteboard: the back button, title,
 * view switch and actions float over the canvas.
 */
export function MindMapViewer({ data, chrome }: ToolViewerProps<MindMapData>) {
  const { t } = useTranslation("studio");
  const root = useMemo(
    () => (data.diagram === "mindmap" ? parseMindmap(data.mermaid) : null),
    [data],
  );
  const [view, setView] = useState<View>("tree");
  const copy = () => {
    void navigator.clipboard?.writeText(data.mermaid);
    toast.success(t("viewer.copied"));
  };

  return (
    <div className="relative isolate flex min-h-[28rem] flex-1 flex-col">
      {root && view === "tree" ? (
        <MindMapTree root={root} />
      ) : (
        <DiagramView mermaid={data.mermaid} />
      )}

      {chrome ? (
        <div className="pointer-events-none absolute start-3 top-3 z-10">
          <OutputInfo chrome={chrome} />
        </div>
      ) : null}

      {root ? (
        <div className="pointer-events-none absolute inset-x-3 top-3 z-10 flex justify-center">
          <div className={floatingBar}>
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
          </div>
        </div>
      ) : null}

      <div className="pointer-events-none absolute end-3 top-3 z-10">
        {chrome ? (
          <MindMapMenu chrome={chrome} onCopy={copy} />
        ) : (
          <Button
            variant="outline"
            size="sm"
            shape="pill"
            className="pointer-events-auto bg-background/95 shadow-sm backdrop-blur"
            onClick={copy}
          >
            <Icon icon={Copy01Icon} size={16} />
            {t("mind-map.viewer.copyCode")}
          </Button>
        )}
      </div>
    </div>
  );
}

/** The shared actions menu, with copying the Mermaid code. */
function MindMapMenu({ chrome, onCopy }: { chrome: OutputChrome; onCopy: () => void }) {
  const { t } = useTranslation("studio");
  return (
    <OutputMenu chrome={chrome} floating>
      <Menu.Item onClick={onCopy}>
        <Icon icon={Copy01Icon} />
        {t("mind-map.viewer.copyCode")}
      </Menu.Item>
    </OutputMenu>
  );
}
