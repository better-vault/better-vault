import {
  ArrowDataTransferHorizontalIcon,
  Delete02Icon,
  FolderOpenIcon,
  FolderTransferIcon,
  LinkSquare02Icon,
  PaintBoardIcon,
  PencilEdit01Icon,
  PinIcon,
  PinOffIcon,
} from "@hugeicons/core-free-icons";
import { useState, type KeyboardEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import type { MenuAction } from "@/components/common/action-menu";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { RenameDialog } from "@/components/common/rename-dialog";
import type { Folder, Notebook, Vault } from "@/lib/db/database";
import { deleteFolder, moveFolder, updateFolder } from "@/lib/db/folders";
import { deleteNotebook, pinNotebook, renameNotebook, updateNotebook } from "@/lib/db/notebooks";
import { vaultOf } from "@/lib/db/vaults";
import { desktopBridge } from "@/lib/desktop/bridge";
import { notebookIcon } from "@/lib/notebooks/icons";
import { isApple } from "@/lib/platform";
import { routes } from "@/lib/routes";
import { FolderDialog, MoveDialog } from "./folder-dialogs";
import { NotebookDialog } from "./notebook-dialog";
import { useVaultName } from "./vault-name";

/** What a card's menus and keys can do, and the dialogs those actions open. */
export interface ItemActions {
  actions: MenuAction[];
  /** Rendered once beside the card. */
  dialogs: ReactNode;
  /** F2 renames, ⌘⌫ (Delete elsewhere) deletes, while the card has focus. */
  onKeyDown: (event: KeyboardEvent) => void;
}

const renameKeys = ["F2"];
const deleteKeys = () => (isApple() ? ["⌘", "⌫"] : ["Del"]);
const isDeleteKey = (event: KeyboardEvent) =>
  isApple() ? event.metaKey && event.key === "Backspace" : event.key === "Delete";

function keyHandler(rename: () => void, remove: () => void) {
  return (event: KeyboardEvent) => {
    if (event.target instanceof HTMLInputElement || event.defaultPrevented) return;
    if (event.key === "F2") {
      event.preventDefault();
      rename();
    } else if (isDeleteKey(event)) {
      event.preventDefault();
      remove();
    }
  };
}

export function useNotebookActions(
  notebook: Notebook,
  folders: Folder[],
  vaults: Vault[],
): ItemActions {
  const { t } = useTranslation("home");
  const { t: tCommon } = useTranslation();
  const { t: tWorkspace } = useTranslation("workspace");
  const navigate = useNavigate();
  const vaultName = useVaultName();
  const otherVaults = vaults.filter((vault) => vault.id !== vaultOf(notebook));
  const [renaming, setRenaming] = useState(false);
  const [editing, setEditing] = useState(false);
  const [moving, setMoving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const url = routes.notebook(notebook.id);

  const actions: MenuAction[] = [
    {
      kind: "item",
      id: "open",
      label: tCommon("actions.open"),
      icon: FolderOpenIcon,
      onSelect: () => navigate(url),
    },
    // A second window of the desktop app is not supported yet, so only the web offers a tab.
    ...(desktopBridge()
      ? []
      : [
          {
            kind: "item",
            id: "open-tab",
            label: t("actions.openNewTab"),
            icon: LinkSquare02Icon,
            onSelect: () => window.open(url, "_blank", "noopener"),
          } satisfies MenuAction,
        ]),
    { kind: "separator", id: "s1" },
    {
      kind: "item",
      id: "rename",
      label: tCommon("actions.rename"),
      icon: PencilEdit01Icon,
      shortcut: renameKeys,
      onSelect: () => setRenaming(true),
    },
    {
      kind: "item",
      id: "look",
      label: t("editLook"),
      icon: PaintBoardIcon,
      onSelect: () => setEditing(true),
    },
    {
      kind: "item",
      id: "pin",
      label: notebook.pinned ? t("vaults.unpin") : t("vaults.pin"),
      icon: notebook.pinned ? PinOffIcon : PinIcon,
      onSelect: () => void pinNotebook(notebook.id, !notebook.pinned),
    },
    {
      kind: "item",
      id: "move",
      label: t("move.action"),
      icon: FolderTransferIcon,
      onSelect: () => setMoving(true),
    },
    ...(otherVaults.length > 0
      ? [
          {
            kind: "sub",
            id: "vault",
            label: t("vaults.moveTo"),
            icon: ArrowDataTransferHorizontalIcon,
            items: otherVaults.map((vault): MenuAction => ({
              kind: "item",
              id: vault.id,
              label: vaultName(vault),
              icon: notebookIcon(vault.icon ?? "notebook"),
              onSelect: () =>
                void updateNotebook(notebook.id, { vaultId: vault.id, folderId: null }),
            })),
          } satisfies MenuAction,
        ]
      : []),
    { kind: "separator", id: "s2" },
    {
      kind: "item",
      id: "delete",
      label: tCommon("actions.delete"),
      icon: Delete02Icon,
      shortcut: deleteKeys(),
      destructive: true,
      onSelect: () => setDeleting(true),
    },
  ];

  const dialogs = (
    <>
      <RenameDialog
        open={renaming}
        onOpenChange={setRenaming}
        title={tWorkspace("rename.title")}
        label={tWorkspace("rename.label")}
        value={notebook.title}
        onSave={(title) => renameNotebook(notebook.id, title)}
      />
      <NotebookDialog
        open={editing}
        onOpenChange={setEditing}
        mode="edit"
        folders={folders}
        initial={{
          title: notebook.title,
          icon: notebook.icon,
          color: notebook.color,
          folderId: notebook.folderId,
        }}
        onSubmit={async ({ title, ...look }) => {
          if (title !== notebook.title) await renameNotebook(notebook.id, title);
          await updateNotebook(notebook.id, look);
        }}
      />
      <MoveDialog
        open={moving}
        onOpenChange={setMoving}
        name={notebook.title}
        folders={folders}
        current={notebook.folderId ?? null}
        onMove={(target) => updateNotebook(notebook.id, { folderId: target })}
      />
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={tWorkspace("delete.title", { title: notebook.title })}
        body={tWorkspace("delete.body")}
        confirmLabel={tWorkspace("delete.confirm")}
        onConfirm={() => deleteNotebook(notebook.id)}
      />
    </>
  );

  return {
    actions,
    dialogs,
    onKeyDown: keyHandler(
      () => setRenaming(true),
      () => setDeleting(true),
    ),
  };
}

export function useFolderActions(
  folder: Folder,
  folders: Folder[],
  onOpen: () => void,
): ItemActions {
  const { t } = useTranslation("home");
  const { t: tCommon } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [moving, setMoving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const actions: MenuAction[] = [
    {
      kind: "item",
      id: "open",
      label: tCommon("actions.open"),
      icon: FolderOpenIcon,
      onSelect: onOpen,
    },
    { kind: "separator", id: "s1" },
    {
      kind: "item",
      id: "edit",
      label: t("folders.edit"),
      icon: PencilEdit01Icon,
      shortcut: renameKeys,
      onSelect: () => setEditing(true),
    },
    {
      kind: "item",
      id: "move",
      label: t("move.action"),
      icon: FolderTransferIcon,
      onSelect: () => setMoving(true),
    },
    { kind: "separator", id: "s2" },
    {
      kind: "item",
      id: "delete",
      label: tCommon("actions.delete"),
      icon: Delete02Icon,
      shortcut: deleteKeys(),
      destructive: true,
      onSelect: () => setDeleting(true),
    },
  ];

  const dialogs = (
    <>
      <FolderDialog
        open={editing}
        onOpenChange={setEditing}
        mode="edit"
        initial={{ name: folder.name, color: folder.color }}
        onSubmit={(details) => updateFolder(folder.id, details)}
      />
      <MoveDialog
        open={moving}
        onOpenChange={setMoving}
        name={folder.name}
        folders={folders}
        current={folder.parentId}
        movingFolderId={folder.id}
        onMove={(target) => moveFolder(folder.id, target, folders)}
      />
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={t("folders.deleteTitle", { name: folder.name })}
        body={t("folders.deleteBody")}
        confirmLabel={t("folders.deleteConfirm")}
        onConfirm={() => deleteFolder(folder.id)}
      />
    </>
  );

  return {
    actions,
    dialogs,
    onKeyDown: keyHandler(
      () => setEditing(true),
      () => setDeleting(true),
    ),
  };
}
