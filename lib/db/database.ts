import Dexie, { type EntityTable } from "dexie";
import type { ModelRef } from "@/lib/ai/catalog";
import type { ChatMessage } from "@/lib/chat/types";
import { cleanText } from "@/lib/grounding/clean";

/**
 * Everything better-vault stores lives in the browser, in this IndexedDB
 * database. There is no server-side database.
 */

export interface Notebook {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

export type SourceKind = "text" | "markdown" | "pdf" | "url";

export interface Source {
  id: string;
  notebookId: string;
  title: string;
  kind: SourceKind;
  /** The page a web source was read from. */
  url?: string;
  /** The name of an uploaded file. */
  fileName?: string;
  /** The source as plain text. */
  text: string;
  charCount: number;
  /** Only selected sources are given to the model. */
  selected: boolean;
  createdAt: number;
}

/** A passage of a source, used for retrieval and citations. */
export interface Chunk {
  id: string;
  notebookId: string;
  sourceId: string;
  index: number;
  text: string;
}

export interface StoredMessage {
  id: string;
  notebookId: string;
  createdAt: number;
  message: ChatMessage;
}

export type OutputStatus = "generating" | "ready" | "error";

/** One Studio result, such as a quiz or a mind map. */
export interface StudioOutput {
  id: string;
  notebookId: string;
  toolId: string;
  title: string;
  status: OutputStatus;
  /** The options chosen in the tool's dialog. */
  options: unknown;
  sourceIds: string[];
  /** The tool's output, shaped by its schema. Set when `status` is `ready`. */
  data?: unknown;
  error?: string;
  model?: ModelRef;
  createdAt: number;
  updatedAt: number;
}

export interface SettingRow {
  key: string;
  value: unknown;
}

export class BetterVaultDatabase extends Dexie {
  notebooks!: EntityTable<Notebook, "id">;
  sources!: EntityTable<Source, "id">;
  chunks!: EntityTable<Chunk, "id">;
  messages!: EntityTable<StoredMessage, "id">;
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
  }
}

export const db = new BetterVaultDatabase();
