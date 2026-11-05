import { generateId } from "ai";
import { useStoreQuery } from "./live";
import { store } from "./store";
import type { Folder } from "./types";

export async function createFolder(
  name: string,
  parentId: string | null,
  color?: string,
  vaultId?: string,
): Promise<string> {
  const now = Date.now();
  const id = generateId();
  await store().addFolder({
    id,
    name,
    parentId,
    ...(color ? { color } : {}),
    ...(vaultId && vaultId !== "default" ? { vaultId } : {}),
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

export async function updateFolder(id: string, patch: Partial<Pick<Folder, "name" | "color">>) {
  await store().patchFolder(id, { ...patch, updatedAt: Date.now() });
}

/**
 * Moves a folder into another one, or to the top level. A folder can't go
 * into itself or one of its own folders; those moves are ignored.
 */
export async function moveFolder(id: string, parentId: string | null, folders: Folder[]) {
  if (
    parentId &&
    (parentId === id || ancestors(parentId, folders).some((folder) => folder.id === id))
  )
    return;
  await store().patchFolder(id, { parentId, updatedAt: Date.now() });
}

/** Deletes a folder; the folders and notebooks in it move up a level. */
export async function deleteFolder(id: string) {
  await store().deleteFolder(id);
}

/** Every folder, by name. `undefined` while loading. */
export function useFolders(): Folder[] | undefined {
  return useStoreQuery(
    async () => (await store().listFolders()).sort((a, b) => a.name.localeCompare(b.name)),
    [],
    ["folders"],
  );
}

/** The folders above `id`, from the top level down, ending with the folder itself. */
export function ancestors(id: string | null, folders: Folder[]): Folder[] {
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  const path: Folder[] = [];
  const seen = new Set<string>();
  for (
    let at = id ? byId.get(id) : undefined;
    at && !seen.has(at.id);
    at = at.parentId ? byId.get(at.parentId) : undefined
  ) {
    seen.add(at.id);
    path.unshift(at);
  }
  return path;
}
