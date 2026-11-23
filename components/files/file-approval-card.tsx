import { CheckmarkCircle02Icon, Download01Icon, FolderOpenIcon } from "@hugeicons/core-free-icons";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { KindBadge } from "@/components/home/vault-tiles";
import { Icon } from "@/components/icon";
import { Button } from "@/components/panelui/button";
import type { ChatMessage } from "@/lib/chat/types";
import { downloadVaultFile } from "@/lib/db/files";
import { store } from "@/lib/db/store";
import { fileNameFor } from "@/lib/files/build";
import { fileKindOf } from "@/lib/files/kinds";
import type { CreateFileInput, CreateFileOutput } from "@/lib/files/tools";
import { cn } from "@/lib/utils";

type ToolPart = Extract<ChatMessage["parts"][number], { toolCallId: string }>;

/**
 * A file the AI wants to make, in the chat and in bot threads: its name and
 * kind, then Make it / Not now. Once made, it can be downloaded or found in
 * the Vault.
 */
export function FileApprovalCard({
  part,
  onAnswer,
}: {
  part: ToolPart;
  onAnswer: (approved: boolean) => Promise<void>;
}) {
  const { t } = useTranslation("chat");
  const navigate = useNavigate();
  const [busy, setBusy] = useState<boolean | null>(null);
  const input = (part.input ?? {}) as Partial<CreateFileInput>;
  const streaming = part.state === "input-streaming";
  const pending = part.state === "input-available";
  const output =
    part.state === "output-available"
      ? (part.output as CreateFileOutput)
      : part.state === "output-error"
        ? ({ ok: false, error: part.errorText } as CreateFileOutput)
        : null;
  const format = input.format ?? "pdf";
  const name = input.name ? fileNameFor({ name: input.name, format }) : "";
  const kind = fileKindOf(name || `file.${format}`);
  const detail = [
    t(`files.formats.${format}`),
    input.slides?.length ? t("files.slides", { count: input.slides.length }) : "",
    input.sheets?.length ? t("files.sheets", { count: input.sheets.length }) : "",
    input.folder ? t("files.inFolder", { folder: input.folder }) : "",
  ]
    .filter(Boolean)
    .join(" · ");

  const answer = async (approved: boolean) => {
    setBusy(approved);
    try {
      await onAnswer(approved);
    } finally {
      setBusy(null);
    }
  };

  const download = async () => {
    if (!output?.ok) return;
    const file = await store().getFile(output.fileId);
    if (file) await downloadVaultFile(file);
  };

  return (
    <div className="flex w-full max-w-md flex-col gap-3 rounded-2xl border bg-card p-3.5">
      <span className="text-xs text-muted-foreground">
        {pending || streaming ? t("files.needsOk") : t("files.title")}
      </span>
      <div className="flex items-center gap-3">
        <span className="relative flex h-14 w-11 shrink-0 items-end justify-start rounded-md bg-(--vault-sheet) p-1 shadow-sm ring-1 ring-border">
          <KindBadge kind={kind} className="size-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className={cn("truncate text-[0.9375rem] font-medium", streaming && "animate-pulse")}>
            {name || t("files.writing")}
          </p>
          <p className="truncate text-sm text-muted-foreground">{detail}</p>
        </div>
      </div>
      {pending ? (
        <div className="flex gap-2">
          <Button
            size="sm"
            shape="pill"
            disabled={busy !== null}
            aria-busy={busy === true}
            onClick={() => void answer(true)}
          >
            {t("files.make")}
          </Button>
          <Button
            size="sm"
            shape="pill"
            variant="outline"
            disabled={busy !== null}
            onClick={() => void answer(false)}
          >
            {t("files.notNow")}
          </Button>
        </div>
      ) : output ? (
        output.ok ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="me-auto flex items-center gap-1.5 text-sm">
              <Icon icon={CheckmarkCircle02Icon} size={15} />
              {t("files.saved")}
            </span>
            <Button size="sm" shape="pill" variant="outline" onClick={() => void download()}>
              <Icon icon={Download01Icon} size={15} />
              {t("files.download")}
            </Button>
            <Button
              size="sm"
              shape="pill"
              variant="outline"
              onClick={() => navigate("/?view=vault")}
            >
              <Icon icon={FolderOpenIcon} size={15} />
              {t("files.showInVault")}
            </Button>
          </div>
        ) : (
          <p className={cn("text-sm", output.error ? "text-destructive" : "text-muted-foreground")}>
            {output.error ? t("files.failed", { error: output.error }) : t("files.declined")}
          </p>
        )
      ) : null}
    </div>
  );
}
