"use client";

import { ArrowDown01Icon, Download04Icon, Loading03Icon } from "@hugeicons/core-free-icons";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Icon } from "@/components/icon";
import { buttonVariants } from "@/components/panelui/button";
import { Menu } from "@/components/panelui/menu";
import { downloadBlob } from "@/lib/download";
import { fileNameFor } from "@/lib/format";
import type { ExportOption } from "@/studio/types";

/** "Download" with the formats an output can be saved as. */
export function DownloadMenu<Data>({
  title,
  data,
  options,
}: {
  title: string;
  data: Data;
  options: readonly ExportOption<Data>[];
}) {
  const { t } = useTranslation("studio");
  const [busy, setBusy] = useState(false);

  async function save(option: ExportOption<Data>) {
    setBusy(true);
    try {
      const blob = await option.build(title, data, {
        question: t("export.question"),
        answer: t("export.answer"),
        answerKey: t("export.answerKey"),
      });
      downloadBlob(blob, fileNameFor(title, option.format));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Menu>
      <Menu.Trigger
        disabled={busy}
        className={buttonVariants({ variant: "outline", shape: "pill", size: "sm" })}
      >
        <Icon icon={busy ? Loading03Icon : Download04Icon} size={16} className={busy ? "animate-spin" : undefined} />
        {t("viewer.download")}
        <Icon icon={ArrowDown01Icon} size={14} className="text-muted-foreground" />
      </Menu.Trigger>
      <Menu.Content align="end">
        <Menu.Group>
          <Menu.GroupLabel>{t("viewer.downloadAs")}</Menu.GroupLabel>
          {options.map((option) => (
            <Menu.Item key={option.format} onClick={() => void save(option)}>
              {t(`viewer.formats.${option.format}`)}
            </Menu.Item>
          ))}
        </Menu.Group>
      </Menu.Content>
    </Menu>
  );
}
