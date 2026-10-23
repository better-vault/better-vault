"use client";

import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { Sheet } from "@/components/panelui/sheet";
import { useWorkspace } from "@/components/workspace/workspace-context";
import { studioToolIds, studioTools } from "@/studio/tools";
import { OutputList } from "./output-list";
import { ToolTile } from "./tool-tile";

interface StudioSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: ReactElement;
}

/**
 * The `+` sheet: the Studio's tools, and under them what has been created.
 * Choosing a tool closes the sheet and opens the tool's dialog; choosing an
 * output closes it and opens the output in the Studio tab.
 */
export function StudioSheet({ open, onOpenChange, trigger }: StudioSheetProps) {
  const { t } = useTranslation("studio");
  const { t: tCommon } = useTranslation();
  const { notebook, openOutput, openTool } = useWorkspace();

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
              <ToolTile key={id} tool={studioTools[id]} onSelect={() => openTool(id)} />
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
