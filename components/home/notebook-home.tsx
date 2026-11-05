import {
  Add01Icon,
  ArrowRight01Icon,
  FileImportIcon,
  FileUploadIcon,
  FolderAddIcon,
  Search01Icon,
} from "@hugeicons/core-free-icons";
import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";
import { Logo } from "@/components/brand/logo";
import { Segmented } from "@/components/common/segmented";
import { Icon } from "@/components/icon";
import { Input } from "@/components/panelui/input";
import { SettingsSheet } from "@/components/settings/settings-sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { openCommandPalette } from "@/lib/command";
import { ancestors, createFolder, moveFolder, useFolders } from "@/lib/db/folders";
import {
  createNotebook,
  updateNotebook,
  useNotebookCounts,
  useNotebooks,
} from "@/lib/db/notebooks";
import { DEFAULT_VAULT, useCurrentVault, useVaults, vaultOf } from "@/lib/db/vaults";
import { formatRelativeTime } from "@/lib/format";
import { itemColor } from "@/lib/notebooks/colors";
import { notebookIcon } from "@/lib/notebooks/icons";
import { shortcutKeys } from "@/lib/platform";
import { routes } from "@/lib/routes";
import { ACCEPTED_FILES, IngestError, ingestFile } from "@/lib/sources/ingest";
import { cn } from "@/lib/utils";
import { FolderDialog } from "./folder-dialogs";
import {
  Crumb,
  FOLDER_DRAG,
  FolderTile,
  NOTEBOOK_DRAG,
  NewTile,
  NotebookCard,
  Section,
  isFileDrag,
} from "./home-cards";
import { NotebookDialog } from "./notebook-dialog";
import { VaultSidebar } from "./vault-sidebar";
import { useVaultName } from "./vault-name";

const sortKey = "better-vault:home-sort";

type Sort = "recent" | "name";

/**
 * The notebooks page: a vault's sidebar (pinned notebooks, folder tree, vault
 * switcher) beside its notebooks, with quick actions, recent notebooks,
 * folders, search, and files dropped to start a notebook.
 */
