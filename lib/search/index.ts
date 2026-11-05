import MiniSearch, { type SearchResult } from "minisearch";
import { store } from "@/lib/db/store";
import { listVaults } from "@/lib/db/vaults";
import type { Folder, Notebook, Source, StudioOutput, Vault } from "@/lib/db/types";

/**
 * One search index over everything in the app: vaults, folders, notebooks,
 * sources (by title), every passage of every source (the full text, PDFs
 * included) and Studio outputs (title and text). It lives in memory, is built
 * the first time the command palette opens and then follows changes: when
 * sources come and go only their passages are added or removed.
 */

export type HitKind = "vault" | "folder" | "notebook" | "source" | "passage" | "output";

interface Doc {
  id: string;
  kind: HitKind;
  title: string;
  text: string;
  notebookId?: string;
  sourceId?: string;
  chunkId?: string;
  vaultId?: string;
  folderId?: string;
  outputId?: string;
}

export interface Hit extends Omit<Doc, "text"> {
  score: number;
  /** Around the first match, for passages and outputs. */
  snippet?: string;
  /** The words that matched, to mark in the snippet. */
  terms: string[];
}

export interface Catalogue {
  vaults: Vault[];
  folders: Folder[];
  notebooks: Notebook[];
  sources: Pick<Source, "id" | "notebookId" | "title" | "kind">[];
  outputs: StudioOutput[];
}

const options = {
  fields: ["title", "text"],
  storeFields: [
    "kind",
    "title",
    "text",
    "notebookId",
    "sourceId",
    "chunkId",
    "vaultId",
    "folderId",
    "outputId",
  ],
  searchOptions: {
    boost: { title: 3 },
    prefix: true,
    fuzzy: 0.2,
    combineWith: "AND" as const,
  },
};

/** The words of an output's data, so its content can be found too. */
function textOf(value: unknown, out: string[] = [], budget = { left: 6000 }): string[] {
  if (budget.left <= 0) return out;
  if (typeof value === "string") {
    out.push(value);
    budget.left -= value.length;
  } else if (Array.isArray(value)) for (const item of value) textOf(item, out, budget);
  else if (value && typeof value === "object")
    for (const item of Object.values(value)) textOf(item, out, budget);
  return out;
}

function snippetOf(text: string, terms: string[], size = 160): string {
  const lower = text.toLocaleLowerCase();
  let at = -1;
  for (const term of terms) {
    const found = lower.indexOf(term.toLocaleLowerCase());
    if (found >= 0 && (at < 0 || found < at)) at = found;
  }
  const start = Math.max(0, at - size / 3);
  const piece = text
    .slice(start, start + size)
    .replace(/\s+/g, " ")
    .trim();
  return `${start > 0 ? "…" : ""}${piece}${start + size < text.length ? "…" : ""}`;
}

class SearchIndex {
  private mini = new MiniSearch<Doc>(options);
  /** The ids of the documents that are not passages, replaced on every sync. */
  private others = new Set<string>();
  /** Each indexed source's passage ids. */
  private passages = new Map<string, string[]>();
  private queue: Promise<void> = Promise.resolve();
  private listeners = new Set<() => void>();
  ready = false;

  /** Brings the index in line with what is stored. Calls are queued, so they never overlap. */
  sync(catalogue: Catalogue): Promise<void> {
    this.queue = this.queue
      .then(() => this.apply(catalogue))
      .catch((error: unknown) => {
        console.error("Search index", error);
      });
    return this.queue;
  }

