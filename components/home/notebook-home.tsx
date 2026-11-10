import {
  Add01Icon,
  ArrowDown01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  FileImportIcon,
  FileUploadIcon,
  FolderAddIcon,
  GridViewIcon,
  Menu01Icon,
  MoreHorizontalIcon,
  Search01Icon,
} from "@hugeicons/core-free-icons";
import {
  Suspense,
  lazy,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";
import { Logo } from "@/components/brand/logo";
import { MenuActions, type MenuAction } from "@/components/common/action-menu";
import { ContextMenu, ContextMenuTrigger } from "@/components/common/context-menu";
import { Icon } from "@/components/icon";
import { Menu } from "@/components/panelui/menu";
import { SettingsSheet } from "@/components/settings/settings-sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { openCommandPalette } from "@/lib/command";
import type { Folder } from "@/lib/db/database";
import { ancestors, createFolder, moveFolder, useFolders } from "@/lib/db/folders";
import {
  createNotebook,
  updateNotebook,
  useNotebookCounts,
  useNotebooks,
} from "@/lib/db/notebooks";
import {
  DEFAULT_VAULT,
  setCurrentVault,
  useCurrentVault,
  useVaults,
  vaultOf,
} from "@/lib/db/vaults";
import { itemColor } from "@/lib/notebooks/colors";
import { notebookIcon } from "@/lib/notebooks/icons";
import { shortcutKeys } from "@/lib/platform";
import { routes } from "@/lib/routes";
import { ACCEPTED_FILES, IngestError, ingestFile } from "@/lib/sources/ingest";
import { cn } from "@/lib/utils";
import { FolderDialog } from "./folder-dialogs";
import {
  FOLDER_DRAG,
  FolderItem,
  ListHeader,
  NOTEBOOK_DRAG,
  NotebookItem,
  isFileDrag,
  useDropTarget,
  type HomeView,
} from "./home-cards";
import { NotebookDialog } from "./notebook-dialog";
import { VaultSidebar, type HomeSection } from "./vault-sidebar";
import { useVaultName } from "./vault-name";

/** The calendar is large; it loads the first time it is opened. */
const CalendarView = lazy(() => import("@/components/calendar/calendar-view"));
const NotesWorkspace = lazy(() => import("@/components/notes/notes-workspace"));

const sortKey = "better-vault:home-sort";
const viewKey = "better-vault:home-view";

type Sort = "recent" | "name";

const saved = <T extends string>(key: string, values: readonly T[], fallback: T): T => {
  try {
    const value = localStorage.getItem(key);
    return values.includes(value as T) ? (value as T) : fallback;
  } catch {
    return fallback;
  }
};

/**
 * The notebooks page, laid out like a Finder window: a side panel of
 * the library and vaults, a toolbar, the current folder's folders and
 * notebooks as icons or a list, and a path bar. Files dropped anywhere start
 * a notebook with them.
 */
export function NotebookHome() {
  const { t } = useTranslation("home");
  const { t: tCommon } = useTranslation();
  const { t: tNotes } = useTranslation("notes");
  const tSources = useTranslation("sources").t;
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const allNotebooks = useNotebooks();
  const everyFolder = useFolders();
  const counts = useNotebookCounts();
  const vaults = useVaults();
  const vaultId = useCurrentVault(vaults);
  const vault = vaults?.find((each) => each.id === vaultId);
  const vaultName = useVaultName();
  const notebooks = useMemo(
    () => allNotebooks?.filter((notebook) => vaultOf(notebook) === vaultId),
    [allNotebooks, vaultId],
  );
  const folders = useMemo(
    () => (everyFolder ?? []).filter((folder) => vaultOf(folder) === vaultId),
    [everyFolder, vaultId],
  );
  const importInput = useRef<HTMLInputElement>(null);

  const [sort, setSort] = useState<Sort>(() => saved(sortKey, ["recent", "name"], "recent"));
  const [view, setView] = useState<HomeView>(() => saved(viewKey, ["grid", "list"], "grid"));
  const [creating, setCreating] = useState<{ files: File[] } | null>(null);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [fileDrag, setFileDrag] = useState(false);
  const dragDepth = useRef(0);

  const viewParam = params.get("view");
  const section: HomeSection =
    viewParam === "recents" ||
    viewParam === "calendar" ||
    viewParam === "vault" ||
    viewParam === "notes"
      ? viewParam
      : "all";
  // The calendar and notes fill the page: they have bars of their own.
  const fullPage = section === "calendar" || section === "notes";
  // "vault" shows the same list as "all"; it only records that the vault was
  // chosen in the sidebar, so the sidebar highlights the vault instead.
  const listing = section === "all" || section === "vault";
  const folderParam = params.get("folder");
  const current =
    listing && folderParam && folders.some((folder) => folder.id === folderParam)
      ? folderParam
      : null;
  const path = ancestors(current, folders);
  const currentFolder = path.at(-1);
  const title =
    section === "notes"
      ? tNotes("title")
      : section === "calendar"
        ? t("calendar.title")
        : section === "recents"
          ? t("vaults.recent")
          : (currentFolder?.name ?? (vault ? vaultName(vault) : ""));

  useEffect(() => {
    document.title = title ? `${title} · ${tCommon("appName")}` : tCommon("appName");
  }, [title, tCommon]);

  // The right-click menu of the page's empty space; cards have menus of their own.
  const pageActions: MenuAction[] = [
    {
      kind: "item",
      id: "new-notebook",
      label: t("newNotebook"),
      icon: Add01Icon,
      onSelect: () => setCreating({ files: [] }),
    },
    {
      kind: "item",
      id: "new-folder",
      label: t("folders.new"),
      icon: FolderAddIcon,
      onSelect: () => setCreatingFolder(true),
    },
    {
      kind: "item",
      id: "import",
      label: t("vaults.importFiles"),
      icon: FileImportIcon,
      onSelect: () => importInput.current?.click(),
    },
    { kind: "separator", id: "s1" },
    {
      kind: "radio",
      id: "view",
      label: t("toolbar.view"),
      value: view,
      options: [
        { value: "grid", label: t("toolbar.grid") },
        { value: "list", label: t("toolbar.list") },
      ],
      onChange: (next) => {
        const value = next === "list" ? "list" : "grid";
        setView(value);
        remember(viewKey, value);
      },
    },
    {
      kind: "radio",
      id: "sort",
      label: t("sort.label"),
      value: sort,
      options: [
        { value: "recent", label: t("sort.recent") },
        { value: "name", label: t("sort.name") },
      ],
      onChange: (next) => {
        const value = next === "name" ? "name" : "recent";
        setSort(value);
        remember(sortKey, value);
      },
    },
  ];

  const openFolder = (id: string | null) =>
    setParams({
      ...(section === "vault" ? { view: "vault" } : {}),
      ...(id ? { folder: id } : {}),
    });
  const showSection = (next: HomeSection) => setParams(next === "all" ? {} : { view: next });

  const order = <T extends { updatedAt: number }>(items: T[], name: (item: T) => string) =>
    [...items].sort((a, b) =>
      sort === "name" ? name(a).localeCompare(name(b)) : b.updatedAt - a.updatedAt,
    );
  const shownFolders =
    section === "recents"
      ? []
      : order(
          folders.filter((folder) => (folder.parentId ?? null) === current),
          (folder) => folder.name,
        );
  const shownNotebooks = notebooks
    ? section === "recents"
      ? [...notebooks].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 24)
      : order(
          notebooks.filter((notebook) => (notebook.folderId ?? null) === current),
          (notebook) => notebook.title,
        )
    : undefined;
  const empty =
    shownNotebooks !== undefined && shownNotebooks.length === 0 && shownFolders.length === 0;
  const pinned = (notebooks ?? []).filter((notebook) => notebook.pinned);

  /** What a folder holds, for its tile. */
  const sizeOf = (id: string) =>
    folders.filter((folder) => folder.parentId === id).length +
    (notebooks ?? []).filter((notebook) => notebook.folderId === id).length;

  async function dropCards(event: DragEvent, target: string | null) {
    const notebookId = event.dataTransfer.getData(NOTEBOOK_DRAG);
    const folderId = event.dataTransfer.getData(FOLDER_DRAG);
    if (notebookId) await updateNotebook(notebookId, { folderId: target });
    if (folderId && folderId !== target) await moveFolder(folderId, target, folders);
  }

  function describe(error: unknown): string {
    if (error instanceof IngestError) {
      if (error.reason === "read")
        return tSources("errors.read", { name: error.subject, error: error.detail });
      return tSources(`errors.${error.reason}`, { name: error.subject });
    }
    return error instanceof Error ? error.message : String(error);
  }

  const remember = (key: string, value: string) => {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Storage can be blocked; the choice then lasts for this page only.
    }
  };

  return (
    <div
      className="relative flex h-full"
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
      {vaults && vault ? (
        <VaultSidebar
          vaults={vaults}
          vault={vault}
          pinned={pinned}
          section={section}
          onSection={showSection}
          onDropCards={(event) => void dropCards(event, null)}
        />
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* The toolbar: history, the title, the view, actions and search. */}
        {/* On the calendar, the calendar's own bar replaces this one (phones keep it for the menus). */}
        <header
          data-window-bar
          className={cn(
            "flex h-16 shrink-0 items-center gap-3 px-4 sm:px-6",
            fullPage && "md:hidden",
          )}
        >
          <div className="flex items-center gap-2 md:hidden">
            <Logo size={24} />
            {vaults && vault ? <MobileVaults vaults={vaults} current={vault.id} /> : null}
          </div>
          <Pill className={cn("hidden sm:flex", fullPage && "sm:hidden")}>
            <ToolButton label={t("toolbar.back")} onClick={() => navigate(-1)}>
              <Icon icon={ArrowLeft01Icon} size={18} className="rtl:rotate-180" />
            </ToolButton>
            <ToolButton label={t("toolbar.forward")} onClick={() => navigate(1)}>
              <Icon icon={ArrowRight01Icon} size={18} className="rtl:rotate-180" />
            </ToolButton>
          </Pill>
          <h1 className="min-w-0 flex-1 truncate text-lg font-semibold tracking-tight">{title}</h1>

          <Pill className={cn(fullPage && "hidden")}>
            <Menu>
              <Menu.Trigger
                aria-label={t("toolbar.view")}
                title={t("toolbar.view")}
                className="flex h-8 cursor-pointer items-center gap-1 rounded-full px-2.5 text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-popup-open:bg-accent"
              >
                <Icon icon={view === "grid" ? GridViewIcon : Menu01Icon} size={18} />
                <Icon icon={ArrowDown01Icon} size={14} />
              </Menu.Trigger>
              <Menu.Content align="end">
                <Menu.Group>
                  <Menu.GroupLabel>{t("toolbar.view")}</Menu.GroupLabel>
                  <Menu.RadioGroup
                    value={view}
                    onValueChange={(next: unknown) => {
                      const value = next === "list" ? "list" : "grid";
                      setView(value);
                      remember(viewKey, value);
                    }}
                  >
                    <Menu.RadioItem value="grid">{t("toolbar.grid")}</Menu.RadioItem>
                    <Menu.RadioItem value="list">{t("toolbar.list")}</Menu.RadioItem>
                  </Menu.RadioGroup>
                </Menu.Group>
                <Menu.Separator />
                <Menu.Group>
                  <Menu.GroupLabel>{t("sort.label")}</Menu.GroupLabel>
                  <Menu.RadioGroup
                    value={sort}
                    onValueChange={(next: unknown) => {
                      const value = next === "name" ? "name" : "recent";
                      setSort(value);
                      remember(sortKey, value);
                    }}
                  >
                    <Menu.RadioItem value="recent">{t("sort.recent")}</Menu.RadioItem>
                    <Menu.RadioItem value="name">{t("sort.name")}</Menu.RadioItem>
                  </Menu.RadioGroup>
                </Menu.Group>
              </Menu.Content>
            </Menu>
          </Pill>

          <Pill className={cn(fullPage && "hidden")}>
            <ToolButton label={t("newNotebook")} onClick={() => setCreating({ files: [] })}>
              <Icon icon={Add01Icon} size={18} />
            </ToolButton>
            <ToolButton label={t("folders.new")} onClick={() => setCreatingFolder(true)}>
              <Icon icon={FolderAddIcon} size={18} />
            </ToolButton>
            <Menu>
              <Menu.Trigger
                aria-label={t("toolbar.more")}
                title={t("toolbar.more")}
                className="flex size-8 cursor-pointer items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-popup-open:bg-accent"
              >
                <Icon icon={MoreHorizontalIcon} size={18} />
              </Menu.Trigger>
              <Menu.Content align="end">
                <Menu.Item onClick={() => importInput.current?.click()}>
                  <Icon icon={FileImportIcon} />
                  {t("vaults.importFiles")}
                </Menu.Item>
              </Menu.Content>
            </Menu>
          </Pill>

          <button
            type="button"
            hidden={fullPage}
            onClick={openCommandPalette}
            aria-label={t("vaults.search")}
            title={`${t("vaults.search")} (${shortcutKeys("k").join(" ")})`}
            className="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-card text-muted-foreground ring-1 ring-border outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Icon icon={Search01Icon} size={18} />
          </button>
          <span className="md:hidden">
            <SettingsSheet />
          </span>
          <input
            ref={importInput}
            type="file"
            multiple
            accept={ACCEPTED_FILES}
            className="hidden"
            onChange={(event) => {
              const files = [...(event.target.files ?? [])];
              event.target.value = "";
              if (files.length > 0) setCreating({ files });
            }}
          />
        </header>

        {fullPage ? (
          <main className="min-h-0 flex-1 px-2 pb-2 md:p-2 md:ps-2">
            <div className="h-full overflow-hidden rounded-3xl bg-card ring-1 ring-border">
              <Suspense
                fallback={
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    {tCommon("status.loading")}
                  </div>
                }
              >
                {section === "notes" ? <NotesWorkspace /> : <CalendarView />}
              </Suspense>
            </div>
          </main>
        ) : (
          <ContextMenu>
            <ContextMenuTrigger render={<div className="flex min-h-0 flex-1 flex-col" />}>
              <ScrollArea className="min-h-0 flex-1">
                <main className="min-h-full px-4 pt-2 pb-10 sm:px-6">
                  {empty ? (
                    <div className="flex flex-col items-center gap-3 py-20 text-center">
                      <span
                        className={cn(
                          "flex size-16 items-center justify-center rounded-[1.25rem]",
                          itemColor(vault?.color).tile,
                        )}
                      >
                        <Icon icon={notebookIcon(vault?.icon ?? "notebook")} size={28} />
                      </span>
                      <p className="font-semibold">
                        {section === "recents" || current
                          ? t("vaults.emptyFolder")
                          : t("vaults.emptyTitle")}
                      </p>
                      <p className="max-w-sm text-sm text-muted-foreground">
                        {t("vaults.emptyBody")}
                      </p>
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          onClick={() => setCreating({ files: [] })}
                          className="flex h-9 cursor-pointer items-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <Icon icon={Add01Icon} size={16} />
                          {t("newNotebook")}
                        </button>
                        <button
                          type="button"
                          onClick={() => importInput.current?.click()}
                          className="flex h-9 cursor-pointer items-center gap-2 rounded-full px-4 text-sm font-medium ring-1 ring-border outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <Icon icon={FileImportIcon} size={16} />
                          {t("vaults.importFiles")}
                        </button>
                      </div>
                    </div>
                  ) : view === "grid" ? (
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-x-2 gap-y-1">
                      {shownFolders.map((folder) => (
                        <FolderItem
                          key={folder.id}
                          folder={folder}
                          folders={folders}
                          size={sizeOf(folder.id)}
                          view="grid"
                          onOpen={() => openFolder(folder.id)}
                          onDropCards={(event) => void dropCards(event, folder.id)}
                        />
                      ))}
                      {shownNotebooks?.map((notebook) => (
                        <NotebookItem
                          key={notebook.id}
                          notebook={notebook}
                          folders={folders}
                          vaults={vaults ?? []}
                          sources={counts?.get(notebook.id)?.sources ?? 0}
                          view="grid"
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-0.5">
                      <ListHeader>
                        <span>{t("toolbar.name")}</span>
                        <span>{t("toolbar.contents")}</span>
                        <span>{t("toolbar.modified")}</span>
                        <span />
                      </ListHeader>
                      {shownFolders.map((folder) => (
                        <FolderItem
                          key={folder.id}
                          folder={folder}
                          folders={folders}
                          size={sizeOf(folder.id)}
                          view="list"
                          onOpen={() => openFolder(folder.id)}
                          onDropCards={(event) => void dropCards(event, folder.id)}
                        />
                      ))}
                      {shownNotebooks?.map((notebook) => (
                        <NotebookItem
                          key={notebook.id}
                          notebook={notebook}
                          folders={folders}
                          vaults={vaults ?? []}
                          sources={counts?.get(notebook.id)?.sources ?? 0}
                          view="list"
                        />
                      ))}
                    </div>
                  )}
                </main>
              </ScrollArea>
            </ContextMenuTrigger>
            <Menu.Content sideOffset={0}>
              <MenuActions actions={pageActions} />
            </Menu.Content>
          </ContextMenu>
        )}

        {/* The path bar: the vault and the folders down to this one, each a drop target. */}
        <nav
          aria-label={t("breadcrumbs")}
          className={cn(
            "flex h-10 shrink-0 [scrollbar-width:none] items-center gap-1 overflow-x-auto border-t px-4 text-sm text-muted-foreground sm:px-6",
            fullPage && "hidden",
          )}
        >
          {vault ? (
            <PathStep
              active={!current && listing}
              onOpen={() => openFolder(null)}
              onDropCards={(event) => void dropCards(event, null)}
            >
              <Icon icon={notebookIcon(vault.icon ?? "notebook")} size={15} />
              {vaultName(vault)}
            </PathStep>
          ) : null}
          {section === "recents" ? (
            <Crumbs>
              <span className="px-1.5 text-foreground">{t("vaults.recent")}</span>
            </Crumbs>
          ) : (
            path.map((folder: Folder) => (
              <Crumbs key={folder.id}>
                <PathStep
                  active={folder.id === current}
                  onOpen={() => openFolder(folder.id)}
                  onDropCards={(event) => void dropCards(event, folder.id)}
                >
                  {folder.name}
                </PathStep>
              </Crumbs>
            ))
          )}
          <span className="ms-auto shrink-0 ps-4 text-xs">
            {t("vaults.itemCount", {
              count: shownFolders.length + (shownNotebooks?.length ?? 0),
            })}
          </span>
        </nav>
      </div>

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
        folders={folders}
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
          const { title: name, ...look } = details;
          const id = await createNotebook(name || t("untitled"), {
            ...look,
            ...(vaultId !== DEFAULT_VAULT ? { vaultId } : {}),
          });
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
          await createFolder(name, current, color, vaultId);
        }}
      />
    </div>
  );
}

/** A rounded group of toolbar buttons. */
function Pill({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "flex h-10 shrink-0 items-center gap-0.5 rounded-full bg-card px-1 ring-1 ring-border",
        className,
      )}
    >
      {children}
    </div>
  );
}

function ToolButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex size-8 cursor-pointer items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
    >
      {children}
    </button>
  );
}

function Crumbs({ children }: { children: ReactNode }) {
  return (
    <span className="flex shrink-0 items-center gap-1">
      <Icon icon={ArrowRight01Icon} size={14} className="rtl:rotate-180" />
      {children}
    </span>
  );
}

/** One step of the path bar; notebooks and folders can be dropped on it to move them there. */
function PathStep({
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
  const drop = useDropTarget(onDropCards);
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-current={active ? "page" : undefined}
      {...drop.props}
      className={cn(
        "flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg px-1.5 py-1 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
        active && "text-foreground",
        drop.over && "bg-accent ring-1 ring-primary",
      )}
    >
      {children}
    </button>
  );
}

/** Small screens have no side panel: the vaults are in a menu. */
function MobileVaults({
  vaults,
  current,
}: {
  vaults: { id: string; name: string; icon?: string }[];
  current: string;
}) {
  const { t } = useTranslation("home");
  const vaultName = useVaultName();
  return (
    <Menu>
      <Menu.Trigger
        aria-label={t("vaults.switch")}
        className="flex h-8 cursor-pointer items-center gap-1 rounded-full px-2 text-muted-foreground outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Icon icon={ArrowDown01Icon} size={14} />
      </Menu.Trigger>
      <Menu.Content align="start">
        <Menu.RadioGroup
          value={current}
          onValueChange={(next: unknown) => typeof next === "string" && setCurrentVault(next)}
        >
          {vaults.map((vault) => (
            <Menu.RadioItem key={vault.id} value={vault.id}>
              {vaultName(vault)}
            </Menu.RadioItem>
          ))}
        </Menu.RadioGroup>
      </Menu.Content>
    </Menu>
  );
}
