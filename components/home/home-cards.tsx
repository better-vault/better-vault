import { Folder01Icon, MoreHorizontalIcon, PinIcon } from "@hugeicons/core-free-icons";
import { useState, type DragEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { MenuActions, type MenuAction } from "@/components/common/action-menu";
import { ContextMenu, ContextMenuTrigger } from "@/components/common/context-menu";
import { Icon } from "@/components/icon";
import { Menu } from "@/components/panelui/menu";
import type { Folder, Notebook, Vault } from "@/lib/db/database";
import { formatRelativeTime } from "@/lib/format";
import { itemColor } from "@/lib/notebooks/colors";
import { notebookIcon } from "@/lib/notebooks/icons";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { useFolderActions, useNotebookActions } from "./item-actions";

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
  const { actions, dialogs, onKeyDown } = useFolderActions(folder, folders, onOpen);
  const menu = <CardMenu label={t("folders.menu")} actions={actions} />;
  const common = {
    onKeyDown,
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
      <WithContextMenu actions={actions} dialogs={dialogs}>
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
          {menu}
        </div>
      </WithContextMenu>
    );

  return (
    <WithContextMenu actions={actions} dialogs={dialogs}>
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
          {menu}
        </span>
      </div>
    </WithContextMenu>
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
  const { actions, dialogs, onKeyDown } = useNotebookActions(notebook, folders, vaults);
  const menu = <CardMenu label={t("menu")} actions={actions} />;
  const common = {
    onKeyDown,
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
      <WithContextMenu actions={actions} dialogs={dialogs}>
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
          {menu}
        </div>
      </WithContextMenu>
    );

  return (
    <WithContextMenu actions={actions} dialogs={dialogs}>
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
          {menu}
        </span>
      </div>
    </WithContextMenu>
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

/** The card's "⋯" menu: the same actions as its right-click menu. */
function CardMenu({ label, actions }: { label: string; actions: MenuAction[] }) {
  return (
    <Menu>
      <MenuButton label={label} />
      <Menu.Content align="end">
        <MenuActions actions={actions} />
      </Menu.Content>
    </Menu>
  );
}

/** Wraps a card so a right-click (or the menu key) opens its actions at the pointer. */
function WithContextMenu({
  actions,
  dialogs,
  children,
}: {
  actions: MenuAction[];
  /** Kept outside the trigger, so a right-click inside a dialog doesn't reach the card. */
  dialogs: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger render={<div className="contents" />}>{children}</ContextMenuTrigger>
        <Menu.Content sideOffset={0}>
          <MenuActions actions={actions} />
        </Menu.Content>
      </ContextMenu>
      {dialogs}
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
