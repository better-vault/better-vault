import {
  Add01Icon,
  ArrowRight01Icon,
  Delete02Icon,
  FileUploadIcon,
  Folder01Icon,
  FolderAddIcon,
  FolderTransferIcon,
  MoreVerticalIcon,
  PaintBoardIcon,
  PencilEdit01Icon,
  Search01Icon,
} from "@hugeicons/core-free-icons";
import { useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";
import { Logo } from "@/components/brand/logo";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { RenameDialog } from "@/components/common/rename-dialog";
import { Segmented } from "@/components/common/segmented";
import { Icon } from "@/components/icon";
import { Input } from "@/components/panelui/input";
import { Menu } from "@/components/panelui/menu";
import { SettingsSheet } from "@/components/settings/settings-sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Folder, Notebook } from "@/lib/db/database";
import {
  ancestors,
  createFolder,
  deleteFolder,
  moveFolder,
  updateFolder,
  useFolders,
} from "@/lib/db/folders";
import {
  createNotebook,
  deleteNotebook,
  renameNotebook,
  updateNotebook,
  useNotebookCounts,
  useNotebooks,
} from "@/lib/db/notebooks";
import { formatRelativeTime } from "@/lib/format";
import { itemColor } from "@/lib/notebooks/colors";
import { notebookIcon } from "@/lib/notebooks/icons";
import { routes } from "@/lib/routes";
import { IngestError, ingestFile } from "@/lib/sources/ingest";
import { cn } from "@/lib/utils";
import { FolderDialog, MoveDialog } from "./folder-dialogs";
import { NotebookDialog } from "./notebook-dialog";

/** Drag types for moving cards into folders; files use the browser's own "Files". */
const NOTEBOOK_DRAG = "application/x-better-vault-notebook";
const FOLDER_DRAG = "application/x-better-vault-folder";
const sortKey = "better-vault:home-sort";

type Sort = "recent" | "name";

const isFileDrag = (event: DragEvent) => event.dataTransfer.types.includes("Files");
const isCardDrag = (event: DragEvent) =>
  event.dataTransfer.types.includes(NOTEBOOK_DRAG) ||
  event.dataTransfer.types.includes(FOLDER_DRAG);

/** The notebooks page: folders, notebooks, search, and files dropped to start a notebook. */
export function NotebookHome() {
  const { t } = useTranslation("home");
  const { t: tCommon } = useTranslation();
  const tSources = useTranslation("sources").t;
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const notebooks = useNotebooks();
  const folders = useFolders();
  const counts = useNotebookCounts();

  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>(() =>
    typeof localStorage !== "undefined" && localStorage.getItem(sortKey) === "name"
      ? "name"
      : "recent",
  );
  const [creating, setCreating] = useState<{ files: File[] } | null>(null);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [fileDrag, setFileDrag] = useState(false);
  const dragDepth = useRef(0);

  const allFolders = useMemo(() => folders ?? [], [folders]);
  const folderParam = params.get("folder");
  const current =
    folderParam && allFolders.some((folder) => folder.id === folderParam) ? folderParam : null;
  const path = ancestors(current, allFolders);
  const currentFolder = path.at(-1);

  useEffect(() => {
    document.title = currentFolder
      ? `${currentFolder.name} · ${tCommon("appName")}`
      : tCommon("appName");
  }, [currentFolder, tCommon]);

  const openFolder = (id: string | null) => {
    setQuery("");
    setParams(id ? { folder: id } : {});
  };

  const searching = query.trim().length > 0;
  const needle = query.trim().toLocaleLowerCase();
  const order = <T extends { updatedAt: number }>(items: T[], name: (item: T) => string) =>
    [...items].sort((a, b) =>
      sort === "name" ? name(a).localeCompare(name(b)) : b.updatedAt - a.updatedAt,
    );

  const shownFolders = order(
    allFolders.filter((folder) =>
      searching
        ? folder.name.toLocaleLowerCase().includes(needle)
        : (folder.parentId ?? null) === current,
    ),
    (folder) => folder.name,
  );
  const shownNotebooks = notebooks
    ? order(
        notebooks.filter((notebook) =>
          searching
            ? notebook.title.toLocaleLowerCase().includes(needle)
            : (notebook.folderId ?? null) === current,
        ),
        (notebook) => notebook.title,
      )
    : undefined;

  /** What a folder holds, for its tile. */
  const sizeOf = (id: string) =>
    allFolders.filter((folder) => folder.parentId === id).length +
    (notebooks ?? []).filter((notebook) => notebook.folderId === id).length;

  async function dropCards(event: DragEvent, target: string | null) {
    const notebookId = event.dataTransfer.getData(NOTEBOOK_DRAG);
    const folderId = event.dataTransfer.getData(FOLDER_DRAG);
    if (notebookId) await updateNotebook(notebookId, { folderId: target });
    if (folderId && folderId !== target) await moveFolder(folderId, target, allFolders);
  }

  function describe(error: unknown): string {
    if (error instanceof IngestError) {
      if (error.reason === "read")
        return tSources("errors.read", { name: error.subject, error: error.detail });
      return tSources(`errors.${error.reason}`, { name: error.subject });
    }
    return error instanceof Error ? error.message : String(error);
  }

  const sortItems = [
    { value: "recent" as const, label: t("sort.recent") },
    { value: "name" as const, label: t("sort.name") },
  ];

  return (
    <div
      className="relative flex h-full flex-col"
      onDragEnter={(event) => {
        if (!isFileDrag(event)) return;
        event.preventDefault();
        dragDepth.current += 1;
        setFileDrag(true);
      }}
      onDragOver={(event) => {
        if (isFileDrag(event)) event.preventDefault();
      }}
      onDragLeave={(event) => {
        if (!isFileDrag(event)) return;
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (dragDepth.current === 0) setFileDrag(false);
      }}
      onDrop={(event) => {
        if (!isFileDrag(event)) return;
        event.preventDefault();
        dragDepth.current = 0;
        setFileDrag(false);
        const files = [...event.dataTransfer.files];
        if (files.length > 0) setCreating({ files });
      }}
    >
      <header data-window-bar className="flex items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2.5">
          <Logo size={30} />
          <span className="text-[0.9375rem] font-semibold">{tCommon("appName")}</span>
        </div>
        <SettingsSheet />
      </header>
      <ScrollArea className="min-h-0 flex-1">
        <main className="px-4 pb-16 sm:px-6">
          <div className="mx-auto max-w-5xl pt-8 sm:pt-12">
            <nav
              aria-label={t("breadcrumbs")}
              className="-ms-1 flex flex-wrap items-center gap-1 text-3xl font-semibold tracking-tight sm:text-4xl"
            >
              <Crumb
                onOpen={() => openFolder(null)}
                onDropCards={(event) => dropCards(event, null)}
                active={!current}
              >
                {t("title")}
              </Crumb>
              {path.map((folder) => (
                <span key={folder.id} className="flex items-center gap-1">
                  <Icon
                    icon={ArrowRight01Icon}
                    size={22}
                    className="text-muted-foreground rtl:rotate-180"
                  />
                  <Crumb
                    onOpen={() => openFolder(folder.id)}
                    onDropCards={(event) => dropCards(event, folder.id)}
                    active={folder.id === current}
                  >
                    {folder.name}
                  </Crumb>
                </span>
              ))}
            </nav>
            <p className="mt-2 text-muted-foreground">
              {current ? t("folderSubtitle") : t("subtitle")}
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-2">
              <div className="min-w-48 flex-1">
                <Input.Group>
                  <Input.Addon>
                    <Icon icon={Search01Icon} size={16} />
                  </Input.Addon>
                  <Input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={t("search")}
                    aria-label={t("search")}
                  />
                </Input.Group>
              </div>
              <Segmented<Sort>
                value={sort}
                onValueChange={(next) => {
                  setSort(next);
                  localStorage.setItem(sortKey, next);
                }}
                options={sortItems}
                aria-label={t("sort.label")}
              />
            </div>

            <Section title={t("vault")}>
              {searching ? null : (
                <NewTile
                  icon={Add01Icon}
                  label={t("newNotebook")}
                  hint={t("dropHint")}
                  onClick={() => setCreating({ files: [] })}
                />
              )}
              {shownNotebooks?.map((notebook) => (
                <NotebookCard
                  key={notebook.id}
                  notebook={notebook}
                  folders={allFolders}
                  showFolder={searching}
                  sources={counts?.get(notebook.id)?.sources ?? 0}
                />
              ))}
            </Section>

            {searching && shownFolders.length === 0 ? null : (
              <Section title={t("folders.label")}>
                {searching ? null : (
                  <NewTile
                    icon={FolderAddIcon}
                    label={t("folders.new")}
                    hint={t("folders.newHint")}
                    onClick={() => setCreatingFolder(true)}
                  />
                )}
                {shownFolders.map((folder) => (
                  <FolderTile
                    key={folder.id}
                    folder={folder}
                    folders={allFolders}
                    size={sizeOf(folder.id)}
                    onOpen={() => openFolder(folder.id)}
                    onDropCards={(event) => dropCards(event, folder.id)}
                  />
                ))}
              </Section>
            )}

            {searching && shownNotebooks?.length === 0 && shownFolders.length === 0 ? (
              <p className="mt-10 text-center text-sm text-muted-foreground">
                {t("noResults", { query: query.trim() })}
              </p>
            ) : null}
          </div>
        </main>
      </ScrollArea>

      {fileDrag ? (
        <div className="pointer-events-none absolute inset-3 z-20 flex flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-primary/50 bg-background/85 backdrop-blur-sm">
          <span className="flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Icon icon={FileUploadIcon} size={26} />
          </span>
          <p className="text-lg font-semibold">{t("drop.title")}</p>
          <p className="text-sm text-muted-foreground">{t("drop.body")}</p>
        </div>
      ) : null}

      <NotebookDialog
        open={creating !== null}
        onOpenChange={(open) => !open && setCreating(null)}
        mode="create"
        folders={allFolders}
        files={creating?.files}
        onRemoveFile={(file) =>
          setCreating((state) =>
            state ? { files: state.files.filter((each) => each !== file) } : state,
          )
        }
        initial={{
          title: creating?.files[0]?.name.replace(/\.[^.]+$/, "") ?? "",
          folderId: current,
        }}
        onSubmit={async (details) => {
          const { title, ...look } = details;
          const id = await createNotebook(title || t("untitled"), look);
          const failures: string[] = [];
          for (const file of creating?.files ?? []) {
            try {
              await ingestFile(id, file);
            } catch (error) {
              failures.push(describe(error));
            }
          }
          for (const failure of failures) toast.error(failure);
          navigate(routes.notebook(id));
        }}
      />
      <FolderDialog
        open={creatingFolder}
        onOpenChange={setCreatingFolder}
        mode="create"
        initial={{ name: "" }}
        onSubmit={async ({ name, color }) => {
          await createFolder(name, current, color);
        }}
      />
    </div>
  );
}

/** A titled grid of cards: the Vault (notebooks) and Folders sections. */
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="mt-8">
      <h2 className="mb-3 text-sm font-semibold text-muted-foreground">{title}</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </section>
  );
}

/** The dashed card that starts a new notebook or folder. */
function NewTile({
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
function Crumb({
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

function FolderTile({
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

function NotebookCard({
  notebook,
  folders,
  sources,
  showFolder,
}: {
  notebook: Notebook;
  folders: Folder[];
  sources: number;
  /** In search results, say which folder the notebook is in. */
  showFolder: boolean;
}) {
  const { t, i18n } = useTranslation("home");
  const { t: tCommon } = useTranslation();
  const { t: tWorkspace } = useTranslation("workspace");
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
        <p className="line-clamp-2 leading-snug font-semibold">{notebook.title}</p>
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
