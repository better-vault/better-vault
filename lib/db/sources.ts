import { generateId } from "ai";
import { chunkText, normaliseText } from "@/lib/grounding/chunk";
import { useStoreQuery } from "./live";
import { store } from "./store";
import type { Chunk, Source, SourceKind } from "./types";

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
  await store().addSource(source, chunks, Date.now());
  return source;
}

export async function setSourceSelected(id: string, selected: boolean) {
  await store().patchSource(id, { selected });
}

export async function setAllSourcesSelected(notebookId: string, selected: boolean) {
  await store().patchNotebookSources(notebookId, { selected });
}

export async function renameSource(id: string, title: string) {
  await store().patchSource(id, { title });
}

export async function deleteSource(id: string) {
  await store().deleteSource(id);
}

/** A notebook's sources, oldest first. `undefined` while loading. */
export function useSources(notebookId: string): Source[] | undefined {
  return useStoreQuery(() => store().listSources(notebookId), [notebookId], ["sources"]);
}

/** The passages of the given sources, in reading order. */
export async function getChunks(sourceIds: readonly string[]): Promise<Chunk[]> {
  const chunks = await store().getChunks([...sourceIds]);
  const order = new Map(sourceIds.map((id, at) => [id, at]));
  return chunks.sort(
    (a, b) => (order.get(a.sourceId) ?? 0) - (order.get(b.sourceId) ?? 0) || a.index - b.index,
  );
}

/** A notebook's sources, oldest first. */
export function listSources(notebookId: string): Promise<Source[]> {
  return store().listSources(notebookId);
}

/** The sources that still exist among `ids`, in that order. */
export function getSources(ids: readonly string[]): Promise<Source[]> {
  return store().getSources([...ids]);
}

/** One source, live, with its passages in reading order. `undefined` while loading. */
export function useSourceWithChunks(
  id: string,
): { source: Source | undefined; chunks: Chunk[] } | undefined {
  return useStoreQuery(
    async () => ({ source: await store().getSource(id), chunks: await getChunks([id]) }),
    [id],
    ["sources", "chunks"],
  );
}
