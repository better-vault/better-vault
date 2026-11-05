import {
  Add01Icon,
  ArrowRight01Icon,
  Delete02Icon,
  Folder01Icon,
  FolderOpenIcon,
  MoreHorizontalIcon,
  PencilEdit01Icon,
  PinIcon,
  Search01Icon,
} from "@hugeicons/core-free-icons";
import { useState, type DragEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { Logo } from "@/components/brand/logo";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Icon } from "@/components/icon";
import { Menu } from "@/components/panelui/menu";
import { SettingsSheet } from "@/components/settings/settings-sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { openCommandPalette } from "@/lib/command";
import type { Folder, Notebook, Vault } from "@/lib/db/database";
import {
  DEFAULT_VAULT,
  createVault,
  deleteVault,
  setCurrentVault,
  updateVault,
} from "@/lib/db/vaults";
import { itemColor } from "@/lib/notebooks/colors";
import { notebookIcon } from "@/lib/notebooks/icons";
import { shortcutKeys } from "@/lib/platform";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { NOTEBOOK_DRAG, isCardDrag } from "./home-cards";
import { NotebookDialog } from "./notebook-dialog";
import { useVaultName } from "./vault-name";

interface VaultSidebarProps {
  vaults: Vault[];
  vault: Vault;
  /** The current vault's notebooks and folders. */
  notebooks: Notebook[];
  folders: Folder[];
  /** The folder open on the page. */
  currentFolder: string | null;
  onOpenFolder: (id: string | null) => void;
  onDropCards: (event: DragEvent, folderId: string | null) => void;
}

const row =
  "flex h-8 w-full min-w-0 cursor-pointer items-center gap-2 rounded-lg px-2 text-start text-sm text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring";

/**
 * The notebooks page's side panel, after Zen's workspaces and Obsidian's file
 * tree: the vault and its menu, search, pinned notebooks, the folders and
 * notebooks of the vault, and a row of vaults to switch between.
 */
export function VaultSidebar({
  vaults,
  vault,
  notebooks,
  folders,
  currentFolder,
  onOpenFolder,
  onDropCards,
}: VaultSidebarProps) {
  const { t } = useTranslation("home");
  const vaultName = useVaultName();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const pinned = notebooks.filter((notebook) => notebook.pinned);
  const keys = shortcutKeys("k");

  return (
    <aside
      aria-label={t("vaults.sidebar")}
      className="hidden w-64 shrink-0 flex-col border-e bg-muted/30 md:flex"
    >
      <div data-window-bar className="flex items-center gap-2.5 px-4 py-3">
        <Logo size={26} />
        <span className="truncate text-sm font-semibold">{vaultName(vault)}</span>
        <Menu>
          <Menu.Trigger
            aria-label={t("vaults.menu")}
            className="ms-auto flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Icon icon={MoreHorizontalIcon} size={16} />
          </Menu.Trigger>
          <Menu.Content align="end">
            <Menu.Item onClick={() => setEditing(true)}>
              <Icon icon={PencilEdit01Icon} />
              {t("vaults.edit")}
            </Menu.Item>
            {vault.id !== DEFAULT_VAULT ? (
              <Menu.Item variant="destructive" onClick={() => setDeleting(true)}>
                <Icon icon={Delete02Icon} />
                {t("vaults.delete")}
              </Menu.Item>
            ) : null}
          </Menu.Content>
        </Menu>
      </div>

      <div className="px-2 pb-2">
        <button
          type="button"
          onClick={openCommandPalette}
          className={cn(row, "bg-background ring-1 ring-border")}
        >
          <Icon icon={Search01Icon} size={16} />
          <span className="flex-1">{t("vaults.search")}</span>
          <kbd className="flex gap-0.5 font-sans text-xs text-muted-foreground">
            {keys.map((key) => (
              <span key={key} className="rounded border bg-muted px-1">
                {key}
              </span>
            ))}
          </kbd>
        </button>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <nav className="flex flex-col gap-4 px-2 pb-4">
          {pinned.length > 0 ? (
            <Group title={t("vaults.pinned")}>
              {pinned.map((notebook) => (
                <NotebookRow key={notebook.id} notebook={notebook} pinned />
              ))}
            </Group>
          ) : null}
          <Group title={t("vaults.notebooks")}>
            <FolderTree
              parent={null}
              depth={0}
              folders={folders}
              notebooks={notebooks}
              currentFolder={currentFolder}
              onOpenFolder={onOpenFolder}
              onDropCards={onDropCards}
            />
            {notebooks.length === 0 && folders.length === 0 ? (
              <p className="px-2 py-1 text-xs text-muted-foreground">{t("vaults.emptyTree")}</p>
            ) : null}
          </Group>
        </nav>
      </ScrollArea>

      {/* Zen-style vault switcher. */}
      <div className="flex items-center gap-1 border-t px-2 py-2">
        <div
          role="radiogroup"
          aria-label={t("vaults.switch")}
          className="flex min-w-0 flex-1 [scrollbar-width:none] items-center gap-1 overflow-x-auto"
        >
          {vaults.map((each) => {
            const active = each.id === vault.id;
            return (
              <button
                key={each.id}
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={vaultName(each)}
                title={vaultName(each)}
                onClick={() => {
                  setCurrentVault(each.id);
                  onOpenFolder(null);
                }}
                className={cn(
                  "flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active ? itemColor(each.color).tile : "text-muted-foreground hover:bg-accent",
                  active && "ring-1 ring-foreground/15",
                )}
              >
                <Icon icon={notebookIcon(each.icon ?? "notebook")} size={16} />
              </button>
            );
          })}
          <button
            type="button"
            aria-label={t("vaults.new")}
            title={t("vaults.new")}
            onClick={() => setCreating(true)}
            className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Icon icon={Add01Icon} size={16} />
          </button>
        </div>
        <SettingsSheet />
      </div>

      <NotebookDialog
        open={creating}
        onOpenChange={setCreating}
        mode="create"
        folders={[]}
        initial={{ title: "", icon: "notebook" }}
        labels={{
          title: t("vaults.createTitle"),
          description: t("vaults.createDescription"),
          submit: t("vaults.create"),
          placeholder: t("vaults.untitled"),
        }}
        onSubmit={async ({ title, icon, color }) => {
          const id = await createVault({ name: title, icon, color });
          setCurrentVault(id);
          onOpenFolder(null);
        }}
      />
      <NotebookDialog
        open={editing}
        onOpenChange={setEditing}
        mode="edit"
        folders={[]}
        initial={{ title: vaultName(vault), icon: vault.icon ?? "notebook", color: vault.color }}
        labels={{
          title: t("vaults.editTitle"),
          submit: t("vaults.create"),
          placeholder: t("vaults.untitled"),
        }}
        onSubmit={({ title, icon, color }) => updateVault(vault.id, { name: title, icon, color })}
      />
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={t("vaults.deleteTitle", { name: vaultName(vault) })}
        body={t("vaults.deleteBody")}
        confirmLabel={t("vaults.deleteConfirm")}
        onConfirm={() => deleteVault(vault.id)}
      />
    </aside>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col gap-0.5">
      <h2 className="px-2 pb-1 text-xs font-medium text-muted-foreground">{title}</h2>
      {children}
    </section>
  );
}

