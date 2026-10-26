"use client";

import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Sheet } from "@/components/panelui/sheet";
import { useWorkspace } from "@/components/workspace/workspace-context";
import { availableImageModels, useSettings } from "@/lib/db/settings";
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
  const settings = useSettings();
  const noImageModel = settings ? availableImageModels(settings).length === 0 : false;

  // A local tool (the whiteboard) has no dialog: it is made at once and opened.
  async function choose(id: StudioToolId) {
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
          <div className="grid grid-cols-2 gap-2">
            {studioToolIds.map((id) => (
              <ToolTile
                key={id}
                tool={studioTools[id]}
                onSelect={() => void choose(id)}
                badge={toolDefinitions[id]?.imageModel && noImageModel ? t("needsKey") : undefined}
                // An odd one out spans the whole row.
                className={
                  studioToolIds.length % 2 === 1 && id === studioToolIds.at(-1)
                    ? "col-span-2"
                    : undefined
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
