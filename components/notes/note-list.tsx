import {
  Add01Icon,
  ArrowDown01Icon,
  ArrowRight01Icon,
  FileImportIcon,
  Folder01Icon,
  Note01Icon,
  PinIcon,
  Search01Icon,
  Tag01Icon,
} from "@hugeicons/core-free-icons";
import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { MenuActions } from "@/components/common/action-menu";
import { ContextMenu, ContextMenuTrigger } from "@/components/common/context-menu";
import { Icon } from "@/components/icon";
import { Input } from "@/components/panelui/input";
import { Menu } from "@/components/panelui/menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Note, Vault } from "@/lib/db/types";
import { cn } from "@/lib/utils";
import { useNoteActions } from "./note-actions";

interface NoteListProps {
  /** The panel's title. */
  title: string;
  /** Shown under the search, such as which notebook's notes these are. */
  banner?: React.ReactNode;
  notes: Note[];
  vaults: Vault[];
  activeId: string | null;
  query: string;
  onQuery: (query: string) => void;
  onOpen: (id: string, newTab?: boolean) => void;
  onCreate: () => void;
  onImport: (files: File[]) => void;
  onDeleted: (id: string) => void;
  /** The search field, focused by ⇧⌘F. */
  searchRef?: React.Ref<HTMLInputElement>;
}

/** Notes that match a search: every word in the title, the text or a tag. */
export function matchNotes(notes: Note[], query: string): Note[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return notes;
  return notes.filter((note) => {
    const haystack =
      `${note.title}\n${note.body}\n${note.tags.map((tag) => `#${tag}`).join(" ")}`.toLowerCase();
    return words.every((word) => haystack.includes(word));
  });
}

