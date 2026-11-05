import {
  Add01Icon,
  Calendar03Icon,
  Clock01Icon,
  Delete02Icon,
  GridViewIcon,
  MoreHorizontalIcon,
  PencilEdit01Icon,
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
import type { Notebook, Vault } from "@/lib/db/database";
import {
  DEFAULT_VAULT,
  createVault,
  deleteVault,
  setCurrentVault,
  updateVault,
} from "@/lib/db/vaults";
import { itemColor } from "@/lib/notebooks/colors";
import { notebookIcon } from "@/lib/notebooks/icons";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { NOTEBOOK_DRAG, useDropTarget } from "./home-cards";
import { NotebookDialog } from "./notebook-dialog";
import { useVaultName } from "./vault-name";

/** What the page shows: everything in the vault (by folder) or its recent notebooks. */
export type HomeSection = "all" | "recents" | "calendar";

interface VaultSidebarProps {
  vaults: Vault[];
  vault: Vault;
  /** The current vault's pinned notebooks. */
  pinned: Notebook[];
  section: HomeSection;
  onSection: (section: HomeSection) => void;
  /** Moves dropped notebooks to the top of the vault. */
  onDropCards: (event: DragEvent) => void;
}

const row =
  "relative flex h-8 w-full min-w-0 cursor-pointer items-center gap-2.5 rounded-xl px-2.5 text-start text-sm outline-none transition-colors hover:bg-foreground/5 focus-visible:ring-2 focus-visible:ring-ring";

/**
 * The notebooks page's side panel, laid out like Finder's: favourites
 * (recent, everything, pinned notebooks) above the vaults, which work like
 * locations: choose one to see what is in it.
 */
export function VaultSidebar({
  vaults,
  vault,
  pinned,
  section,
  onSection,
  onDropCards,
}: VaultSidebarProps) {
  const { t } = useTranslation("home");
  const [creating, setCreating] = useState(false);
  const drop = useDropTarget(onDropCards);

  return (
    <aside
      aria-label={t("vaults.sidebar")}
      className="m-2 me-0 hidden w-60 shrink-0 flex-col rounded-3xl bg-muted/60 ring-1 ring-border/60 md:flex"
    >
      <div data-window-bar className="flex h-14 shrink-0 items-center gap-2.5 px-4">
        <Logo size={24} />
        <span className="truncate text-sm font-semibold">{t("vaults.appTitle")}</span>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <nav className="flex flex-col gap-5 px-2 pb-3">
          <Group title={t("vaults.favorites")}>
            <button
              type="button"
              aria-current={section === "recents" ? "page" : undefined}
              onClick={() => onSection("recents")}
              className={cn(row, section === "recents" && "bg-foreground/10 font-medium")}
            >
              <Icon icon={Clock01Icon} size={18} className="text-muted-foreground" />
              {t("vaults.recent")}
            </button>
            <button
              type="button"
              aria-current={section === "all" ? "page" : undefined}
              onClick={() => onSection("all")}
              {...drop.props}
              className={cn(
                row,
                section === "all" && "bg-foreground/10 font-medium",
                drop.over && "ring-1 ring-primary",
              )}
            >
              <Icon icon={GridViewIcon} size={18} className="text-muted-foreground" />
              {t("vaults.all")}
            </button>
            <button
              type="button"
              aria-current={section === "calendar" ? "page" : undefined}
              onClick={() => onSection("calendar")}
              className={cn(row, section === "calendar" && "bg-foreground/10 font-medium")}
            >
              <Icon icon={Calendar03Icon} size={18} className="text-muted-foreground" />
              {t("calendar.title")}
            </button>
            {pinned.map((notebook) => (
              <Link
                key={notebook.id}
                to={routes.notebook(notebook.id)}
                draggable
                onDragStart={(event) => event.dataTransfer.setData(NOTEBOOK_DRAG, notebook.id)}
                className={row}
              >
                <Icon
                  icon={notebookIcon(notebook.icon)}
                  size={18}
                  className={cn(
                    "text-muted-foreground",
                    notebook.color && itemColor(notebook.color).tile,
                    "bg-transparent",
                  )}
                />
                <span className="min-w-0 truncate">{notebook.title}</span>
              </Link>
            ))}
          </Group>

          <Group title={t("vaults.label")}>
            {vaults.map((each) => (
              <VaultRow
                key={each.id}
                vault={each}
                active={each.id === vault.id}
                onChoose={() => {
                  setCurrentVault(each.id);
                  onSection("all");
                }}
              />
            ))}
            <button
              type="button"
              onClick={() => setCreating(true)}
              className={cn(row, "text-muted-foreground hover:text-foreground")}
            >
              <Icon icon={Add01Icon} size={18} />
              {t("vaults.new")}
            </button>
          </Group>
        </nav>
      </ScrollArea>

      <div className="flex items-center justify-end px-3 py-3">
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
          onSection("all");
        }}
      />
    </aside>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col gap-0.5">
      <h2 className="px-2.5 pb-1 text-xs font-medium text-muted-foreground">{title}</h2>
      {children}
    </section>
  );
}

/** A vault in the list, like a location in Finder; the chosen one has its menu. */
function VaultRow({
  vault,
  active,
  onChoose,
}: {
  vault: Vault;
  active: boolean;
  onChoose: () => void;
}) {
  const { t } = useTranslation("home");
  const vaultName = useVaultName();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const name = vaultName(vault);
  return (
    <div className={cn("group flex items-center rounded-xl", active && "bg-foreground/10")}>
      <button
        type="button"
        aria-current={active ? "true" : undefined}
        onClick={onChoose}
        className={cn(row, "hover:bg-transparent", active && "font-medium")}
      >
        <span
          className={cn(
            "flex size-6 shrink-0 items-center justify-center rounded-lg",
            itemColor(vault.color).tile,
          )}
        >
          <Icon icon={notebookIcon(vault.icon ?? "notebook")} size={14} />
        </span>
        <span className="min-w-0 truncate">{name}</span>
      </button>
      {active ? (
        <Menu>
          <Menu.Trigger
            aria-label={t("vaults.menu")}
            className="me-1 flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-background hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
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
      ) : null}
      <NotebookDialog
        open={editing}
        onOpenChange={setEditing}
        mode="edit"
        folders={[]}
        initial={{ title: name, icon: vault.icon ?? "notebook", color: vault.color }}
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
        title={t("vaults.deleteTitle", { name })}
        body={t("vaults.deleteBody")}
        confirmLabel={t("vaults.deleteConfirm")}
        onConfirm={() => deleteVault(vault.id)}
      />
    </div>
  );
}