function NotebookRow({
  notebook,
  pinned = false,
  depth = 0,
}: {
  notebook: Notebook;
  pinned?: boolean;
  depth?: number;
}) {
  return (
    <Link
      to={routes.notebook(notebook.id)}
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData(NOTEBOOK_DRAG, notebook.id);
        event.dataTransfer.effectAllowed = "move";
      }}
      className={row}
      style={{ paddingInlineStart: `${0.5 + depth * 0.875}rem` }}
    >
      <Icon
        icon={notebookIcon(notebook.icon)}
        size={16}
        className={cn(
          "shrink-0",
          notebook.color && itemColor(notebook.color).tile,
          "bg-transparent",
        )}
      />
      <span className="min-w-0 flex-1 truncate">{notebook.title}</span>
      {pinned ? <Icon icon={PinIcon} size={12} className="shrink-0 opacity-60" /> : null}
    </Link>
  );
}

function FolderTree({
  parent,
  depth,
  folders,
  notebooks,
  currentFolder,
  onOpenFolder,
  onDropCards,
}: {
  parent: string | null;
  depth: number;
  folders: Folder[];
  notebooks: Notebook[];
  currentFolder: string | null;
  onOpenFolder: (id: string | null) => void;
  onDropCards: (event: DragEvent, folderId: string | null) => void;
}) {
  const children = folders
    .filter((folder) => (folder.parentId ?? null) === parent)
    .sort((a, b) => a.name.localeCompare(b.name));
  const inside = notebooks
    .filter((notebook) => (notebook.folderId ?? null) === parent)
    .sort((a, b) => a.title.localeCompare(b.title));
  return (
    <>
      {children.map((folder) => (
        <FolderRow
          key={folder.id}
          folder={folder}
          depth={depth}
          folders={folders}
          notebooks={notebooks}
          currentFolder={currentFolder}
          onOpenFolder={onOpenFolder}
          onDropCards={onDropCards}
        />
      ))}
      {inside.map((notebook) => (
        <NotebookRow key={notebook.id} notebook={notebook} depth={depth} />
      ))}
    </>
  );
}

function FolderRow({
  folder,
  depth,
  ...tree
}: {
  folder: Folder;
  depth: number;
  folders: Folder[];
  notebooks: Notebook[];
  currentFolder: string | null;
  onOpenFolder: (id: string | null) => void;
  onDropCards: (event: DragEvent, folderId: string | null) => void;
}) {
  const { t } = useTranslation("home");
  const [open, setOpen] = useState(false);
  const [over, setOver] = useState(false);
  const active = tree.currentFolder === folder.id;
  return (
    <>
      <div
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
          tree.onDropCards(event, folder.id);
          setOpen(true);
        }}
        className={cn(
          "flex items-center rounded-lg",
          over && "bg-accent ring-1 ring-primary",
          active && "bg-accent text-foreground",
        )}
        style={{ paddingInlineStart: `${depth * 0.875}rem` }}
      >
        <button
          type="button"
          aria-label={
            open
              ? t("vaults.collapse", { name: folder.name })
              : t("vaults.expand", { name: folder.name })
          }
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Icon
            icon={ArrowRight01Icon}
            size={14}
            className={cn("transition-transform rtl:rotate-180", open && "rotate-90 rtl:rotate-90")}
          />
        </button>
        <button
          type="button"
          onClick={() => tree.onOpenFolder(folder.id)}
          className={cn(row, "ps-1", active && "text-foreground")}
        >
          <Icon
            icon={open ? FolderOpenIcon : Folder01Icon}
            size={16}
            className={cn(
              "shrink-0",
              folder.color && itemColor(folder.color).tile,
              "bg-transparent",
            )}
          />
          <span className="min-w-0 flex-1 truncate">{folder.name}</span>
        </button>
      </div>
      {open ? <FolderTree parent={folder.id} depth={depth + 1} {...tree} /> : null}
    </>
  );
}
