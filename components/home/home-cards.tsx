import {
  ArrowDataTransferHorizontalIcon,
  Delete02Icon,
  Folder01Icon,
  FolderTransferIcon,
  MoreHorizontalIcon,
  PaintBoardIcon,
  PencilEdit01Icon,
  PinIcon,
  PinOffIcon,
} from "@hugeicons/core-free-icons";
import { useState, type DragEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { RenameDialog } from "@/components/common/rename-dialog";
import { Icon } from "@/components/icon";
import { Menu } from "@/components/panelui/menu";
import type { Folder, Notebook, Vault } from "@/lib/db/database";
import { deleteFolder, moveFolder, updateFolder } from "@/lib/db/folders";
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

/** Drag types for moving notebooks and folders; files use the browser's own "Files". */
export const NOTEBOOK_DRAG = "application/x-better-vault-notebook";
export const FOLDER_DRAG = "application/x-better-vault-folder";

export const isFileDrag = (event: DragEvent) => event.dataTransfer.types.includes("Files");
export const isCardDrag = (event: DragEvent) =>
  event.dataTransfer.types.includes(NOTEBOOK_DRAG) ||
  event.dataTransfer.types.includes(FOLDER_DRAG);

export type HomeView = "grid" | "list";

/** Props to make an element take dropped notebooks and folders, with a highlight while over it. */
export function useDropTarget(onDropCards: (event: DragEvent) => void) {
  const [over, setOver] = useState(false);
  return {
    over,
    props: {
      onDragOver: (event: DragEvent) => {
        if (!isCardDrag(event)) return;
        event.preventDefault();
        setOver(true);
      },
      onDragLeave: () => setOver(false),
      onDrop: (event: DragEvent) => {
        if (!isCardDrag(event)) return;
        event.preventDefault();
        setOver(false);
        onDropCards(event);
      },
    },
  };
}

/** A large tinted mark: a folder, or a notebook's own icon. */
function ItemMark({
  icon,
  color,
  size,
}: {
  icon: Parameters<typeof Icon>[0]["icon"];
  color?: string;
  size: "lg" | "sm";
}) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center",
        size === "lg" ? "size-20 rounded-[1.375rem]" : "size-7 rounded-lg",
        itemColor(color).tile,
      )}
    >
      <Icon icon={icon} size={size === "lg" ? 34 : 15} />
    </span>
  );
}

const tileClass =
  "group relative flex flex-col items-center gap-2 rounded-2xl px-2 pt-4 pb-3 text-center outline-none transition-colors hover:bg-accent/60 focus-within:bg-accent/60";
const rowClass =
  "group relative grid grid-cols-[minmax(0,1fr)_8rem_9rem_2rem] items-center gap-3 rounded-xl px-3 py-1.5 text-sm transition-colors hover:bg-accent/60 focus-within:bg-accent/60";

export function FolderItem({
  folder,
  folders,
  size,
  view,
  onOpen,
  onDropCards,
}: {
  folder: Folder;
  folders: Folder[];
  size: number;
  view: HomeView;
  onOpen: () => void;
  onDropCards: (event: DragEvent) => void;
}) {
  const { t, i18n } = useTranslation("home");
  const drop = useDropTarget(onDropCards);
  const meta = t("folders.items", { count: size });
  const common = {
    draggable: true,
    onDragStart: (event: DragEvent) => {
      event.dataTransfer.setData(FOLDER_DRAG, folder.id);
      event.dataTransfer.effectAllowed = "move";
    },
    ...drop.props,
  };
  const open = (
    <button
      type="button"
      onClick={onOpen}
      aria-label={folder.name}
      className="absolute inset-0 cursor-pointer rounded-[inherit] outline-none focus-visible:ring-2 focus-visible:ring-ring"
    />
  );

  if (view === "list")
    return (
      <div {...common} className={cn(rowClass, drop.over && "bg-accent ring-1 ring-primary")}>
        {open}
        <span className="pointer-events-none flex min-w-0 items-center gap-3">
          <ItemMark icon={Folder01Icon} color={folder.color} size="sm" />
          <span className="truncate font-medium">{folder.name}</span>
        </span>
        <span className="pointer-events-none truncate text-muted-foreground">{meta}</span>
        <span className="pointer-events-none truncate text-muted-foreground">
          {formatRelativeTime(folder.updatedAt, i18n.language)}
        </span>
        <FolderMenu folder={folder} folders={folders} />
      </div>
    );

  return (
    <div {...common} className={cn(tileClass, drop.over && "bg-accent ring-1 ring-primary")}>
      {open}
      <span className="pointer-events-none">
        <ItemMark icon={Folder01Icon} color={folder.color} size="lg" />
      </span>
      <span className="pointer-events-none w-full min-w-0">
        <span className="block truncate text-sm font-medium">{folder.name}</span>
        <span className="block truncate text-xs text-muted-foreground">{meta}</span>
      </span>
      <span className="absolute end-1.5 top-1.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 has-[[data-popup-open]]:opacity-100">
        <FolderMenu folder={folder} folders={folders} />
      </span>
    </div>
  );
}

