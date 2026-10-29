import Dexie, { type EntityTable } from "dexie";
import { conversationTitle } from "@/lib/chat/title";
import { cleanText } from "@/lib/grounding/clean";
import type {
  Chunk,
  Conversation,
  Notebook,
  SettingRow,
  Source,
  StoredMessage,
  StudioOutput,
} from "./types";

export type * from "./types";

/**
 * The web app's store: an IndexedDB database in the browser. The desktop app
 * uses SQLite instead (`./sqlite`). Both sit behind `Backend` (`./backend`).
 */
export class BetterVaultDatabase extends Dexie {
  notebooks!: EntityTable<Notebook, "id">;
  sources!: EntityTable<Source, "id">;
  chunks!: EntityTable<Chunk, "id">;
  messages!: EntityTable<StoredMessage, "id">;
  conversations!: EntityTable<Conversation, "id">;
  outputs!: EntityTable<StudioOutput, "id">;
  settings!: EntityTable<SettingRow, "key">;

  constructor(name = "better-vault") {
    super(name);
    this.version(1).stores({
      notebooks: "id, updatedAt",
      sources: "id, notebookId, createdAt",
      chunks: "id, notebookId, sourceId, [sourceId+index]",
      messages: "id, notebookId, [notebookId+createdAt]",
      outputs: "id, notebookId, status, [notebookId+createdAt]",
      settings: "key",
    });
    // Version 2: sources saved before text cleaning lose the characters no
    // font can draw. Passages are cleaned in place, so citations keep working.
    this.version(2).upgrade(async (tx) => {
      await tx
        .table<Source>("sources")
        .toCollection()
        .modify((source) => {
          source.text = cleanText(source.text);
          source.charCount = source.text.length;
        });
      await tx
        .table<Chunk>("chunks")
        .toCollection()
        .modify((chunk) => {
          chunk.text = cleanText(chunk.text);
        });
    });
    // Version 3: a notebook can hold several chats. Each notebook's existing
    // chat becomes its first conversation, with the notebook's id. Spaces
    // left at the start of lines by the version 2 cleaning are removed too.
    this.version(3)
      .stores({
        conversations: "id, notebookId, [notebookId+updatedAt]",
        messages: "id, notebookId, conversationId, [conversationId+createdAt]",
      })
      .upgrade(async (tx) => {
        const rows = await tx.table<StoredMessage>("messages").toArray();
        const byNotebook = new Map<string, StoredMessage[]>();
        for (const row of rows)
          byNotebook.set(row.notebookId, [...(byNotebook.get(row.notebookId) ?? []), row]);
        const conversations: Conversation[] = [...byNotebook].map(([notebookId, messages]) => {
          const times = messages.map((row) => row.createdAt);
          return {
            id: notebookId,
            notebookId,
            title: conversationTitle(
              messages.sort((a, b) => a.createdAt - b.createdAt).map((row) => row.message),
            ),
            createdAt: Math.min(...times),
            updatedAt: Math.max(...times),
          };
        });
        await tx.table<Conversation>("conversations").bulkPut(conversations);
        await tx
          .table<StoredMessage>("messages")
          .toCollection()
          .modify((row) => {
            row.conversationId = row.notebookId;
          });
        const tidy = (text: string) => text.replace(/[^\S\n]*\n[^\S\n]*/g, "\n").trim();
        await tx
          .table<Source>("sources")
          .toCollection()
          .modify((source) => {
            source.text = tidy(source.text);
            source.charCount = source.text.length;
          });
        await tx
          .table<Chunk>("chunks")
          .toCollection()
          .modify((chunk) => {
            chunk.text = tidy(chunk.text);
          });
      });
  }
}
