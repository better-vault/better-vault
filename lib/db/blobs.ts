import { generateId } from "ai";
import { store } from "./store";

/** Keeps a file with a notebook (and an output). Returns its id. */
export async function saveBlob(input: {
  notebookId: string;
  outputId?: string;
  mime: string;
  data: Uint8Array;
}): Promise<string> {
  const id = generateId();
  await store().putBlob({ id, ...input, createdAt: Date.now() });
  return id;
}

/** A stored file as a `Blob`, or null when it is gone. */
export async function loadBlob(id: string): Promise<Blob | null> {
  const row = await store().getBlob(id);
  return row ? new Blob([row.data as Uint8Array<ArrayBuffer>], { type: row.mime }) : null;
}