export function NotebookItem({
  notebook,
  folders,
  vaults,
  sources,
  view,
}: {
  notebook: Notebook;
  folders: Folder[];
  /** The vaults it can be moved to. */
  vaults: Vault[];
  sources: number;
  view: HomeView;
}) {
  const { t, i18n } = useTranslation("home");
  const { t: tCommon } = useTranslation();
  const meta = tCommon("sourceCount", { count: sources });
  const common = {
    draggable: true,
    onDragStart: (event: DragEvent) => {
      event.dataTransfer.setData(NOTEBOOK_DRAG, notebook.id);
      event.dataTransfer.effectAllowed = "move";
    },
  };
  const open = (
    <Link
      to={routes.notebook(notebook.id)}
      draggable={false}
      aria-label={notebook.title}
      className="absolute inset-0 rounded-[inherit] outline-none focus-visible:ring-2 focus-visible:ring-ring"
    />
  );
  const pin = notebook.pinned ? (
    <Icon
      icon={PinIcon}
      size={12}
      className="me-1 inline shrink-0 align-[-1px] text-muted-foreground"
    />
  ) : null;

  if (view === "list")
    return (
      <div {...common} className={rowClass}>
        {open}
        <span className="pointer-events-none flex min-w-0 items-center gap-3">
          <ItemMark icon={notebookIcon(notebook.icon)} color={notebook.color} size="sm" />
          <span className="truncate font-medium">
            {pin}
            {notebook.title}
          </span>
        </span>
        <span className="pointer-events-none truncate text-muted-foreground">{meta}</span>
        <span className="pointer-events-none truncate text-muted-foreground">
          {formatRelativeTime(notebook.updatedAt, i18n.language)}
        </span>
        <NotebookMenu notebook={notebook} folders={folders} vaults={vaults} />
      </div>
    );

  return (
    <div {...common} className={tileClass}>
      {open}
      <span className="pointer-events-none">
        <ItemMark icon={notebookIcon(notebook.icon)} color={notebook.color} size="lg" />
      </span>
      <span className="pointer-events-none w-full min-w-0">
        <span className="block truncate text-sm font-medium">
          {pin}
          {notebook.title}
        </span>
        <span
          className="block truncate text-xs text-muted-foreground"
          title={t("updated", { time: formatRelativeTime(notebook.updatedAt, i18n.language) })}
        >
          {meta}
        </span>
      </span>
      <span className="absolute end-1.5 top-1.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 has-[[data-popup-open]]:opacity-100">
        <NotebookMenu notebook={notebook} folders={folders} vaults={vaults} />
      </span>
    </div>
  );
}

function MenuButton({ label }: { label: string }) {
  return (
    <Menu.Trigger
      aria-label={label}
      className="relative flex size-7 cursor-pointer items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-background hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-popup-open:bg-background"
    >
      <Icon icon={MoreHorizontalIcon} size={16} />
    </Menu.Trigger>
  );
}

function FolderMenu({ folder, folders }: { folder: Folder; folders: Folder[] }) {
  const { t } = useTranslation("home");
  const { t: tCommon } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [moving, setMoving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  return (
    <>
      <Menu>
        <MenuButton label={t("folders.menu")} />
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
}

function NotebookMenu({
  notebook,
  folders,
  vaults,
}: {
  notebook: Notebook;
  folders: Folder[];
  vaults: Vault[];
}) {
  const { t } = useTranslation("home");
  const { t: tCommon } = useTranslation();
  const { t: tWorkspace } = useTranslation("workspace");
  const vaultName = useVaultName();
  const otherVaults = vaults.filter((vault) => vault.id !== vaultOf(notebook));
  const [renaming, setRenaming] = useState(false);
  const [editing, setEditing] = useState(false);
  const [moving, setMoving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  return (
    <>
      <Menu>
        <MenuButton label={t("menu")} />
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
}

/** The column headings of the list view. */
export function ListHeader({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_8rem_9rem_2rem] gap-3 border-b px-3 pb-2 text-xs font-medium text-muted-foreground">
      {children}
    </div>
  );
}
