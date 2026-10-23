"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Icon } from "@/components/icon";
import { Button } from "@/components/panelui/button";
import { Dialog } from "@/components/panelui/dialog";
import { useSources } from "@/lib/db/sources";
import { cn } from "@/lib/utils";
import { toolClients } from "@/studio/client";
import { toolDefinitions } from "@/studio/definitions";
import { LanguageField, SourcesField } from "@/studio/shared/fields";
import { studioTools, type StudioToolId } from "@/studio/tools";
import { useStudioRunner } from "./studio-runner";

interface ToolDialogProps {
  notebookId: string;
  toolId: StudioToolId | null;
  onClose: () => void;
}

/** A Studio tool's options, opened from its tile: its own fields, then language and sources. */
export function ToolDialog({ notebookId, toolId, onClose }: ToolDialogProps) {
  const { t: tCommon } = useTranslation();
  const client = toolId ? toolClients[toolId] : undefined;
  return (
    <Dialog open={toolId !== null} onOpenChange={(open) => (open ? null : onClose())}>
      <Dialog.Content
        size="lg"
        closeLabel={tCommon("actions.close")}
        className={cn(client?.wide && "max-w-2xl")}
      >
        {toolId ? <ToolForm key={toolId} notebookId={notebookId} toolId={toolId} onDone={onClose} /> : null}
      </Dialog.Content>
    </Dialog>
  );
}

function ToolForm({ notebookId, toolId, onDone }: { notebookId: string; toolId: StudioToolId; onDone: () => void }) {
  const { t } = useTranslation("studio");
  const { t: tCommon } = useTranslation();
  const runner = useStudioRunner();
  const sources = useSources(notebookId);
  const definition = toolDefinitions[toolId];
  const client = toolClients[toolId];
  const tool = studioTools[toolId];

  const [options, setOptions] = useState<unknown>(definition?.defaults);
  const [focus, setFocus] = useState("");
  const [language, setLanguage] = useState("auto");
  // Starts with the sources selected in the notebook.
  const [sourceIds, setSourceIds] = useState<string[] | null>(null);
  const chosen = sourceIds ?? sources?.filter((source) => source.selected).map((source) => source.id) ?? [];
  const [busy, setBusy] = useState(false);

  if (!definition || !client) return null;
  const { Form } = client;
  const customReport = toolId === "report" && (options as { template?: string }).template === "custom";
  const missingInstructions = customReport && !(options as { instructions: string }).instructions.trim();

  async function create() {
    setBusy(true);
    try {
      await runner.create(toolId, {
        common: { language, focus: customReport ? "" : focus, sourceIds: chosen },
        tool: options,
      });
      onDone();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Dialog.Header
        title={
          <span className="flex items-center gap-2.5">
            <Icon icon={tool.icon} size={22} className={tool.tint} />
            {t(`tools.${toolId}.name`)}
          </span>
        }
        description={t(`tools.${toolId}.description`)}
      />
      <Dialog.Body>
        <Form value={options} onChange={setOptions} focus={focus} onFocusChange={setFocus} />
        <div className="grid gap-4 sm:grid-cols-2">
          <LanguageField value={language} onChange={setLanguage} />
          <SourcesField sources={sources ?? []} value={chosen} onChange={setSourceIds} />
        </div>
        {chosen.length === 0 && sources ? <p className="text-sm text-destructive">{t("errors.noSources")}</p> : null}
      </Dialog.Body>
      <Dialog.Footer>
        <Dialog.Close render={<Button variant="secondary" />}>{tCommon("actions.cancel")}</Dialog.Close>
        <Button onClick={create} loading={busy} disabled={chosen.length === 0 || missingInstructions}>
          {t("dialog.create")}
        </Button>
      </Dialog.Footer>
    </>
  );
}
