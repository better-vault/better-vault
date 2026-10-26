import { generateId } from "ai";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type Notebook } from "./database";

export async function createNotebook(title: string): Promise<string> {
  const now = Date.now();
  const id = generateId();
  await db.notebooks.add({ id, title, createdAt: now, updatedAt: now });
  return id;
}

export async function renameNotebook(id: string, title: string) {
  await db.notebooks.update(id, { title, updatedAt: Date.now() });
}

/** Moves a notebook to the top of the list after something in it changed. */
export async function touchNotebook(id: string) {
  await db.notebooks.update(id, { updatedAt: Date.now() });
}

/** Deletes a notebook with its sources, chats and Studio outputs. */
export async function deleteNotebook(id: string) {
  await db.transaction(
    "rw",
    [db.notebooks, db.sources, db.chunks, db.messages, db.conversations, db.outputs],
    async () => {
      await db.sources.where("notebookId").equals(id).delete();
      await db.chunks.where("notebookId").equals(id).delete();
      await db.messages.where("notebookId").equals(id).delete();
      await db.conversations.where("notebookId").equals(id).delete();
      await db.outputs.where("notebookId").equals(id).delete();
      await db.notebooks.delete(id);
    },
  );
}

/** All notebooks, most recently changed first. `undefined` while loading. */
export function useNotebooks(): Notebook[] | undefined {
  return useLiveQuery(() => db.notebooks.orderBy("updatedAt").reverse().toArray(), []);
}

/** One notebook; `null` when it does not exist, `undefined` while loading. */
export function useNotebook(id: string): Notebook | null | undefined {
  return useLiveQuery(async () => (await db.notebooks.get(id)) ?? null, [id]);
}

/** How many sources and outputs each notebook has, for the notebook cards. */
export function useNotebookCounts(): Map<string, { sources: number }> | undefined {
  return useLiveQuery(async () => {
    const counts = new Map<string, { sources: number }>();
    await db.sources.each((source) => {
      const entry = counts.get(source.notebookId) ?? { sources: 0 };
      entry.sources += 1;
      counts.set(source.notebookId, entry);
    });
    return counts;
  }, []);
}
