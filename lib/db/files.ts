import { generateId } from "ai";
import { downloadBlob } from "@/lib/download";
import { useStoreQuery } from "./live";
import { store } from "./store";
import type { VaultFile } from "./types";

/**
 * Loose files in a vault: what the AI makes in a chat or a bot thread (a PDF,
 * a Word document, a spreadsheet) and anything else kept beside notebooks.
 * The row is listed on the Vault page; its bytes are a blob.
 */

export async function listFiles(): Promise<VaultFile[]> {
  return (await store().listFiles()).sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Every file, live and newest first. `undefined` while loading. */
export function useFiles(): VaultFile[] | undefined {
  return useStoreQuery(listFiles, [], ["files"]);
}

/** Keeps a file in a vault and returns its row. */
export async function saveVaultFile(
  data: Blob,
  input: { name: string; vaultId: string; folderId?: string; createdBy: string },
): Promise<VaultFile> {
  const now = Date.now();
  const blobId = generateId();
  await store().putBlob({
    id: blobId,
    // Blobs belong to a notebook; a vault's loose files are kept under the vault.
    notebookId: `vault:${input.vaultId}`,
    mime: data.type || "application/octet-stream",
    data: new Uint8Array(await data.arrayBuffer()),
    createdAt: now,
  });
  const file: VaultFile = {
    id: generateId(),
    vaultId: input.vaultId,
    ...(input.folderId ? { folderId: input.folderId } : {}),
    name: input.name,
    mime: data.type || "application/octet-stream",
    size: data.size,
    blobId,
    createdBy: input.createdBy,
    createdAt: now,
    updatedAt: now,
  };
  await store().putFile(file);
  return file;
}

/** A file's bytes, or null when they are gone. */
export async function loadVaultFile(file: VaultFile): Promise<Blob | null> {
  const row = await store().getBlob(file.blobId);
  return row ? new Blob([row.data as Uint8Array<ArrayBuffer>], { type: file.mime }) : null;
}

export async function renameVaultFile(id: string, name: string) {
  const file = await store().getFile(id);
  if (file) await store().putFile({ ...file, name, updatedAt: Date.now() });
}

export async function moveVaultFile(id: string, folderId: string | undefined) {
  const file = await store().getFile(id);
  if (!file) return;
  const { folderId: _from, ...rest } = file;
  await store().putFile({ ...rest, ...(folderId ? { folderId } : {}), updatedAt: Date.now() });
}

export async function deleteVaultFile(id: string) {
  await store().deleteFile(id);
}

/** Saves a file to the device, the same way every other download in the app does. */
export async function downloadVaultFile(file: VaultFile) {
  const blob = await loadVaultFile(file);
  if (blob) downloadBlob(blob, file.name);
}
