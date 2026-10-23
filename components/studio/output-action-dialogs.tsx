"use client";

import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { RenameDialog } from "@/components/common/rename-dialog";
import { useWorkspace } from "@/components/workspace/workspace-context";
import { deleteOutput, renameOutput } from "@/lib/db/outputs";

/** The rename and delete dialogs for Studio outputs, shown over the workspace. */
export function OutputActionDialogs() {
  const { t } = useTranslation("studio");
  const { outputAction, clearOutputAction, openOutputId, closeOutput } = useWorkspace();
  const output = outputAction?.output;

  return (
    <>
      <RenameDialog
        open={outputAction?.kind === "rename"}
        onOpenChange={(open) => (open ? null : clearOutputAction())}
        title={t("rename.title")}
        label={t("rename.label")}
        value={output?.title ?? ""}
        onSave={(title) => (output ? renameOutput(output.id, title) : undefined)}
      />
      <ConfirmDialog
        open={outputAction?.kind === "delete"}
        onOpenChange={(open) => (open ? null : clearOutputAction())}
        title={t("delete.title", { title: output?.title ?? "" })}
        body={t("delete.body")}
        confirmLabel={t("delete.confirm")}
        onConfirm={async () => {
          if (!output) return;
          if (openOutputId === output.id) closeOutput();
          await deleteOutput(output.id);
        }}
      />
    </>
  );
}
