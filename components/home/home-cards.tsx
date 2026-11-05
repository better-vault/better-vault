import {
  Add01Icon,
  Delete02Icon,
  Folder01Icon,
  FolderTransferIcon,
  MoreVerticalIcon,
  PaintBoardIcon,
  PencilEdit01Icon,
  PinIcon,
  PinOffIcon,
  ArrowDataTransferHorizontalIcon,
} from "@hugeicons/core-free-icons";
import { useState, type DragEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { RenameDialog } from "@/components/common/rename-dialog";
import { Icon } from "@/components/icon";
import { Menu } from "@/components/panelui/menu";
import type { Folder, Notebook, Vault } from "@/lib/db/database";
import { ancestors, deleteFolder, moveFolder, updateFolder } from "@/lib/db/folders";
import { deleteNotebook, pinNotebook, renameNotebook, updateNotebook } from "@/lib/db/notebooks";
import { vaultOf } from "@/lib/db/vaults";
import { formatRelativeTime } from "@/lib/format";
import { itemColor } from "@/lib/notebooks/colors";
import { notebookIcon } from "@/lib/notebooks/icons";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { FolderDialog, MoveDialog } from "./folder-dialogs";
import { NotebookDialog } from "./notebook-dialog";
import { useVaultName } from "./vault-name";

/** Drag types for moving cards into folders; files use the browser's own "Files". */
export const NOTEBOOK_DRAG = "application/x-better-vault-notebook";
export const FOLDER_DRAG = "application/x-better-vault-folder";

export const isFileDrag = (event: DragEvent) => event.dataTransfer.types.includes("Files");
export const isCardDrag = (event: DragEvent) =>
  event.dataTransfer.types.includes(NOTEBOOK_DRAG) ||
  event.dataTransfer.types.includes(FOLDER_DRAG);

/** A titled grid of cards: the Vault (notebooks) and Folders sections. */
export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="mt-8">
      <h2 className="mb-3 text-sm font-semibold text-muted-foreground">{title}</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </section>
  );
}

/** The dashed card that starts a new notebook or folder. */
export function NewTile({
  icon,
  label,
  hint,
  onClick,
}: {
  icon: typeof Add01Icon;
  label: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-40 cursor-pointer flex-col items-center justify-center gap-3 rounded-3xl border border-dashed text-muted-foreground transition-colors outline-none hover:border-foreground/30 hover:bg-muted/50 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex size-11 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <Icon icon={icon} strokeWidth={2.2} />
      </span>
      <span className="text-sm font-medium">{label}</span>
      <span className="text-xs">{hint}</span>
    </button>
  );
}

/** One step of the breadcrumbs; cards can be dropped on it to move them there. */
export function Crumb({
  children,
  active,
  onOpen,
  onDropCards,
}: {
  children: ReactNode;
  active: boolean;
  onOpen: () => void;
  onDropCards: (event: DragEvent) => void;
}) {
  const [over, setOver] = useState(false);
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-current={active ? "page" : undefined}
      onDragOver={(event) => {
        if (!isCardDrag(event)) return;
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        if (!isCardDrag(event)) return;
        event.preventDefault();
        setOver(false);
        onDropCards(event);
      }}
      className={cn(
        "cursor-pointer rounded-xl px-1 outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
        over && "bg-muted",
      )}
    >
      {children}
    </button>
  );
}

