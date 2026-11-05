import { generateId } from "ai";
import { useStoreQuery } from "./live";
import { store } from "./store";
import type { Notebook } from "./types";

/** The choices of the new-notebook dialog. */
export type NotebookLook = Partial<Pick<Notebook, "icon" | "color" | "folderId" | "vaultId">>;

export async function createNotebook(title: string, look: NotebookLook = {}): Promise<string> {
  const now = Date.now();
  const id = generateId();
  const extra = Object.fromEntries(Object.entries(look).filter(([, value]) => value != null));
  await store().addNotebook({ id, title, ...extra, createdAt: now, updatedAt: now });
  return id;
}

/** Pins a notebook to the top of its vault's sidebar, or unpins it. */
export async function pinNotebook(id: string, pinned: boolean) {
  await store().patchNotebook(id, { pinned: pinned || undefined });
}

/** Changes a notebook's icon, colour or folder. Moving it does not change its place in "recent". */
export async function updateNotebook(id: string, patch: NotebookLook) {
  await store().patchNotebook(id, patch);
}

export async function renameNotebook(id: string, title: string) {
  await store().patchNotebook(id, { title, updatedAt: Date.now() });
}

/** Moves a notebook to the top of the list after something in it changed. */
export async function touchNotebook(id: string) {
  await store().patchNotebook(id, { updatedAt: Date.now() });
}

/** Deletes a notebook with its sources, chats and Studio outputs. */
export async function deleteNotebook(id: string) {
  await store().deleteNotebook(id);
}

/** All notebooks, most recently changed first. `undefined` while loading. */
export function useNotebooks(): Notebook[] | undefined {
  return useStoreQuery(() => store().listNotebooks(), [], ["notebooks"]);
}

/** One notebook; `null` when it does not exist, `undefined` while loading. */
export function useNotebook(id: string): Notebook | null | undefined {
  return useStoreQuery(async () => (await store().getNotebook(id)) ?? null, [id], ["notebooks"]);
}

/** How many sources each notebook has, for the notebook cards. */
export function useNotebookCounts(): Map<string, { sources: number }> | undefined {
  return useStoreQuery(
    async () => {
      const counts = await store().countSources();
      return new Map(Object.entries(counts).map(([id, sources]) => [id, { sources }]));
    },
    [],
    ["sources"],
  );
}
