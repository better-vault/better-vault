import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  BookOpen01Icon,
  Cancel01Icon,
  Edit02Icon,
  HierarchyCircle01Icon,
  KeyboardIcon,
  Note01Icon,
  SidebarRightIcon,
} from "@hugeicons/core-free-icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";
import { Icon } from "@/components/icon";
import { ScrollArea } from "@/components/ui/scroll-area";
import { openCommandPalette } from "@/lib/command";
import { createNote, renameNote, saveNoteBody } from "@/lib/db/notes";
import type { Note, NoteLink } from "@/lib/db/types";
import { useCurrentVault } from "@/lib/db/vaults";
import { formatRelativeTime } from "@/lib/format";
import type { GraphNode } from "@/lib/notes/graph";
import { resolveLink } from "@/lib/notes/resolve";
import { extractHeadings, sameName } from "@/lib/notes/syntax";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import type { CompletionWorld } from "./editor/completion";
import { NoteEditor, type NoteEditorHandle } from "./editor/note-editor";
import { GraphView } from "./graph-view";
import { NoteDetails } from "./note-details";
import { NoteList } from "./note-list";
import { NoteReader } from "./note-reader";
import { NoteSwitcher } from "./note-switcher";
import { ShortcutsDialog, keyLabel } from "./shortcuts-dialog";
import { useNotesWorld } from "./use-notes-world";

const GRAPH_TAB = "graph";
const TABS_KEY = "better-vault:notes-tabs";
const MODE_KEY = "better-vault:notes-mode";
const DETAILS_KEY = "better-vault:notes-details";

const read = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};
const write = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private windows may refuse storage; the page works without it.
  }
};

/**
 * The notes page, in the spirit of Obsidian: a list of the vault's notes,
 * tabs of open notes with a Live Preview editor (or the reading view), the
 * note's backlinks and outline, and the graph of how everything links,
 * across vaults. Obsidian's keys work throughout.
 */