/** The notebooks page: folders, notebooks, search, and files dropped to start a notebook. */
export function NotebookHome() {
  const { t, i18n } = useTranslation("home");
  const { t: tCommon } = useTranslation();
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
    () => everyFolder?.filter((folder) => vaultOf(folder) === vaultId),
    [everyFolder, vaultId],
  );
  const importInput = useRef<HTMLInputElement>(null);

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

  const recent = useMemo(
    () => [...(notebooks ?? [])].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 4),
    [notebooks],
  );
  const sourceTotal = (notebooks ?? []).reduce(
    (sum, notebook) => sum + (counts?.get(notebook.id)?.sources ?? 0),
    0,
  );
  const empty = notebooks !== undefined && notebooks.length === 0 && allFolders.length === 0;
  const keys = shortcutKeys("k");

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
      {/* Small screens have no sidebar: the app name and Settings stay in a bar. */}
      <header data-window-bar className="flex items-center justify-between px-4 py-3 md:hidden">
        <div className="flex items-center gap-2.5">
          <Logo size={28} />
          <span className="text-[0.9375rem] font-semibold">{tCommon("appName")}</span>
        </div>
        <SettingsSheet />
      </header>
      <div className="flex min-h-0 flex-1">
        {vaults && vault ? (
          <VaultSidebar
            vaults={vaults}
            vault={vault}
            notebooks={notebooks ?? []}
            folders={allFolders}
            currentFolder={current}
            onOpenFolder={openFolder}
            onDropCards={(event, target) => void dropCards(event, target)}
          />
        ) : null}
        <ScrollArea className="min-h-0 flex-1">
          <main className="px-4 pb-16 sm:px-8">
            <div className="mx-auto max-w-5xl pt-8 md:pt-14">
              {current ? (
                <nav
                  aria-label={t("breadcrumbs")}
                  className="-ms-1 flex flex-wrap items-center gap-1 text-3xl font-semibold tracking-tight sm:text-4xl"
                >
                  <Crumb
                    onOpen={() => openFolder(null)}
                    onDropCards={(event) => dropCards(event, null)}
                    active={!current}
                  >
                    {vault ? vaultName(vault) : t("title")}
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
              ) : (
                <div className="flex items-center gap-4">
                  <span
                    className={cn(
                      "flex size-14 shrink-0 items-center justify-center rounded-2xl",
                      itemColor(vault?.color).tile,
                    )}
                  >
                    <Icon icon={notebookIcon(vault?.icon ?? "notebook")} size={28} />
                  </span>
                  <div className="min-w-0">
                    <h1 className="truncate text-3xl font-semibold tracking-tight sm:text-4xl">
                      {vault ? vaultName(vault) : t("title")}
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {t("vaults.stats", {
                        notebooks: t("vaults.notebookCount", { count: notebooks?.length ?? 0 }),
                        sources: tCommon("sourceCount", { count: sourceTotal }),
                        folders: t("vaults.folderCount", { count: allFolders.length }),
                      })}
                    </p>
                  </div>
                </div>
              )}
              {current ? <p className="mt-2 text-muted-foreground">{t("folderSubtitle")}</p> : null}

              {!current && !searching ? (
                <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <QuickAction
                    icon={Add01Icon}
                    label={t("newNotebook")}
                    hint={t("vaults.newNotebookHint")}
                    onClick={() => setCreating({ files: [] })}
                  />
                  <QuickAction
                    icon={FileImportIcon}
                    label={t("vaults.importFiles")}
                    hint={t("vaults.importHint")}
                    onClick={() => importInput.current?.click()}
                  />
                  <QuickAction
                    icon={Search01Icon}
                    label={t("vaults.search")}
                    hint={t("vaults.searchHint")}
                    keys={keys}
                    onClick={openCommandPalette}
                  />
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
                </div>
              ) : null}

              {!current && !searching && recent.length > 0 ? (
                <section aria-label={t("vaults.recent")} className="mt-8">
                  <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
                    {t("vaults.recent")}
                  </h2>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    {recent.map((notebook) => (
                      <Link
                        key={notebook.id}
                        to={routes.notebook(notebook.id)}
                        className="flex min-w-0 items-center gap-3 rounded-2xl bg-card p-3 ring-1 ring-border transition-shadow outline-none hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <span
                          className={cn(
                            "flex size-9 shrink-0 items-center justify-center rounded-xl",
                            itemColor(notebook.color).tile,
                          )}
                        >
                          <Icon icon={notebookIcon(notebook.icon)} size={18} />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">
                            {notebook.title}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {formatRelativeTime(notebook.updatedAt, i18n.language)}
                          </span>
                        </span>
                      </Link>
                    ))}
                  </div>
                </section>
              ) : null}

              {empty ? (
                <div className="mt-10 flex flex-col items-center gap-2 rounded-3xl border border-dashed px-6 py-12 text-center">
                  <p className="font-semibold">{t("vaults.emptyTitle")}</p>
                  <p className="max-w-sm text-sm text-muted-foreground">{t("vaults.emptyBody")}</p>
                </div>
              ) : null}

              <div className={cn("mt-8 flex flex-wrap items-center gap-2", empty && "hidden")}>
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

              <Section title={t("vaults.notebooks")}>
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
                    vaults={vaults ?? []}
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
          const id = await createNotebook(title || t("untitled"), {
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

/** A large button for one of the vault's first actions. */
function QuickAction({
  icon,
  label,
  hint,
  keys,
  onClick,
}: {
  icon: typeof Add01Icon;
  label: string;
  hint: string;
  keys?: string[];
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-w-0 cursor-pointer items-center gap-3 rounded-2xl bg-card p-4 text-start ring-1 ring-border transition-shadow outline-none hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <Icon icon={icon} size={18} strokeWidth={2.2} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{label}</span>
        <span className="block truncate text-xs text-muted-foreground">{hint}</span>
      </span>
      {keys ? (
        <kbd className="hidden shrink-0 gap-0.5 font-sans text-xs text-muted-foreground lg:flex">
          {keys.map((key) => (
            <span key={key} className="rounded border bg-muted px-1.5 py-0.5">
              {key}
            </span>
          ))}
        </kbd>
      ) : null}
    </button>
  );
}
