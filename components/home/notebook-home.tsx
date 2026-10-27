"use client";

import {
  Add01Icon,
  Delete02Icon,
  MoreVerticalIcon,
  Notebook01Icon,
  PencilEdit01Icon,
} from "@hugeicons/core-free-icons";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Logo } from "@/components/brand/logo";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { RenameDialog } from "@/components/common/rename-dialog";
import { Icon } from "@/components/icon";
import { Menu } from "@/components/panelui/menu";
import { SettingsSheet } from "@/components/settings/settings-sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Notebook } from "@/lib/db/database";
import {
  createNotebook,
  deleteNotebook,
  renameNotebook,
  useNotebookCounts,
  useNotebooks,
} from "@/lib/db/notebooks";
import { formatRelativeTime } from "@/lib/format";
import { routes } from "@/lib/routes";

/** The list of notebooks. */
export function NotebookHome() {
  const { t } = useTranslation("home");
  const { t: tCommon } = useTranslation();
  const router = useRouter();
  const notebooks = useNotebooks();
  const counts = useNotebookCounts();

  useEffect(() => {
    document.title = tCommon("appName");
  }, [tCommon]);

  async function create() {
    const id = await createNotebook(t("untitled"));
    router.push(routes.notebook(id));
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2.5">
          <Logo size={30} />
          <span className="text-[0.9375rem] font-semibold">{tCommon("appName")}</span>
        </div>
        <SettingsSheet />
      </header>
      <ScrollArea className="min-h-0 flex-1">
        <main className="px-4 pb-16 sm:px-6">
          <div className="mx-auto max-w-5xl pt-8 sm:pt-12">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t("title")}</h1>
            <p className="mt-2 text-muted-foreground">{t("subtitle")}</p>

            <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <button
                type="button"
                onClick={create}
                className="flex h-40 cursor-pointer flex-col items-center justify-center gap-3 rounded-3xl border border-dashed text-muted-foreground transition-colors outline-none hover:border-foreground/30 hover:bg-muted/50 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="flex size-11 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Icon icon={Add01Icon} strokeWidth={2.2} />
                </span>
                <span className="text-sm font-medium">{t("newNotebook")}</span>
              </button>
              {notebooks?.map((notebook) => (
                <NotebookCard
                  key={notebook.id}
                  notebook={notebook}
                  sources={counts?.get(notebook.id)?.sources ?? 0}
                />
              ))}
            </div>

            {notebooks && notebooks.length === 0 ? (
              <div className="mt-10 text-center">
                <p className="font-medium">{t("empty.title")}</p>
                <p className="mt-1 text-sm text-muted-foreground">{t("empty.body")}</p>
              </div>
            ) : null}
          </div>
        </main>
      </ScrollArea>
    </div>
  );
}

function NotebookCard({ notebook, sources }: { notebook: Notebook; sources: number }) {
  const { t, i18n } = useTranslation("home");
  const { t: tCommon } = useTranslation();
  const { t: tWorkspace } = useTranslation("workspace");
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  return (
    <div className="group relative flex h-40 flex-col rounded-3xl bg-card p-5 text-card-foreground ring-1 ring-border transition-shadow hover:shadow-md">
      <Link
        href={routes.notebook(notebook.id)}
        className="absolute inset-0 rounded-3xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={notebook.title}
      />
      <span className="pointer-events-none flex size-10 items-center justify-center rounded-2xl bg-muted">
        <Icon icon={Notebook01Icon} />
      </span>
      <div className="pointer-events-none mt-auto min-w-0">
        <p className="line-clamp-2 leading-snug font-semibold">{notebook.title}</p>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {tCommon("sourceCount", { count: sources })} ·{" "}
          {t("updated", { time: formatRelativeTime(notebook.updatedAt, i18n.language) })}
        </p>
      </div>
      <div className="absolute end-3 top-3">
        <Menu>
          <Menu.Trigger
            aria-label={t("menu")}
            className="flex size-8 cursor-pointer items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Icon icon={MoreVerticalIcon} size={16} />
          </Menu.Trigger>
          <Menu.Content align="end">
            <Menu.Item onClick={() => setRenaming(true)}>
              <Icon icon={PencilEdit01Icon} />
              {tCommon("actions.rename")}
            </Menu.Item>
            <Menu.Item variant="destructive" onClick={() => setDeleting(true)}>
              <Icon icon={Delete02Icon} />
              {tCommon("actions.delete")}
            </Menu.Item>
          </Menu.Content>
        </Menu>
      </div>
      <RenameDialog
        open={renaming}
        onOpenChange={setRenaming}
        title={tWorkspace("rename.title")}
        label={tWorkspace("rename.label")}
        value={notebook.title}
        onSave={(title) => renameNotebook(notebook.id, title)}
      />
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={tWorkspace("delete.title", { title: notebook.title })}
        body={tWorkspace("delete.body")}
        confirmLabel={tWorkspace("delete.confirm")}
        onConfirm={() => deleteNotebook(notebook.id)}
      />
    </div>
  );
}