  private async apply(catalogue: Catalogue) {
    for (const id of this.others) if (this.mini.has(id)) this.mini.discard(id);
    this.others.clear();
    const notebookVault = new Map(
      catalogue.notebooks.map((notebook) => [notebook.id, notebook.vaultId]),
    );
    const docs: Doc[] = [
      ...catalogue.vaults.map((vault) => ({
        id: `vault:${vault.id}`,
        kind: "vault" as const,
        title: vault.name,
        text: "",
        vaultId: vault.id,
      })),
      ...catalogue.folders.map((folder) => ({
        id: `folder:${folder.id}`,
        kind: "folder" as const,
        title: folder.name,
        text: "",
        folderId: folder.id,
        vaultId: folder.vaultId,
      })),
      ...catalogue.notebooks.map((notebook) => ({
        id: `notebook:${notebook.id}`,
        kind: "notebook" as const,
        title: notebook.title,
        text: "",
        notebookId: notebook.id,
        vaultId: notebook.vaultId,
      })),
      ...catalogue.sources.map((source) => ({
        id: `source:${source.id}`,
        kind: "source" as const,
        title: source.title,
        text: "",
        notebookId: source.notebookId,
        sourceId: source.id,
        vaultId: notebookVault.get(source.notebookId),
      })),
      ...catalogue.outputs
        .filter((output) => output.status === "ready")
        .map((output) => ({
          id: `output:${output.id}`,
          kind: "output" as const,
          title: output.title,
          text: textOf(output.data).join(" "),
          notebookId: output.notebookId,
          outputId: output.id,
          vaultId: notebookVault.get(output.notebookId),
        })),
    ];
    this.mini.addAll(docs);
    for (const doc of docs) this.others.add(doc.id);

    // Passages: only the sources that came or went.
    const now = new Set(catalogue.sources.map((source) => source.id));
    for (const [sourceId, ids] of this.passages) {
      if (now.has(sourceId)) continue;
      for (const id of ids) if (this.mini.has(id)) this.mini.discard(id);
      this.passages.delete(sourceId);
    }
    const added = catalogue.sources.filter((source) => !this.passages.has(source.id));
    for (let at = 0; at < added.length; at += 20) {
      const batch = added.slice(at, at + 20);
      const chunks = await store().getChunks(batch.map((source) => source.id));
      const bySource = new Map(batch.map((source) => [source.id, source]));
      const passageDocs: Doc[] = chunks.map((chunk) => ({
        id: `passage:${chunk.id}`,
        kind: "passage",
        title: bySource.get(chunk.sourceId)?.title ?? "",
        text: chunk.text,
        notebookId: chunk.notebookId,
        sourceId: chunk.sourceId,
        chunkId: chunk.id,
        vaultId: notebookVault.get(chunk.notebookId),
      }));
      await this.mini.addAllAsync(passageDocs, { chunkSize: 200 });
      for (const source of batch)
        this.passages.set(
          source.id,
          passageDocs.filter((doc) => doc.sourceId === source.id).map((doc) => doc.id),
        );
    }
    this.ready = true;
    for (const listener of this.listeners) listener();
  }

  /** Results by score, at most `limit` of each kind. */
  search(query: string, limit = 6): Hit[] {
    if (!query.trim()) return [];
    const results = this.mini.search(query) as (SearchResult & Doc)[];
    const taken = new Map<HitKind, number>();
    const hits: Hit[] = [];
    for (const result of results) {
      const count = taken.get(result.kind) ?? 0;
      if (count >= limit) continue;
      taken.set(result.kind, count + 1);
      const { text, ...doc } = result;
      hits.push({
        ...doc,
        id: result.id as string,
        score: result.score,
        terms: result.terms,
        snippet:
          result.kind === "passage" || (result.kind === "output" && text)
            ? snippetOf(text, result.terms)
            : undefined,
      });
    }
    return hits;
  }

  /** Called whenever an update finishes. Returns an unsubscribe. */
  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export const searchIndex = new SearchIndex();

/** What the index is built from, read fresh. Source texts are left out: passages carry them. */
export async function readCatalogue(): Promise<Catalogue> {
  const [vaults, folders, notebooks, sources, outputs] = await Promise.all([
    listVaults(),
    store().listFolders(),
    store().listNotebooks(),
    store().listAllSources(),
    store().listAllOutputs(),
  ]);
  return {
    vaults,
    folders,
    notebooks,
    sources: sources.map(({ id, notebookId, title, kind }) => ({ id, notebookId, title, kind })),
    outputs,
  };
}
