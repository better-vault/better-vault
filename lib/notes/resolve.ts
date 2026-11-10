import type { Note, NoteLink, Notebook, Source, Vault } from "@/lib/db/types";
import { sameName } from "./syntax";

/** What a link may point at, gathered once for a page. */
export interface LinkWorld {
  notes: Note[];
  notebooks: Notebook[];
  sources: Pick<Source, "id" | "notebookId" | "title">[];
  vaults: Vault[];
  /** How a vault is named in links (the default vault has a translated name). */
  vaultName: (vault: Vault) => string;
}

export type LinkTarget =
  | { kind: "note"; note: Note }
  | { kind: "notebook"; notebook: Notebook }
  | { kind: "source"; source: Pick<Source, "id" | "notebookId" | "title"> };

const vaultOfNotebook = (notebook: Notebook) => notebook.vaultId ?? "default";

/**
 * Finds what a link points at, as Obsidian does: by title or alias, case
 * aside. A note in the linking note's own vault wins over one elsewhere;
 * `Vault/Note` names the vault outright. Returns null for a link to nothing
 * yet (pressing it creates the note).
 */
export function resolveLink(
  link: NoteLink,
  world: LinkWorld,
  fromVault: string,
): LinkTarget | null {
  const slash = link.target.indexOf("/");
  let inVault: string | null = null;
  let name = link.target;
  if (slash > 0) {
    const vault = world.vaults.find((each) =>
      sameName(world.vaultName(each), link.target.slice(0, slash)),
    );
    if (vault) {
      inVault = vault.id;
      name = link.target.slice(slash + 1);
    }
  }
  const prefer = <T>(items: T[], vaultOf: (item: T) => string): T | undefined => {
    const scoped = inVault ? items.filter((item) => vaultOf(item) === inVault) : items;
    return scoped.find((item) => vaultOf(item) === fromVault) ?? scoped[0];
  };

  if (link.kind === "notebook") {
    const notebook = prefer(
      world.notebooks.filter((each) => sameName(each.title, name)),
      vaultOfNotebook,
    );
    return notebook ? { kind: "notebook", notebook } : null;
  }
  if (link.kind === "source") {
    const notebookVault = new Map(world.notebooks.map((each) => [each.id, vaultOfNotebook(each)]));
    const source = prefer(
      world.sources.filter((each) => sameName(each.title, name)),
      (each) => notebookVault.get(each.notebookId) ?? "default",
    );
    return source ? { kind: "source", source } : null;
  }
  const matches = world.notes.filter(
    (note) => sameName(note.title, name) || note.aliases.some((alias) => sameName(alias, name)),
  );
  const note = prefer(matches, (each) => each.vaultId);
  return note ? { kind: "note", note } : null;
}

/** The notes whose links point at `note`. */
export function backlinksOf(note: Note, world: LinkWorld): Note[] {
  return world.notes.filter(
    (other) =>
      other.id !== note.id &&
      other.links.some((link) => {
        if (link.kind !== "note") return false;
        const target = resolveLink(link, world, other.vaultId);
        return target?.kind === "note" && target.note.id === note.id;
      }),
  );
}

/** Notes that mention `note`'s title in plain text without linking it. */
export function unlinkedMentionsOf(note: Note, world: LinkWorld): Note[] {
  const linked = new Set(backlinksOf(note, world).map((each) => each.id));
  const names = [note.title, ...note.aliases].filter((name) => name.trim().length > 2);
  if (names.length === 0) return [];
  const pattern = new RegExp(
    `(^|[^\\p{L}\\p{N}\\[])(${names.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})(?![\\p{L}\\p{N}\\]])`,
    "iu",
  );
  return world.notes.filter(
    (other) => other.id !== note.id && !linked.has(other.id) && pattern.test(other.body),
  );
}
