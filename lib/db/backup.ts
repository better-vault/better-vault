import { z } from "zod";
import { chunkText } from "@/lib/grounding/chunk";
import { conversationTitle } from "@/lib/chat/title";
import {
  db,
  type Chunk,
  type Conversation,
  type Notebook,
  type Source,
  type StoredMessage,
  type StudioOutput,
} from "./database";

/**
 * A backup holds notebooks, sources, chats and Studio outputs. It never holds
 * settings, so API keys are not written into a file that might be shared.
 */
export interface Backup {
  app: "better-vault";
  /** 2 adds conversations. Format 1 backups (one chat per notebook) still import. */
  format: 2;
  exportedAt: number;
  notebooks: Notebook[];
  sources: Source[];
  conversations: Conversation[];
  messages: StoredMessage[];
  outputs: StudioOutput[];
}

const backupSchema = z.object({
  app: z.literal("better-vault"),
  format: z.union([z.literal(1), z.literal(2)]),
  exportedAt: z.number(),
  notebooks: z.array(z.object({ id: z.string(), title: z.string() }).loose()),
  sources: z.array(z.object({ id: z.string(), notebookId: z.string(), text: z.string() }).loose()),
  conversations: z.array(z.object({ id: z.string(), notebookId: z.string() }).loose()).optional(),
  messages: z.array(z.object({ id: z.string(), notebookId: z.string() }).loose()),
  outputs: z.array(z.object({ id: z.string(), notebookId: z.string() }).loose()),
});

export async function exportBackup(): Promise<Backup> {
  const [notebooks, sources, conversations, messages, outputs] = await Promise.all([
    db.notebooks.toArray(),
    db.sources.toArray(),
    db.conversations.toArray(),
    db.messages.toArray(),
    db.outputs.toArray(),
  ]);
  return {
    app: "better-vault",
    format: 2,
    exportedAt: Date.now(),
    notebooks,
    sources,
    conversations,
    messages,
    outputs,
  };
}

/** Adds the backup's content, replacing items with the same id. Returns how many notebooks it held. */
export async function importBackup(raw: unknown): Promise<number> {
  const parsed = backupSchema.safeParse(raw);
  if (!parsed.success) throw new Error("invalid-backup");
  const backup = upgradeBackup(
    parsed.data as unknown as Omit<Backup, "format" | "conversations"> & {
      format: 1 | 2;
      conversations?: Conversation[];
    },
  );
  const chunks: Chunk[] = backup.sources.flatMap((source) =>
    chunkText(source.text).map((text, index) => ({
      id: `${source.id}:${index}`,
      notebookId: source.notebookId,
      sourceId: source.id,
      index,
      text,
    })),
  );
  await db.transaction(
    "rw",
    [db.notebooks, db.sources, db.chunks, db.conversations, db.messages, db.outputs],
    async () => {
      await db.notebooks.bulkPut(backup.notebooks);
      await db.conversations.bulkPut(backup.conversations);
      await db.sources.bulkPut(backup.sources);
      await db.chunks
        .where("sourceId")
        .anyOf(backup.sources.map((s) => s.id))
        .delete();
      await db.chunks.bulkPut(chunks);
      await db.messages.bulkPut(backup.messages);
      await db.outputs.bulkPut(backup.outputs);
    },
  );
  return backup.notebooks.length;
}

/**
 * Brings a format 1 backup up to date: each notebook's single chat becomes a
 * conversation with the notebook's id, as the database upgrade does.
 */
function upgradeBackup(
  backup: Omit<Backup, "format" | "conversations"> & {
    format: 1 | 2;
    conversations?: Conversation[];
  },
): Backup {
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
  return { ...backup, format: 2, conversations, messages };
}

/** Deletes every notebook, source, chat and output. Settings and keys are kept. */
export async function deleteAllData() {
  await db.transaction(
    "rw",
    [db.notebooks, db.sources, db.chunks, db.conversations, db.messages, db.outputs],
    async () => {
      await Promise.all([
        db.notebooks.clear(),
        db.sources.clear(),
        db.chunks.clear(),
        db.conversations.clear(),
        db.messages.clear(),
        db.outputs.clear(),
      ]);
    },
  );
}
