import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { Sheet } from "@/components/panelui/sheet";
import { useWorkspace } from "@/components/workspace/workspace-context";
import { availableImageModels, useSettings } from "@/lib/db/settings";
import { useStudioSettings } from "@/lib/studio/settings";
import { toolDefinitions } from "@/studio/definitions";
import { studioToolIds, studioTools, type StudioToolId } from "@/studio/tools";
import { OutputList } from "./output-list";
import { useStudioRunner } from "./studio-runner";
import { ToolTile } from "./tool-tile";

interface StudioSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: ReactElement;
}

/**
 * The Studio sheet, opened by "Add": the Studio's tools, and under them what has been created.
 * Choosing a tool closes the sheet and opens the tool's dialog; choosing an
 * output closes it and opens the output in the Studio tab.
 */
export function StudioSheet({ open, onOpenChange, trigger }: StudioSheetProps) {
  const { t } = useTranslation("studio");
  const { t: tCommon } = useTranslation();
  const { notebook, openOutput, openTool } = useWorkspace();
  const runner = useStudioRunner();
  const navigate = useNavigate();
  const settings = useSettings();
  const noImageModel = settings ? availableImageModels(settings).length === 0 : false;
  const studioSettings = useStudioSettings();
  // Tools turned off in Settings → Studio leave the sheet; their outputs stay listed below.
  const shownTools = studioToolIds.filter((id) => !studioSettings?.hidden.includes(id));

  // Notes live in the vault, not in the notebook: the tile opens the notes
  // page showing this notebook's notes. A local tool (the whiteboard, the
  // canvas) has no dialog: it is made at once and opened.
  async function choose(id: StudioToolId) {
    if (id === "notes") {
      onOpenChange(false);
      navigate(`/?view=notes&notebook=${encodeURIComponent(notebook.id)}`);
      return;
    }
    const local = toolDefinitions[id]?.local;
    if (!local) {
      openTool(id);
      return;
    }
    try {
      const outputId = await runner.createLocal(id, {
        title: t(`tools.${id}.name`),
        data: local.blank(),
      });
      openOutput(outputId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <Sheet side="left" open={open} onOpenChange={onOpenChange}>
      <Sheet.Trigger render={trigger} />
      <Sheet.Content
        closeLabel={tCommon("actions.close")}
        className="w-[min(26rem,calc(100vw-2*var(--sheet-gap)))]"
      >
        <Sheet.Header title={t("title")} description={t("description")} />
        <Sheet.Body>
          {shownTools.length === 0 ? (
            <p className="rounded-2xl bg-muted px-4 py-3 text-sm text-muted-foreground">
              {t("allHidden")}
            </p>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            {shownTools.map((id) => (
              <ToolTile
                key={id}
                tool={studioTools[id]}
                onSelect={() => void choose(id)}
                badge={toolDefinitions[id]?.imageModel && noImageModel ? t("needsKey") : undefined}
                // An odd one out spans the whole row.
                className={
                  shownTools.length % 2 === 1 && id === shownTools.at(-1) ? "col-span-2" : undefined
                }
              />
            ))}
          </div>
          <section className="mt-6 pb-4">
            <h3 className="mb-1 px-1 text-xs font-medium text-muted-foreground">{t("created")}</h3>
            <OutputList notebookId={notebook.id} onOpen={(output) => openOutput(output.id)} />
          </section>
        </Sheet.Body>
      </Sheet.Content>
    </Sheet>
  );
}
