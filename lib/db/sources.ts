import { generateId } from "ai";
import { useLiveQuery } from "dexie-react-hooks";
import { chunkText, normaliseText } from "@/lib/grounding/chunk";
import { db, type Chunk, type Source, type SourceKind } from "./database";

export interface NewSource {
  notebookId: string;
  title: string;
  kind: SourceKind;
  text: string;
  url?: string;
  fileName?: string;
}

/** Adds a source and splits it into passages. Throws if it has no text. */
export async function addSource(input: NewSource): Promise<Source> {
  const text = normaliseText(input.text);
  if (!text) throw new Error("empty-source");
  const source: Source = {
    id: generateId(),
    notebookId: input.notebookId,
    title: input.title.trim() || "Untitled",
    kind: input.kind,
    url: input.url,
    fileName: input.fileName,
    text,
    charCount: text.length,
    selected: true,
    createdAt: Date.now(),
  };
  const chunks: Chunk[] = chunkText(text).map((piece, index) => ({
    id: `${source.id}:${index}`,
    notebookId: source.notebookId,
    sourceId: source.id,
    index,
    text: piece,
  }));
  await db.transaction("rw", [db.sources, db.chunks, db.notebooks], async () => {
    await db.sources.add(source);
    await db.chunks.bulkAdd(chunks);
    await db.notebooks.update(source.notebookId, { updatedAt: Date.now() });
  });
  return source;
}

export async function setSourceSelected(id: string, selected: boolean) {
  await db.sources.update(id, { selected });
}

export async function setAllSourcesSelected(notebookId: string, selected: boolean) {
  await db.sources.where("notebookId").equals(notebookId).modify({ selected });
}

export async function renameSource(id: string, title: string) {
  await db.sources.update(id, { title });
}

export async function deleteSource(id: string) {
  await db.transaction("rw", [db.sources, db.chunks], async () => {
    await db.chunks.where("sourceId").equals(id).delete();
    await db.sources.delete(id);
  });
}

/** A notebook's sources, oldest first. `undefined` while loading. */
export function useSources(notebookId: string): Source[] | undefined {
  return useLiveQuery(
    () => db.sources.where("notebookId").equals(notebookId).sortBy("createdAt"),
    [notebookId],
  );
}

/** The passages of the given sources, in reading order. */
export async function getChunks(sourceIds: readonly string[]): Promise<Chunk[]> {
  const chunks = await db.chunks.where("sourceId").anyOf([...sourceIds]).toArray();
  const order = new Map(sourceIds.map((id, at) => [id, at]));
  return chunks.sort(
    (a, b) => (order.get(a.sourceId) ?? 0) - (order.get(b.sourceId) ?? 0) || a.index - b.index,
  );
}