/** The notes panel: search, pinned notes, folders and the tags in use. */
export function NoteList({
  title,
  banner,
  notes,
  vaults,
  activeId,
  query,
  onQuery,
  onOpen,
  onCreate,
  onImport,
  onDeleted,
  searchRef,
}: NoteListProps) {
  const { t } = useTranslation("notes");
  const importInput = useRef<HTMLInputElement>(null);
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const shown = useMemo(() => matchNotes(notes, query), [notes, query]);
  const pinned = shown.filter((note) => note.pinned);
  const folders = useMemo(() => {
    const byFolder = new Map<string, Note[]>();
    for (const note of shown) {
      if (note.pinned) continue;
      byFolder.set(note.folder, [...(byFolder.get(note.folder) ?? []), note]);
    }
    for (const list of byFolder.values()) list.sort((a, b) => a.title.localeCompare(b.title));
    return [...byFolder.entries()].sort(([a], [b]) =>
      a === "" ? 1 : b === "" ? -1 : a.localeCompare(b),
    );
  }, [shown]);
  const tags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const note of notes)
      for (const tag of note.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [notes]);

  const row = (note: Note) => (
    <NoteRow
      key={note.id}
      note={note}
      vaults={vaults}
      active={note.id === activeId}
      onOpen={onOpen}
      onDeleted={() => onDeleted(note.id)}
    />
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* The panel's head: its title, then import and a new note. */}
      <div className="flex h-14 shrink-0 items-center gap-1 border-b ps-4 pe-3">
        <h2 className="min-w-0 flex-1 truncate text-base font-semibold">{title}</h2>
        <button
          type="button"
          onClick={() => importInput.current?.click()}
          aria-label={t("actions.import")}
          title={t("actions.import")}
          className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Icon icon={FileImportIcon} size={17} />
        </button>
        <button
          type="button"
          onClick={onCreate}
          aria-label={t("new")}
          title={t("new")}
          className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full bg-foreground text-background outline-none hover:bg-foreground/85 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
        >
          <Icon icon={Add01Icon} size={17} />
        </button>
      </div>
      <div className="border-b p-3">
        <Input.Group size="sm">
          <Input.Addon>
            <Icon icon={Search01Icon} size={14} />
          </Input.Addon>
          <Input
            ref={searchRef}
            size="sm"
            type="search"
            aria-label={t("search")}
            placeholder={t("search")}
            value={query}
            onChange={(event) => onQuery(event.target.value)}
          />
        </Input.Group>
        {banner ? <div className="mt-2">{banner}</div> : null}
        <input
          ref={importInput}
          type="file"
          multiple
          accept=".md,.markdown,.txt,text/markdown,text/plain"
          className="hidden"
          onChange={(event) => {
            const files = [...(event.target.files ?? [])];
            event.target.value = "";
            if (files.length) onImport(files);
          }}
        />
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <nav aria-label={t("title")} className="flex flex-col gap-3 px-2 py-3">
          {notes.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">{t("empty")}</p>
          ) : shown.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">
              {t("noMatches", { query })}
            </p>
          ) : null}
          {pinned.length > 0 ? (
            <section className="flex flex-col gap-0.5">
              <h3 className="flex items-center gap-1.5 px-2 pb-0.5 text-xs font-medium text-muted-foreground">
                <Icon icon={PinIcon} size={12} />
                {t("pinned")}
              </h3>
              {pinned.map(row)}
            </section>
          ) : null}
          {folders.map(([folder, list]) =>
            folder === "" ? (
              <section key="" className="flex flex-col gap-0.5">
                {list.map(row)}
              </section>
            ) : (
              <section key={folder} className="flex flex-col gap-0.5">
                <button
                  type="button"
                  aria-expanded={!closed.has(folder)}
                  onClick={() =>
                    setClosed((current) => {
                      const next = new Set(current);
                      if (next.has(folder)) next.delete(folder);
                      else next.add(folder);
                      return next;
                    })
                  }
                  className="flex h-7 cursor-pointer items-center gap-1.5 rounded-lg px-2 text-start text-xs font-medium text-muted-foreground outline-none hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Icon
                    icon={closed.has(folder) ? ArrowRight01Icon : ArrowDown01Icon}
                    size={12}
                    className={closed.has(folder) ? "rtl:rotate-180" : undefined}
                  />
                  <Icon icon={Folder01Icon} size={14} />
                  <span className="truncate">{folder}</span>
                </button>
                {closed.has(folder) ? null : (
                  <div className="flex flex-col gap-0.5 ps-3">{list.map(row)}</div>
                )}
              </section>
            ),
          )}

          <section className="flex flex-col gap-1 border-t pt-3">
            <h3 className="flex items-center gap-1.5 px-2 text-xs font-medium text-muted-foreground">
              <Icon icon={Tag01Icon} size={12} />
              {t("tags")}
            </h3>
            {tags.length === 0 ? (
              <p className="px-2 text-xs text-muted-foreground">{t("noTags")}</p>
            ) : (
              <div className="flex flex-wrap gap-1 px-1.5">
                {tags.map(([tag, count]) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => onQuery(query === `#${tag}` ? "" : `#${tag}`)}
                    className={cn(
                      "cursor-pointer rounded-full px-2 py-0.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      query === `#${tag}`
                        ? "bg-primary text-primary-foreground"
                        : "bg-primary/10 text-primary hover:bg-primary/20",
                    )}
                  >
                    #{tag} <span className="opacity-60">{count}</span>
                  </button>
                ))}
              </div>
            )}
          </section>
        </nav>
      </ScrollArea>
    </div>
  );
}

function NoteRow({
  note,
  vaults,
  active,
  onOpen,
  onDeleted,
}: {
  note: Note;
  vaults: Vault[];
  active: boolean;
  onOpen: (id: string, newTab?: boolean) => void;
  onDeleted: () => void;
}) {
  const { actions, dialogs } = useNoteActions(note, vaults, {
    onOpenTab: () => onOpen(note.id, true),
    onDeleted,
  });
  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger
          render={
            <button
              type="button"
              aria-current={active ? "page" : undefined}
              onClick={(event) => onOpen(note.id, event.metaKey || event.ctrlKey)}
              className={cn(
                "flex h-8 w-full min-w-0 cursor-pointer items-center gap-2 rounded-lg px-2 text-start text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active ? "bg-foreground/10 font-medium" : "hover:bg-accent/60",
              )}
            />
          }
        >
          <Icon icon={Note01Icon} size={15} className="shrink-0 text-muted-foreground" />
          <span className="min-w-0 truncate">{note.title}</span>
        </ContextMenuTrigger>
        <Menu.Content sideOffset={0}>
          <MenuActions actions={actions} />
        </Menu.Content>
      </ContextMenu>
      {dialogs}
    </>
  );
}
