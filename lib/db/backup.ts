import { z } from "zod";
import { chunkText } from "@/lib/grounding/chunk";
import { conversationTitle } from "@/lib/chat/title";
import { store } from "./store";
import type {
  Chunk,
  Conversation,
  Folder,
  Notebook,
  Source,
  StoredBlob,
  StoredMessage,
  StudioOutput,
  Vault,
  CalendarEntry,
  Note,
  Skill,
} from "./types";

/** A stored file in a backup: its bytes as base64, since backups are JSON. */
export type BackupBlob = Omit<StoredBlob, "data"> & { data: string };

/**
 * A backup holds folders, notebooks, sources, chats, Studio outputs and their
 * files. It never holds settings, so API keys are not written into a file
 * that might be shared.
 */
export interface Backup {
  app: "better-vault";
  /**
   * 6 adds notes and skills; 5 added calendar entries; 4 added vaults; 3 added folders and files; 2
   * added conversations. Older backups still import: format 1 (one chat per
   * notebook), format 2 (no folders), format 3 (no vaults: everything is in
   * the default vault), format 4 (no calendar) and format 5 (no notes or skills).
   */
  format: 6;
  exportedAt: number;
  calendar: CalendarEntry[];
  vaults: Vault[];
  notes: Note[];
  skills: Skill[];
  folders: Folder[];
  notebooks: Notebook[];
  sources: Source[];
  conversations: Conversation[];
  messages: StoredMessage[];
  outputs: StudioOutput[];
  blobs: BackupBlob[];
}

const backupSchema = z.object({
  app: z.literal("better-vault"),
  format: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
    z.literal(6),
  ]),
  notes: z
    .array(z.object({ id: z.string(), vaultId: z.string(), body: z.string() }).loose())
    .optional(),
  skills: z
    .array(z.object({ id: z.string(), vaultId: z.string(), name: z.string() }).loose())
    .optional(),
  calendar: z
    .array(
      z.object({ id: z.string(), title: z.string(), start: z.string(), end: z.string() }).loose(),
    )
    .optional(),
  exportedAt: z.number(),
  vaults: z.array(z.object({ id: z.string(), name: z.string() }).loose()).optional(),
  folders: z.array(z.object({ id: z.string(), name: z.string() }).loose()).optional(),
  notebooks: z.array(z.object({ id: z.string(), title: z.string() }).loose()),
  sources: z.array(z.object({ id: z.string(), notebookId: z.string(), text: z.string() }).loose()),
  conversations: z.array(z.object({ id: z.string(), notebookId: z.string() }).loose()).optional(),
  messages: z.array(z.object({ id: z.string(), notebookId: z.string() }).loose()),
  outputs: z.array(z.object({ id: z.string(), notebookId: z.string() }).loose()),
  blobs: z
    .array(
      z
        .object({ id: z.string(), notebookId: z.string(), mime: z.string(), data: z.string() })
        .loose(),
    )
    .optional(),
});

export async function exportBackup(): Promise<Backup> {
  const { blobs, ...content } = await store().exportAll();
  return {
    app: "better-vault",
    format: 6,
    exportedAt: Date.now(),
    ...content,
    blobs: blobs.map((blob) => ({ ...blob, data: toBase64(blob.data) })),
  };
}

/** Adds the backup's content, replacing items with the same id. Returns how many notebooks it held. */
export async function importBackup(raw: unknown): Promise<number> {
  const parsed = backupSchema.safeParse(raw);
  if (!parsed.success) throw new Error("invalid-backup");
  const backup = upgradeBackup(parsed.data as unknown as OldBackup);
  const chunks: Chunk[] = backup.sources.flatMap((source) =>
    chunkText(source.text).map((text, index) => ({
      id: `${source.id}:${index}`,
      notebookId: source.notebookId,
      sourceId: source.id,
      index,
      text,
    })),
  );
  await store().importAll(
    {
      calendar: backup.calendar,
      vaults: backup.vaults,
      notes: backup.notes,
      skills: backup.skills,
      folders: backup.folders,
      notebooks: backup.notebooks,
      sources: backup.sources,
      conversations: backup.conversations,
      messages: backup.messages,
      outputs: backup.outputs,
      blobs: backup.blobs.map((blob) => ({ ...blob, data: fromBase64(blob.data) })),
    },
    chunks,
  );
  return backup.notebooks.length;
}

type OldBackup = Omit<
  Backup,
  "format" | "conversations" | "folders" | "blobs" | "vaults" | "calendar" | "notes" | "skills"
> & {
  format: 1 | 2 | 3 | 4 | 5 | 6;
  notes?: Note[];
  skills?: Skill[];
  calendar?: CalendarEntry[];
  vaults?: Vault[];
  conversations?: Conversation[];
  folders?: Folder[];
  blobs?: BackupBlob[];
};

/**
 * Brings an older backup up to date: in format 1 each notebook's single chat
 * becomes a conversation with the notebook's id, as the database upgrade
 * does; before format 3 there are no folders or files, before 4 no vaults.
 */
function upgradeBackup(backup: OldBackup): Backup {
  const messages = backup.messages.map((row) => ({
    ...row,
    conversationId: row.conversationId ?? row.notebookId,
  }));
  const conversations = [...(backup.conversations ?? [])];
  const known = new Set(conversations.map((conversation) => conversation.id));
  const orphans = new Map<string, StoredMessage[]>();
  for (const row of messages) {
    if (!known.has(row.conversationId))
      orphans.set(row.conversationId, [...(orphans.get(row.conversationId) ?? []), row]);
  }
  for (const [id, rows] of orphans) {
    const sorted = [...rows].sort((a, b) => a.createdAt - b.createdAt);
    conversations.push({
      id,
      notebookId: sorted[0].notebookId,
      title: conversationTitle(sorted.map((row) => row.message)),
      createdAt: sorted[0].createdAt,
      updatedAt: sorted[sorted.length - 1].createdAt,
    });
  }
  return {
    ...backup,
    format: 6,
    calendar: backup.calendar ?? [],
    notes: backup.notes ?? [],
    skills: backup.skills ?? [],
    vaults: backup.vaults ?? [],
    conversations,
    messages,
    folders: backup.folders ?? [],
    blobs: backup.blobs ?? [],
  };
}

/** Deletes every notebook, note, skill, source, chat and output. Settings and keys are kept. */
export async function deleteAllData() {
  await store().clearAll();
}

function toBase64(bytes: Uint8Array): string {
  let text = "";
  for (let at = 0; at < bytes.length; at += 0x8000)
    text += String.fromCharCode(...bytes.subarray(at, at + 0x8000));
  return btoa(text);
}

function fromBase64(text: string): Uint8Array {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let at = 0; at < binary.length; at++) bytes[at] = binary.charCodeAt(at);
  return bytes;
}
