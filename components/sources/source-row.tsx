"use client";

import {
  ArrowUpRight01Icon,
  BookOpen01Icon,
  Delete02Icon,
  MoreVerticalIcon,
  PencilEdit01Icon,
} from "@hugeicons/core-free-icons";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { RenameDialog } from "@/components/common/rename-dialog";
import { Icon } from "@/components/icon";
import { Menu } from "@/components/panelui/menu";
import { Checkbox } from "@/components/ui/checkbox";
import type { Source } from "@/lib/db/database";
import { deleteSource, renameSource, setSourceSelected } from "@/lib/db/sources";
import { countWords } from "@/lib/format";
import { sourceKindIcons } from "./source-kind";

/** One source: whether it is used, its kind and size, and what can be done with it. */
export function SourceRow({ source, onRead }: { source: Source; onRead: () => void }) {
  const { t, i18n } = useTranslation("sources");
  const { t: tCommon } = useTranslation();
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const words = countWords(source.text);

  return (
    <div className="flex items-center gap-1 rounded-2xl ps-3 pe-1 transition-colors hover:bg-muted">
      <Checkbox
        checked={source.selected}
        onCheckedChange={(checked) => void setSourceSelected(source.id, checked)}
        aria-label={t("select", { title: source.title })}
      />
      <button
        type="button"
        onClick={onRead}
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-2xl px-2 py-2.5 text-start outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted">
          <Icon icon={sourceKindIcons[source.kind]} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{source.title}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {t(`kinds.${source.kind}`)} · {t("words", { count: words, formattedCount: words.toLocaleString(i18n.language) })}
          </span>
        </span>
      </button>
      <Menu>
        <Menu.Trigger
          aria-label={t("menu", { title: source.title })}
          className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-foreground/10 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Icon icon={MoreVerticalIcon} size={16} />
        </Menu.Trigger>
        <Menu.Content align="end">
          <Menu.Item onClick={onRead}>
            <Icon icon={BookOpen01Icon} />
            {t("read")}
          </Menu.Item>
          {source.url ? (
            <Menu.Item onClick={() => window.open(source.url, "_blank", "noopener,noreferrer")}>
              <Icon icon={ArrowUpRight01Icon} />
              {t("openPage")}
            </Menu.Item>
          ) : null}
          <Menu.Item onClick={() => setRenaming(true)}>
            <Icon icon={PencilEdit01Icon} />
            {tCommon("actions.rename")}
          </Menu.Item>
          <Menu.Separator />
          <Menu.Item variant="destructive" onClick={() => setDeleting(true)}>
            <Icon icon={Delete02Icon} />
            {tCommon("actions.delete")}
          </Menu.Item>
        </Menu.Content>
      </Menu>
      <RenameDialog
        open={renaming}
        onOpenChange={setRenaming}
        title={t("rename.title")}
        label={t("rename.label")}
        value={source.title}
        onSave={(title) => renameSource(source.id, title)}
      />
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={t("delete.title", { title: source.title })}
        body={t("delete.body")}
        confirmLabel={t("delete.confirm")}
        onConfirm={() => deleteSource(source.id)}
      />
    </div>
  );
}
