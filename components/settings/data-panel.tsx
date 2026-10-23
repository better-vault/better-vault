"use client";

import { Delete02Icon, Download01Icon, Upload01Icon } from "@hugeicons/core-free-icons";
import { useRouter } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Icon, type IconSvgElement } from "@/components/icon";
import { Sheet } from "@/components/panelui/sheet";
import { deleteAllData, exportBackup, importBackup } from "@/lib/db/backup";
import { downloadText } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Export, import and delete the data kept in this browser. */
export function DataPanel({ onDone }: { onDone?: () => void }) {
  const { t } = useTranslation("settings");
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [confirming, setConfirming] = useState(false);

  async function exportData() {
    const backup = await exportBackup();
    const date = new Date().toISOString().slice(0, 10);
    downloadText(JSON.stringify(backup, null, 2), `better-vault-backup-${date}.json`, "application/json");
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
          <ActionRow icon={Download01Icon} label={t("data.export")} hint={t("data.exportHint")} onClick={exportData} />
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
          <ActionRow
            icon={Delete02Icon}
            label={t("data.deleteAll")}
            hint={t("data.deleteAllHint")}
            destructive
            onClick={() => setConfirming(true)}
          />
        </div>
      </Sheet.Body>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t("data.deleteAllConfirm.title")}
        body={t("data.deleteAllConfirm.body")}
        confirmLabel={t("data.deleteAllConfirm.confirm")}
        onConfirm={async () => {
          await deleteAllData();
          toast.success(t("data.deleted"));
          onDone?.();
          router.push("/");
        }}
      />
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
  icon: IconSvgElement;
  label: ReactNode;
  hint: ReactNode;
  destructive?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full cursor-pointer items-start gap-3 rounded-2xl px-2.5 py-2.5 text-start outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted",
          destructive && "bg-destructive/10 text-destructive",
        )}
      >
        <Icon icon={icon} />
      </span>
      <span className="min-w-0 flex-1 pt-0.5">
        <span className={cn("block text-sm font-medium", destructive && "text-destructive")}>{label}</span>
        <span className="block text-xs leading-5 text-muted-foreground">{hint}</span>
      </span>
    </button>
  );
}
