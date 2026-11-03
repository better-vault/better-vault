import {
  CloudDownloadIcon,
  Delete02Icon,
  Download01Icon,
  Upload01Icon,
} from "@hugeicons/core-free-icons";
import { useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Icon, type IconSvgElement } from "@/components/icon";
import { Sheet } from "@/components/panelui/sheet";
import { exportBackup, importBackup } from "@/lib/db/backup";
import { downloadText } from "@/lib/format";
import { CloudBrowser } from "@/components/storage/cloud-browser";
import { storageIds, storages, type StorageId } from "@/lib/storage/catalog";
import { storageClient } from "@/lib/storage/clients";
import { isStorageReady, useStorageSettings } from "@/lib/storage/settings";
import { cn } from "@/lib/utils";
import { StorageLogo } from "./storage-panel";

/**
 * Export, import and delete the data kept in this browser. "Delete all" is
 * confirmed by the settings sheet, which closes first.
 */
export function DataPanel({ onDeleteAll }: { onDeleteAll: () => void }) {
  const { t } = useTranslation("settings");
  const fileInput = useRef<HTMLInputElement>(null);

  const { t: tCommon } = useTranslation();
  const storage = useStorageSettings();
  const connected = storage ? storageIds.filter((id) => isStorageReady(storage, id)) : [];
  const [backingUp, setBackingUp] = useState<StorageId | null>(null);
  const [restoring, setRestoring] = useState(false);

  /** Saves a backup file to the service's better-vault/backups folder. */
  async function backUpTo(id: StorageId) {
    if (!storage || backingUp) return;
    setBackingUp(id);
    try {
      const backup = await exportBackup();
      const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
      await storageClient(id, storage[id]).upload(
        "backups",
        `better-vault-backup-${stamp}.json`,
        new Blob([JSON.stringify(backup)], { type: "application/json" }),
      );
      toast.success(t("data.backedUp", { name: storages[id].name }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setBackingUp(null);
    }
  }

  async function exportData() {
    const backup = await exportBackup();
    const date = new Date().toISOString().slice(0, 10);
    downloadText(
      JSON.stringify(backup, null, 2),
      `better-vault-backup-${date}.json`,
      "application/json",
    );
  }

  async function importData(file: File) {
    try {
      const count = await importBackup(JSON.parse(await file.text()));
      toast.success(t("data.imported", { count }));
    } catch {
      toast.error(t("data.importFailed"));
    }
  }

  return (
    <>
      <Sheet.Header title={t("data.title")} description={t("data.description")} />
      <Sheet.Body>
        <div className="-mx-2 flex flex-col gap-0.5 pb-4">
          <ActionRow
            icon={Download01Icon}
            label={t("data.export")}
            hint={t("data.exportHint")}
            onClick={exportData}
          />
          <ActionRow
            icon={Upload01Icon}
            label={t("data.import")}
            hint={t("data.importHint")}
            onClick={() => fileInput.current?.click()}
          />
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void importData(file);
            }}
          />
          {connected.map((id) => (
            <ActionRow
              key={id}
              icon={<StorageLogo id={id} />}
              label={t("data.backupTo", { name: storages[id].name })}
              hint={backingUp === id ? t("data.backingUp") : t("data.backupToHint")}
              onClick={() => void backUpTo(id)}
            />
          ))}
          {connected.length > 0 ? (
            <Sheet.Trigger
              to="restore-cloud"
              render={
                <button
                  type="button"
                  className="flex w-full cursor-pointer items-start gap-3 rounded-2xl px-2.5 py-2.5 text-start transition-colors outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
                />
              }
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted">
                <Icon icon={CloudDownloadIcon} />
              </span>
              <span className="min-w-0 flex-1 pt-0.5">
                <span className="block text-sm font-medium">{t("data.restoreFrom")}</span>
                <span className="block text-xs leading-5 text-muted-foreground">
                  {t("data.restoreFromHint")}
                </span>
              </span>
            </Sheet.Trigger>
          ) : null}
          <ActionRow
            icon={Delete02Icon}
            label={t("data.deleteAll")}
            hint={t("data.deleteAllHint")}
            destructive
            onClick={onDeleteAll}
          />
        </div>
      </Sheet.Body>
      <Sheet.Next name="restore-cloud" closeLabel={tCommon("actions.close")}>
        <Sheet.Header title={t("data.restoreFrom")} description={t("data.restoreFromHint")} />
        <Sheet.Body>
          <div className="pb-4">
            <CloudBrowser
              mode="backups"
              busy={restoring}
              onChoose={async (service, files) => {
                if (!storage || !files[0]) return;
                setRestoring(true);
                try {
                  await importData(
                    await storageClient(service, storage[service]).download(files[0]),
                  );
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : String(error));
                } finally {
                  setRestoring(false);
                }
              }}
            />
          </div>
        </Sheet.Body>
      </Sheet.Next>
    </>
  );
}

function ActionRow({
  icon,
  label,
  hint,
  destructive,
  onClick,
}: {
  icon: IconSvgElement | ReactNode;
  label: ReactNode;
  hint: ReactNode;
  destructive?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full cursor-pointer items-start gap-3 rounded-2xl px-2.5 py-2.5 text-start transition-colors outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted",
          destructive && "bg-destructive/10 text-destructive",
        )}
      >
        {Array.isArray(icon) ? <Icon icon={icon as IconSvgElement} /> : (icon as ReactNode)}
      </span>
      <span className="min-w-0 flex-1 pt-0.5">
        <span className={cn("block text-sm font-medium", destructive && "text-destructive")}>
          {label}
        </span>
        <span className="block text-xs leading-5 text-muted-foreground">{hint}</span>
      </span>
    </button>
  );
}
