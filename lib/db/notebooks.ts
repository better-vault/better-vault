import { generateId } from "ai";
import { useStoreQuery } from "./live";
import { store } from "./store";
import type { Notebook } from "./types";

export async function createNotebook(title: string): Promise<string> {
  const now = Date.now();
  const id = generateId();
  await store().addNotebook({ id, title, createdAt: now, updatedAt: now });
  return id;
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
