import { generateId } from "ai";
import { analyse, renameLinks, sameName } from "@/lib/notes/syntax";
import { useStoreQuery } from "./live";
import { store } from "./store";
import type { Note } from "./types";

/** Every note of every vault, the most recently changed first. */
export async function listNotes(): Promise<Note[]> {
  return (await store().listNotes()).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function useNotes(): Note[] | undefined {
  return useStoreQuery(listNotes, [], ["notes"]);
}

export function useNote(id: string | null | undefined): Note | null | undefined {
  return useStoreQuery(
    async () => (id ? ((await store().getNote(id)) ?? null) : null),
    [id],
    ["notes"],
  );
}

/** A title no other note in the vault has: "Untitled", then "Untitled 1", … */
export function freeTitle(wanted: string, vaultId: string, notes: Note[], except?: string): string {
  const base = wanted.trim() || "Untitled";
  const taken = (title: string) =>
    notes.some(
      (note) => note.id !== except && note.vaultId === vaultId && sameName(note.title, title),
    );
  if (!taken(base)) return base;
  for (let n = 1; ; n++) if (!taken(`${base} ${n}`)) return `${base} ${n}`;
}

/** Characters a note title can't hold, because they mean something inside `[[…]]`. */
export const cleanTitle = (title: string) =>
  title
    .replace(/[[\]|#^\\/:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export async function createNote({
  vaultId,
  title = "",
  body = "",
  folder = "",
  notebookId = null,
}: {
  vaultId: string;
  title?: string;
  body?: string;
  folder?: string;
  notebookId?: string | null;
}): Promise<Note> {
  const notes = await store().listNotes();
  const now = Date.now();
  const note: Note = {
    id: generateId(),
    vaultId,
    title: freeTitle(cleanTitle(title), vaultId, notes),
    body,
    folder,
    notebookId,
    ...analyse(body),
    createdAt: now,
    updatedAt: now,
  };
  await store().putNote(note);
  return note;
}

/** Saves a note's text, reading its tags, aliases and links again. */
export async function saveNoteBody(id: string, body: string): Promise<void> {
  const note = await store().getNote(id);
  if (!note || note.body === body) return;
  await store().putNote({ ...note, body, ...analyse(body), updatedAt: Date.now() });
}

export async function updateNote(
  id: string,
  patch: Partial<Pick<Note, "folder" | "pinned" | "vaultId" | "notebookId">>,
): Promise<void> {
  const note = await store().getNote(id);
  if (!note) return;
  await store().putNote({ ...note, ...patch, updatedAt: Date.now() });
}

/**
 * Renames a note and rewrites every link to it, in every vault, so nothing
 * breaks (Obsidian's "Automatically update internal links"). Returns the
 * title it got, which differs when another note in the vault had it.
 */
export async function renameNote(id: string, wanted: string): Promise<string> {
  const notes = await store().listNotes();
  const note = notes.find((each) => each.id === id);
  if (!note) return wanted;
  const title = freeTitle(cleanTitle(wanted), note.vaultId, notes, id);
  if (title === note.title) return title;
  const now = Date.now();
  const changed: Note[] = [{ ...note, title, updatedAt: now }];
  // A vault with its own note of the old name keeps its plain links to that one.
  const shadowed = new Set(
    notes
      .filter((each) => each.id !== id && sameName(each.title, note.title))
      .map((each) => each.vaultId),
  );
  for (const other of notes) {
    if (other.id === id) continue;
    if (other.vaultId !== note.vaultId && shadowed.has(other.vaultId)) continue;
    const body = renameLinks(other.body, note.title, title);
    if (body !== other.body) changed.push({ ...other, body, ...analyse(body), updatedAt: now });
  }
  await store().putNotes(changed);
  return title;
}

export async function deleteNote(id: string): Promise<void> {
  await store().deleteNote(id);
}