export default function NotesWorkspace() {
  const { t, i18n } = useTranslation("notes");
  const navigate = useNavigate();
  const world = useNotesWorld();
  const vaultId = useCurrentVault(world?.vaults);
  const [params, setParams] = useSearchParams();
  const activeId = params.get("note");
  const graphOpen = params.get("graph") === "1";
  const notebookFilter = params.get("notebook");

  const [tabs, setTabs] = useState<string[]>(() => read<string[]>(TABS_KEY, []));
  const [mode, setMode] = useState<"edit" | "read">(() => read(MODE_KEY, "edit"));
  const [details, setDetails] = useState<boolean>(() => read(DETAILS_KEY, true));
  const [query, setQuery] = useState("");
  const [switcher, setSwitcher] = useState(false);
  const [shortcuts, setShortcuts] = useState(false);
  // A note just made gets its title selected, ready to type over.
  const [freshNote, setFreshNote] = useState<string | null>(null);
  const history = useRef<{ back: string[]; forward: string[] }>({ back: [], forward: [] });
  const editor = useRef<NoteEditorHandle>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const pendingReveal = useRef<string | null>(null);

  const notes = world?.notes;
  const byId = useMemo(() => new Map((notes ?? []).map((note) => [note.id, note])), [notes]);
  const note = activeId ? (byId.get(activeId) ?? null) : null;
  const listNotes = useMemo(
    () =>
      (notes ?? []).filter((each) =>
        notebookFilter ? each.notebookId === notebookFilter : each.vaultId === vaultId,
      ),
    [notes, vaultId, notebookFilter],
  );
  const filterNotebook = notebookFilter
    ? world?.notebooks.find((each) => each.id === notebookFilter)
    : undefined;

  useEffect(() => write(TABS_KEY, tabs), [tabs]);
  useEffect(() => write(MODE_KEY, mode), [mode]);
  useEffect(() => write(DETAILS_KEY, details), [details]);

  const show = useCallback(
    (next: { note?: string | null; graph?: boolean }, record = true) => {
      const current = params.get("graph") === "1" ? GRAPH_TAB : params.get("note");
      const target = next.graph ? GRAPH_TAB : (next.note ?? null);
      if (record && current && current !== target) {
        history.current.back.push(current);
        history.current.forward = [];
      }
      const out: Record<string, string> = { view: "notes" };
      if (notebookFilter) out.notebook = notebookFilter;
      if (next.graph) out.graph = "1";
      const keep = next.graph ? (params.get("note") ?? undefined) : (next.note ?? undefined);
      if (keep) out.note = keep;
      setParams(out);
    },
    [params, setParams, notebookFilter],
  );

  /** Opens a note in the current tab, or a new one (⌘-click). */
  const open = useCallback(
    (id: string, newTab = false) => {
      setTabs((current) => {
        if (current.includes(id)) return current;
        const at = current.indexOf(graphOpen ? GRAPH_TAB : (activeId ?? ""));
        if (newTab || at < 0) return [...current, id];
        const next = [...current];
        next[at] = id;
        return next;
      });
      show({ note: id });
    },
    [activeId, graphOpen, show],
  );

  const openGraph = useCallback(() => {
    setTabs((current) => (current.includes(GRAPH_TAB) ? current : [...current, GRAPH_TAB]));
    show({ graph: true });
  }, [show]);

  const closeTab = useCallback(
    (id: string) => {
      setTabs((current) => {
        const at = current.indexOf(id);
        const next = current.filter((each) => each !== id);
        const isActive = id === (graphOpen ? GRAPH_TAB : activeId);
        if (isActive) {
          const neighbour = next[Math.min(at, next.length - 1)];
          if (neighbour === GRAPH_TAB) show({ graph: true }, false);
          else show({ note: neighbour ?? null }, false);
        }
        return next;
      });
    },
    [activeId, graphOpen, show],
  );

  const newNote = useCallback(
    async (title = "") => {
      const created = await createNote({
        vaultId: filterNotebook?.vaultId ?? vaultId,
        title: title || t("untitled"),
        notebookId: notebookFilter,
      });
      setFreshNote(created.id);
      open(created.id);
      setMode("edit");
    },
    [vaultId, notebookFilter, filterNotebook, open, t],
  );

  const revealHeading = useCallback(
    (heading: string) => {
      if (!note) return;
      const found = extractHeadings(note.body).find((each) => sameName(each.text, heading));
      if (!found) return;
      setMode("edit");
      requestAnimationFrame(() => editor.current?.reveal(found.from));
    },
    [note],
  );

  const openLink = useCallback(
    async (link: NoteLink) => {
      if (!world) return;
      if (!link.target && link.heading) return revealHeading(link.heading);
      const fromVault = note?.vaultId ?? vaultId;
      const target = resolveLink(link, world, fromVault);
      if (target?.kind === "note") {
        pendingReveal.current = link.heading ?? null;
        open(target.note.id);
      } else if (target?.kind === "notebook") {
        navigate(routes.notebook(target.notebook.id));
      } else if (target?.kind === "source") {
        navigate(
          `${routes.notebook(target.source.notebookId)}?source=${encodeURIComponent(target.source.id)}`,
        );
      } else if (link.kind === "note" && link.target) {
        // A link to nothing yet creates the note, in the vault it names.
        const slash = link.target.indexOf("/");
        const named =
          slash > 0
            ? world.vaults.find((v) => sameName(world.vaultName(v), link.target.slice(0, slash)))
            : undefined;
        const created = await createNote({
          vaultId: named?.id ?? fromVault,
          title: named ? link.target.slice(slash + 1) : link.target,
          notebookId: notebookFilter,
        });
        open(created.id);
      } else {
        toast.error(t("missing"));
      }
    },
    [world, note, vaultId, open, navigate, revealHeading, notebookFilter, t],
  );

  // After following a `[[Note#Heading]]` link, scroll to the heading once the note is open.
  useEffect(() => {
    const heading = pendingReveal.current;
    if (!heading || !note) return;
    pendingReveal.current = null;
    revealHeading(heading);
  }, [note, revealHeading]);

  const go = useCallback(
    (direction: "back" | "forward") => {
      const stacks = history.current;
      const from = direction === "back" ? stacks.back : stacks.forward;
      const to = direction === "back" ? stacks.forward : stacks.back;
      const target = from.pop();
      if (!target) return;
      const current = graphOpen ? GRAPH_TAB : activeId;
      if (current) to.push(current);
      if (target === GRAPH_TAB) show({ graph: true }, false);
      else {
        setTabs((list) => (list.includes(target) ? list : [...list, target]));
        show({ note: target }, false);
      }
    },
    [activeId, graphOpen, show],
  );

  // Obsidian's workspace keys. Editing keys live in the editor itself.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();
      const typing =
        event.target instanceof HTMLElement &&
        (event.target.isContentEditable || ["INPUT", "TEXTAREA"].includes(event.target.tagName));
      if (mod && !event.shiftKey && !event.altKey && key === "n") {
        event.preventDefault();
        void newNote();
      } else if (mod && !event.shiftKey && key === "o") {
        event.preventDefault();
        setSwitcher(true);
      } else if (mod && !event.shiftKey && key === "p") {
        event.preventDefault();
        openCommandPalette();
      } else if (mod && event.shiftKey && key === "f") {
        event.preventDefault();
        searchRef.current?.focus();
      } else if (mod && !event.shiftKey && key === "e") {
        event.preventDefault();
        setMode((current) => (current === "edit" ? "read" : "edit"));
      } else if (mod && !event.shiftKey && key === "g") {
        event.preventDefault();
        if (graphOpen) show({ note: activeId });
        else openGraph();
      } else if (mod && event.altKey && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
        event.preventDefault();
        go(event.key === "ArrowLeft" ? "back" : "forward");
      } else if (mod && !event.shiftKey && key === "w") {
        const current = graphOpen ? GRAPH_TAB : activeId;
        if (current) {
          event.preventDefault();
          closeTab(current);
        }
      } else if (!mod && event.key === "?" && !typing) {
        event.preventDefault();
        setShortcuts(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [newNote, openGraph, show, go, closeTab, graphOpen, activeId]);

  const completion = useCallback((): CompletionWorld => {
    if (!world) return { notes: [], notebooks: [], sources: [], tags: [] };
    const here = note?.vaultId ?? vaultId;
    const vaultLabel = new Map(world.vaults.map((vault) => [vault.id, world.vaultName(vault)]));
    return {
      notes: world.notes
        .filter((each) => each.id !== note?.id)
        .map((each) => ({
          title: each.title,
          vault: vaultLabel.get(each.vaultId) ?? "",
          aliases: each.aliases,
          here: each.vaultId === here,
        })),
      notebooks: world.notebooks.map((each) => each.title),
      sources: world.sources.map((each) => each.title),
      tags: [...new Set(world.notes.flatMap((each) => each.tags))].sort(),
    };
  }, [world, note, vaultId]);

  const resolves = useCallback(
    (link: NoteLink) =>
      (!link.target && !!link.heading) ||
      (world ? resolveLink(link, world, note?.vaultId ?? vaultId) !== null : false),
    [world, note, vaultId],
  );

  if (!world) return null;

  const vaultLabel = (each: Note) => {
    if (each.vaultId === vaultId) return null;
    const vault = world.vaults.find((v) => v.id === each.vaultId);
    return vault ? world.vaultName(vault) : null;
  };
  const activeTab = graphOpen ? GRAPH_TAB : activeId;
  // Tabs of deleted notes are left out.
  const visibleTabs = tabs.filter((id) => id === GRAPH_TAB || byId.has(id));

  return (
    <div className="flex h-full min-h-0 gap-2">
      {/* Two panels: the list of notes, and the open note (or the graph). */}
      <div className="hidden w-72 shrink-0 flex-col overflow-hidden rounded-3xl bg-card ring-1 ring-border md:flex">
        <NoteList
          title={t("title")}
          banner={
            filterNotebook ? (
              <div className="flex items-center gap-2 rounded-xl bg-muted px-2.5 py-1.5 text-xs">
                <span className="min-w-0 flex-1 truncate">
                  {t("fromNotebook", { title: filterNotebook.title })}
                </span>
                <button
                  type="button"
                  aria-label={t("thisVault")}
                  onClick={() =>
                    setParams({ view: "notes", ...(activeId ? { note: activeId } : {}) })
                  }
                  className="flex size-5 cursor-pointer items-center justify-center rounded-full outline-none hover:bg-background focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Icon icon={Cancel01Icon} size={12} />
                </button>
              </div>
            ) : null
          }
          notes={listNotes}
          vaults={world.vaults}
          activeId={graphOpen ? null : activeId}
          query={query}
          onQuery={setQuery}
          onOpen={open}
          onCreate={() => void newNote()}
          onImport={(files) =>
            void (async () => {
              let opened: string | null = null;
              for (const file of files) {
                const created = await createNote({
                  vaultId: filterNotebook?.vaultId ?? vaultId,
                  title: file.name.replace(/\.(md|markdown|txt)$/i, ""),
                  body: await file.text(),
                  notebookId: notebookFilter,
                });
                opened ??= created.id;
              }
              toast.success(t("actions.imported", { count: files.length }));
              if (opened) open(opened);
            })()
          }
          onDeleted={(id) => closeTab(id)}
          searchRef={searchRef}
        />
      </div>

      {/* Tabs, then the open note or the graph. */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-3xl bg-card ring-1 ring-border">
        <div className="flex h-14 shrink-0 items-center gap-1 border-b px-3">
          <button
            type="button"
            onClick={() => go("back")}
            aria-label={t("actions.back")}
            title={`${t("actions.back")} (${keyLabel("Mod+Alt+←")})`}
            className="flex size-7 cursor-pointer items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Icon icon={ArrowLeft01Icon} size={16} className="rtl:rotate-180" />
          </button>
          <button
            type="button"
            onClick={() => go("forward")}
            aria-label={t("actions.forward")}
            title={`${t("actions.forward")} (${keyLabel("Mod+Alt+→")})`}
            className="flex size-7 cursor-pointer items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Icon icon={ArrowRight01Icon} size={16} className="rtl:rotate-180" />
          </button>
          <div
            role="tablist"
            aria-label={t("title")}
            className="flex min-w-0 flex-1 [scrollbar-width:none] items-center gap-1 overflow-x-auto"
          >
            {visibleTabs.map((id) => {
              const tabNote = id === GRAPH_TAB ? null : byId.get(id);
              const label = id === GRAPH_TAB ? t("tabs.graph") : (tabNote?.title ?? "");
              const active = id === activeTab;
              return (
                <div
                  key={id}
                  role="tab"
                  aria-selected={active}
                  className={cn(
                    "group flex h-8 max-w-48 shrink-0 items-center gap-1.5 rounded-lg ps-2.5 pe-1 text-sm",
                    active
                      ? "bg-foreground/10 font-medium"
                      : "text-muted-foreground hover:bg-accent/60",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => (id === GRAPH_TAB ? show({ graph: true }) : show({ note: id }))}
                    onAuxClick={(event) => event.button === 1 && closeTab(id)}
                    className="flex min-w-0 cursor-pointer items-center gap-1.5 outline-none focus-visible:underline"
                  >
                    <Icon
                      icon={id === GRAPH_TAB ? HierarchyCircle01Icon : Note01Icon}
                      size={14}
                      className="shrink-0"
                    />
                    <span className="truncate">{label}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => closeTab(id)}
                    aria-label={t("tabs.close")}
                    className="flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-md opacity-0 outline-none group-hover:opacity-100 hover:bg-background focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring aria-[current]:opacity-100"
                    aria-current={active ? "true" : undefined}
                  >
                    <Icon icon={Cancel01Icon} size={12} />
                  </button>
                </div>
              );
            })}
          </div>
          {note && !graphOpen ? (
            <button
              type="button"
              onClick={() => setMode((current) => (current === "edit" ? "read" : "edit"))}
              aria-label={t("modes.toggle")}
              title={`${mode === "edit" ? t("modes.edit") : t("modes.read")} · ${t("modes.toggle")} (${keyLabel("Mod+E")})`}
              className="flex size-8 cursor-pointer items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Icon icon={mode === "edit" ? Edit02Icon : BookOpen01Icon} size={16} />
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => (graphOpen ? show({ note: activeId }) : openGraph())}
            aria-label={t("actions.graph")}
            aria-pressed={graphOpen}
            title={`${t("actions.graph")} (${keyLabel("Mod+G")})`}
            className={cn(
              "flex size-8 cursor-pointer items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
              graphOpen && "bg-accent text-foreground",
            )}
          >
            <Icon icon={HierarchyCircle01Icon} size={16} />
          </button>
          <button
            type="button"
            onClick={() => setShortcuts(true)}
            aria-label={t("actions.shortcuts")}
            title={`${t("actions.shortcuts")} (?)`}
            className="hidden size-8 cursor-pointer items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring sm:flex"
          >
            <Icon icon={KeyboardIcon} size={16} />
          </button>
          {note && !graphOpen ? (
            <button
              type="button"
              onClick={() => setDetails((current) => !current)}
              aria-label={details ? t("panes.hide") : t("panes.show")}
              aria-pressed={details}
              title={details ? t("panes.hide") : t("panes.show")}
              className={cn(
                "hidden size-8 cursor-pointer items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring lg:flex",
                details && "text-foreground",
              )}
            >
              <Icon icon={SidebarRightIcon} size={16} className="rtl:-scale-x-100" />
            </button>
          ) : null}
        </div>

        {graphOpen ? (
          <GraphView
            world={world}
            vaultColors={world.vaultColors}
            focusId={activeId && byId.has(activeId) ? activeId : null}
            onOpen={(node: GraphNode) => {
              const [kind, id] = [
                node.id.slice(0, node.id.indexOf(":")),
                node.id.slice(node.id.indexOf(":") + 1),
              ];
              if (kind === "note") open(id);
              else if (kind === "missing")
                void openLink({ kind: "note", target: node.label, embed: false });
              else if (kind === "notebook") navigate(routes.notebook(id));
              else if (kind === "source") {
                const source = world.sources.find((each) => each.id === id);
                if (source)
                  navigate(
                    `${routes.notebook(source.notebookId)}?source=${encodeURIComponent(id)}`,
                  );
              } else if (kind === "tag") {
                setQuery(node.label);
              }
            }}
          />
        ) : note ? (
          <div className="flex min-h-0 flex-1">
            <div className="flex min-w-0 flex-1 flex-col">
              <NoteTitle
                key={`${note.id}:${note.title}`}
                note={note}
                autoFocus={freshNote === note.id}
              />
              <p className="mx-auto w-full max-w-[46rem] px-6 text-xs text-muted-foreground">
                {t("updated", { time: formatRelativeTime(note.updatedAt, i18n.language) })} ·{" "}
                {t("words", { count: note.body.trim() ? note.body.trim().split(/\s+/).length : 0 })}
              </p>
              {mode === "edit" ? (
                <div className="min-h-0 flex-1">
                  <EditorPane
                    note={note}
                    editorRef={editor}
                    world={completion}
                    resolves={resolves}
                    onOpenLink={openLink}
                  />
                </div>
              ) : (
                <ScrollArea className="min-h-0 flex-1">
                  <div className="mx-auto max-w-[46rem] px-6 pt-4 pb-24">
                    <NoteReader
                      body={note.body}
                      world={world}
                      vaultId={note.vaultId}
                      onOpenLink={openLink}
                      onTag={(tag) => setQuery(`#${tag}`)}
                    />
                  </div>
                </ScrollArea>
              )}
            </div>
            {details ? (
              <div className="hidden w-72 shrink-0 border-s lg:flex lg:flex-col">
                <NoteDetails
                  note={note}
                  world={world}
                  onOpen={(id) => open(id)}
                  onLinkMention={(other) => {
                    const pattern = new RegExp(
                      `(^|[^\\p{L}\\p{N}\\[])(${note.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})(?![\\p{L}\\p{N}\\]])`,
                      "iu",
                    );
                    void saveNoteBody(
                      other.id,
                      other.body.replace(
                        pattern,
                        (_, lead: string, name: string) =>
                          `${lead}[[${note.title}${name === note.title ? "" : `|${name}`}]]`,
                      ),
                    );
                  }}
                  onHeading={(offset) => {
                    setMode("edit");
                    requestAnimationFrame(() => editor.current?.reveal(offset));
                  }}
                />
              </div>
            ) : null}
          </div>
        ) : (
          <div className="m-auto flex max-w-sm flex-col items-center gap-3 p-6 text-center">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-muted">
              <Icon icon={Note01Icon} size={26} />
            </span>
            <h2 className="text-base font-semibold">
              {listNotes.length ? t("title") : t("empty")}
            </h2>
            <p className="text-sm text-muted-foreground">{t("emptyBody")}</p>
            <div className="flex flex-wrap justify-center gap-2 text-xs text-muted-foreground">
              <span>
                {t("shortcuts.items.newNote")} <kbd dir="ltr">{keyLabel("Mod+N")}</kbd>
              </span>
              <span>
                {t("shortcuts.items.quickSwitcher")} <kbd dir="ltr">{keyLabel("Mod+O")}</kbd>
              </span>
              <span>
                {t("shortcuts.items.graph")} <kbd dir="ltr">{keyLabel("Mod+G")}</kbd>
              </span>
            </div>
            <button
              type="button"
              onClick={() => void newNote()}
              className="mt-1 cursor-pointer rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring"
            >
              {t("new")}
            </button>
          </div>
        )}
      </div>

      <NoteSwitcher
        open={switcher}
        onOpenChange={setSwitcher}
        notes={world.notes}
        vaultLabel={vaultLabel}
        onOpen={(id) => open(id)}
        onCreate={(title) => void newNote(title)}
      />
      <ShortcutsDialog open={shortcuts} onOpenChange={setShortcuts} />
    </div>
  );
}

/** Obsidian's inline title: rename the note where you read its name. */
function NoteTitle({ note, autoFocus }: { note: Note; autoFocus: boolean }) {
  const { t } = useTranslation("notes");
  // Keyed by id and title, so a rename elsewhere starts it afresh.
  const [title, setTitle] = useState(note.title);
  const commit = async () => {
    const wanted = title.trim();
    if (!wanted || wanted === note.title) return setTitle(note.title);
    const got = await renameNote(note.id, wanted);
    setTitle(got);
  };
  return (
    <input
      id="note-title"
      aria-label={t("titleLabel")}
      autoFocus={autoFocus}
      onFocus={(event) => autoFocus && event.currentTarget.select()}
      value={title}
      onChange={(event) => setTitle(event.target.value)}
      onBlur={() => void commit()}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          event.currentTarget.blur();
        } else if (event.key === "Escape") {
          setTitle(note.title);
          event.currentTarget.blur();
        }
      }}
      className="mx-auto w-full max-w-[46rem] bg-transparent px-6 pt-6 text-3xl font-bold tracking-tight outline-none placeholder:text-muted-foreground"
      placeholder={t("untitled")}
    />
  );
}

/** The editor for one note, saving what is typed a moment after typing stops. */
function EditorPane({
  note,
  editorRef,
  world,
  resolves,
  onOpenLink,
}: {
  note: Note;
  editorRef: React.Ref<NoteEditorHandle>;
  world: () => CompletionWorld;
  resolves: (link: NoteLink) => boolean;
  onOpenLink: (link: NoteLink) => void;
}) {
  const { t } = useTranslation("notes");
  const pending = useRef<{ id: string; text: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const next = pending.current;
    pending.current = null;
    if (next) void saveNoteBody(next.id, next.text);
  }, []);

  // Switching notes or leaving the page saves what is waiting.
  useEffect(() => flush, [note.id, flush]);
  useEffect(() => {
    window.addEventListener("beforeunload", flush);
    return () => window.removeEventListener("beforeunload", flush);
  }, [flush]);

  return (
    <NoteEditor
      ref={editorRef}
      docId={note.id}
      value={note.body}
      label={t("editorLabel")}
      placeholder={t("placeholder")}
      world={world}
      resolves={resolves}
      onOpenLink={onOpenLink}
      onChange={(text) => {
        pending.current = { id: note.id, text };
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(flush, 400);
      }}
    />
  );
}
