import { saveVaultFile } from "@/lib/db/files";
import { store } from "@/lib/db/store";
import { buildFile, FileBuildError } from "./build";
import type { CreateFileInput, CreateFileOutput } from "./tools";

/**
 * Runs `create_file` once the user has approved it: builds the file and keeps
 * it in the vault, in the folder the model named when that folder exists.
 */
export async function createFileFromTool(
  input: CreateFileInput,
  { vaultId, createdBy }: { vaultId: string; createdBy: string },
): Promise<CreateFileOutput> {
  try {
    const { blob, name } = await buildFile(input);
    const wanted = input.folder?.trim().toLowerCase();
    const folder = wanted
      ? (await store().listFolders()).find(
          (each) =>
            (each.vaultId ?? "default") === vaultId && each.name.trim().toLowerCase() === wanted,
        )
      : undefined;
    const file = await saveVaultFile(blob, {
      name,
      vaultId,
      ...(folder ? { folderId: folder.id } : {}),
      createdBy,
    });
    return { ok: true, fileId: file.id, name: file.name, size: file.size };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof FileBuildError
          ? error.reason === "empty"
            ? `Nothing to write: fill the field for ${input.format}.`
            : "The json field is not valid JSON."
          : error instanceof Error
            ? error.message
            : String(error),
    };
  }
}
