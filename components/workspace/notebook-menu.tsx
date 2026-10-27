"use client";

import {
  ArrowDown01Icon,
  Delete02Icon,
  GridViewIcon,
  NoteAddIcon,
  PencilEdit01Icon,
} from "@hugeicons/core-free-icons";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { RenameDialog } from "@/components/common/rename-dialog";
import { Icon } from "@/components/icon";
import { Menu } from "@/components/panelui/menu";
import { createNotebook, deleteNotebook, renameNotebook } from "@/lib/db/notebooks";
import { useWorkspace } from "./workspace-context";
import { routes } from "@/lib/routes";

/** The notebook's name, opening a menu to switch, rename or delete it. */
export function NotebookMenu() {
  const { t } = useTranslation("workspace");
  const { t: tHome } = useTranslation("home");
  const { notebook } = useWorkspace();
  const router = useRouter();
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  return (
    <>
      <Menu>
        <Menu.Trigger
          aria-label={t("notebookMenu")}
          className="flex max-w-full min-w-0 cursor-pointer items-center gap-1 rounded-lg px-2 py-1.5 text-start outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="truncate text-[0.9375rem] font-semibold">{notebook.title}</span>
          <Icon icon={ArrowDown01Icon} size={16} className="shrink-0 text-muted-foreground" />
        </Menu.Trigger>
        <Menu.Content align="center">
          <Menu.Item onClick={() => router.push(routes.home)}>
            <Icon icon={GridViewIcon} />
            {t("allNotebooks")}
          </Menu.Item>
          <Menu.Item
            onClick={async () => {
              const id = await createNotebook(tHome("untitled"));
              router.push(routes.notebook(id));
            }}
          >
            <Icon icon={NoteAddIcon} />
            {t("newNotebook")}
          </Menu.Item>
          <Menu.Separator />
          <Menu.Item onClick={() => setRenaming(true)}>
            <Icon icon={PencilEdit01Icon} />
            {t("renameNotebook")}
          </Menu.Item>
          <Menu.Item variant="destructive" onClick={() => setDeleting(true)}>
            <Icon icon={Delete02Icon} />
            {t("deleteNotebook")}
          </Menu.Item>
        </Menu.Content>
      </Menu>
      <RenameDialog
        open={renaming}
        onOpenChange={setRenaming}
        title={t("rename.title")}
        label={t("rename.label")}
        value={notebook.title}
        onSave={(title) => renameNotebook(notebook.id, title)}
      />
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={t("delete.title", { title: notebook.title })}
        body={t("delete.body")}
        confirmLabel={t("delete.confirm")}
        onConfirm={async () => {
          router.push(routes.home);
          await deleteNotebook(notebook.id);
        }}
      />
    </>
  );
}
