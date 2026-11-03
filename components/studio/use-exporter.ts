import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { downloadBlob } from "@/lib/download";
import { fileNameFor } from "@/lib/format";
import { storages, type StorageId } from "@/lib/storage/catalog";
import { storageClient } from "@/lib/storage/clients";
import { getStorageSettings } from "@/lib/storage/settings";
import { isFileExport, type ExportOption } from "@/studio/types";

/**
 * Saves an output in one of its formats: builds the file and downloads it,
 * or prints; or saves the file to a connected storage service.
 */
export function useExporter() {
  const { t } = useTranslation("studio");
  const [busy, setBusy] = useState(false);

  const save = useCallback(
    async <Data>(title: string, data: Data, option: ExportOption<Data>) => {
      if (!isFileExport(option)) {
        option.print(title);
        return;
      }
      setBusy(true);
      try {
        const blob = await option.build(title, data, {
          question: t("export.question"),
          answer: t("export.answer"),
          answerKey: t("export.answerKey"),
          sources: t("export.sources"),
        });
        downloadBlob(blob, fileNameFor(title, option.extension?.(data) ?? option.format));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : String(error));
      } finally {
        setBusy(false);
      }
    },
    [t],
  );

  /** Builds the file and saves it to the service's better-vault/exports folder. */
  const saveTo = useCallback(
    async <Data>(service: StorageId, title: string, data: Data, option: ExportOption<Data>) => {
      if (!isFileExport(option)) return;
      setBusy(true);
      try {
        const blob = await option.build(title, data, {
          question: t("export.question"),
          answer: t("export.answer"),
          answerKey: t("export.answerKey"),
          sources: t("export.sources"),
        });
        const settings = await getStorageSettings();
        await storageClient(service, settings[service]).upload(
          "exports",
          fileNameFor(title, option.extension?.(data) ?? option.format),
          blob,
        );
        toast.success(t("viewer.savedTo", { name: storages[service].name }));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : String(error));
      } finally {
        setBusy(false);
      }
    },
    [t],
  );

  return { busy, save, saveTo };
}