export function FolderTile({
  folder,
  folders,
  size,
  onOpen,
  onDropCards,
}: {
  folder: Folder;
  folders: Folder[];
  size: number;
  onOpen: () => void;
  onDropCards: (event: DragEvent) => void;
}) {
  const { t } = useTranslation("home");
  const { t: tCommon } = useTranslation();
  const [over, setOver] = useState(false);
  const [editing, setEditing] = useState(false);
  const [moving, setMoving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const look = itemColor(folder.color);

  return (
    <div
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData(FOLDER_DRAG, folder.id);
        event.dataTransfer.effectAllowed = "move";
      }}
      onDragOver={(event) => {
        if (!isCardDrag(event)) return;
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        if (!isCardDrag(event)) return;
        event.preventDefault();
        setOver(false);
        onDropCards(event);
      }}
      className={cn(
        "group relative flex h-40 flex-col rounded-3xl bg-card p-5 text-card-foreground ring-1 ring-border transition-shadow hover:shadow-md",
        over && "ring-2 ring-primary",
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        className="absolute inset-0 cursor-pointer rounded-3xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={folder.name}
      />
      <span
        className={cn(
          "pointer-events-none flex size-10 items-center justify-center rounded-2xl",
          look.tile,
        )}
      >
        <Icon icon={Folder01Icon} />
      </span>
      <div className="pointer-events-none mt-auto min-w-0">
        <p className="line-clamp-2 leading-snug font-semibold">{folder.name}</p>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {t("folders.items", { count: size })}
        </p>
      </div>
      <div className="absolute end-3 top-3">
        <Menu>
          <Menu.Trigger
            aria-label={t("folders.menu")}
            className="flex size-8 cursor-pointer items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Icon icon={MoreVerticalIcon} size={16} />
          </Menu.Trigger>
          <Menu.Content align="end">
            <Menu.Item onClick={() => setEditing(true)}>
              <Icon icon={PencilEdit01Icon} />
              {t("folders.edit")}
            </Menu.Item>
            <Menu.Item onClick={() => setMoving(true)}>
              <Icon icon={FolderTransferIcon} />
              {t("move.action")}
            </Menu.Item>
            <Menu.Item variant="destructive" onClick={() => setDeleting(true)}>
              <Icon icon={Delete02Icon} />
              {tCommon("actions.delete")}
            </Menu.Item>
          </Menu.Content>
        </Menu>
      </div>
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
    </div>
  );
}

export function NotebookCard({
  notebook,
  folders,
  vaults,
  sources,
  showFolder,
}: {
  notebook: Notebook;
  folders: Folder[];
  /** The vaults it can be moved to. */
  vaults: Vault[];
  sources: number;
  /** In search results, say which folder the notebook is in. */
  showFolder: boolean;
}) {
  const { t, i18n } = useTranslation("home");
  const { t: tCommon } = useTranslation();
  const { t: tWorkspace } = useTranslation("workspace");
  const vaultName = useVaultName();
  const otherVaults = vaults.filter((vault) => vault.id !== vaultOf(notebook));
  const [renaming, setRenaming] = useState(false);
  const [editing, setEditing] = useState(false);
  const [moving, setMoving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const look = itemColor(notebook.color);
  const folderPath = showFolder && notebook.folderId ? ancestors(notebook.folderId, folders) : [];

  return (
    <div
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData(NOTEBOOK_DRAG, notebook.id);
        event.dataTransfer.effectAllowed = "move";
      }}
      className="group relative flex h-40 flex-col rounded-3xl bg-card p-5 text-card-foreground ring-1 ring-border transition-shadow hover:shadow-md"
    >
      <Link
        to={routes.notebook(notebook.id)}
        draggable={false}
        className="absolute inset-0 rounded-3xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={notebook.title}
      />
      <span
        className={cn(
          "pointer-events-none flex size-10 items-center justify-center rounded-2xl",
          look.tile,
        )}
      >
        <Icon icon={notebookIcon(notebook.icon)} />
      </span>
      <div className="pointer-events-none mt-auto min-w-0">
        <p className="line-clamp-2 leading-snug font-semibold">
          {notebook.pinned ? (
            <Icon
              icon={PinIcon}
              size={14}
              className="me-1 inline align-[-2px] text-muted-foreground"
            />
          ) : null}
          {notebook.title}
        </p>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {folderPath.length > 0
            ? `${folderPath.map((folder) => folder.name).join(" / ")} · `
            : null}
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
            <Menu.Item onClick={() => setEditing(true)}>
              <Icon icon={PaintBoardIcon} />
              {t("editLook")}
            </Menu.Item>
            <Menu.Item onClick={() => void pinNotebook(notebook.id, !notebook.pinned)}>
              <Icon icon={notebook.pinned ? PinOffIcon : PinIcon} />
              {notebook.pinned ? t("vaults.unpin") : t("vaults.pin")}
            </Menu.Item>
            <Menu.Item onClick={() => setMoving(true)}>
              <Icon icon={FolderTransferIcon} />
              {t("move.action")}
            </Menu.Item>
            {otherVaults.length > 0 ? (
              <Menu.Sub>
                <Menu.SubTrigger>
                  <Icon icon={ArrowDataTransferHorizontalIcon} />
                  {t("vaults.moveTo")}
                </Menu.SubTrigger>
                <Menu.SubContent>
                  {otherVaults.map((vault) => (
                    <Menu.Item
                      key={vault.id}
                      onClick={() =>
                        void updateNotebook(notebook.id, { vaultId: vault.id, folderId: null })
                      }
                    >
                      <Icon icon={notebookIcon(vault.icon ?? "notebook")} />
                      {vaultName(vault)}
                    </Menu.Item>
                  ))}
                </Menu.SubContent>
              </Menu.Sub>
            ) : null}
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
    </div>
  );
}
