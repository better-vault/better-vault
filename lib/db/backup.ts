import { z } from "zod";
import { chunkText } from "@/lib/grounding/chunk";
import { db, type Chunk, type Notebook, type Source, type StoredMessage, type StudioOutput } from "./database";

/**
 * A backup holds notebooks, sources, chats and Studio outputs. It never holds
 * settings, so API keys are not written into a file that might be shared.
 */
export interface Backup {
  app: "better-vault";
  format: 1;
  exportedAt: number;
  notebooks: Notebook[];
  sources: Source[];
  messages: StoredMessage[];
  outputs: StudioOutput[];
}

const backupSchema = z.object({
  app: z.literal("better-vault"),
  format: z.literal(1),
  exportedAt: z.number(),
  notebooks: z.array(z.object({ id: z.string(), title: z.string() }).loose()),
  sources: z.array(
    z.object({ id: z.string(), notebookId: z.string(), text: z.string() }).loose(),
  ),
  messages: z.array(z.object({ id: z.string(), notebookId: z.string() }).loose()),
  outputs: z.array(z.object({ id: z.string(), notebookId: z.string() }).loose()),
});

export async function exportBackup(): Promise<Backup> {
  const [notebooks, sources, messages, outputs] = await Promise.all([
    db.notebooks.toArray(),
    db.sources.toArray(),
    db.messages.toArray(),
    db.outputs.toArray(),
  ]);
  return { app: "better-vault", format: 1, exportedAt: Date.now(), notebooks, sources, messages, outputs };
}

/** Adds the backup's content, replacing items with the same id. Returns how many notebooks it held. */
export async function importBackup(raw: unknown): Promise<number> {
  const parsed = backupSchema.safeParse(raw);
  if (!parsed.success) throw new Error("invalid-backup");
  const backup = parsed.data as unknown as Backup;
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
    [db.notebooks, db.sources, db.chunks, db.messages, db.outputs],
    async () => {
      await db.notebooks.bulkPut(backup.notebooks);
      await db.sources.bulkPut(backup.sources);
      await db.chunks.where("sourceId").anyOf(backup.sources.map((s) => s.id)).delete();
      await db.chunks.bulkPut(chunks);
      await db.messages.bulkPut(backup.messages);
      await db.outputs.bulkPut(backup.outputs);
    },
  );
  return backup.notebooks.length;
}

/** Deletes every notebook, source, chat and output. Settings and keys are kept. */
export async function deleteAllData() {
  await db.transaction(
    "rw",
    [db.notebooks, db.sources, db.chunks, db.messages, db.outputs],
    async () => {
      await Promise.all([
        db.notebooks.clear(),
        db.sources.clear(),
        db.chunks.clear(),
        db.messages.clear(),
        db.outputs.clear(),
      ]);
    },
  );
}
