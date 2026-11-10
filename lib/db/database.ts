import Dexie, { type EntityTable } from "dexie";
import { conversationTitle } from "@/lib/chat/title";
import { cleanText } from "@/lib/grounding/clean";
import type {
  Chunk,
  Conversation,
  Folder,
  Notebook,
  SettingRow,
  Source,
  StoredBlob,
  StoredMessage,
  StudioOutput,
  Vault,
  CalendarEntry,
  Note,
  Skill,
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
  folders!: EntityTable<Folder, "id">;
  vaults!: EntityTable<Vault, "id">;
  calendar!: EntityTable<CalendarEntry, "id">;
  notes!: EntityTable<Note, "id">;
  skills!: EntityTable<Skill, "id">;
  blobs!: EntityTable<StoredBlob, "id">;

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
    // Version 4: folders on the notebooks page, and files kept with a
    // notebook (an audio overview's sound). Notebooks need no change: their
    // icon, colour and folder are optional fields.
    this.version(4).stores({
      folders: "id, parentId",
      blobs: "id, notebookId, outputId",
    });
    // Version 5: pictures taken from a PDF are kept as files of its source.
    this.version(5).stores({
      blobs: "id, notebookId, outputId, sourceId",
    });
    // Version 6: vaults. Notebooks and folders without a vault are in the
    // default one, so they need no change.
    this.version(6).stores({
      vaults: "id",
    });
    // Version 7: calendar entries.
    this.version(7).stores({
      calendar: "id",
    });
    // Version 8: notes and skills, each in a vault.
    this.version(8).stores({
      notes: "id, vaultId, updatedAt",
      skills: "id, vaultId, name",
    });
  }
}
