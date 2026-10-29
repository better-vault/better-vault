import type { Chunk, Conversation, Notebook, Source, StoredMessage, StudioOutput } from "./types";

/**
 * Where notebooks are stored. The web app keeps them in IndexedDB (Dexie); the
 * desktop app keeps them in a SQLite file, reached through Electron's IPC.
 *
 * Backends only store rows. Ids, chunking, titles and settings defaults live
 * in the `lib/db/*.ts` modules, so both stores behave the same. Each method is
 * one transaction. The contract tests in `db.test.ts` run against both.
 */
export interface Backend {
  listNotebooks(): Promise<Notebook[]>;
  getNotebook(id: string): Promise<Notebook | undefined>;
  addNotebook(notebook: Notebook): Promise<void>;
  patchNotebook(id: string, patch: Partial<Notebook>): Promise<void>;
  /** Deletes a notebook with its sources, passages, chats and outputs. */
  deleteNotebook(id: string): Promise<void>;
  /** How many sources each notebook has, by notebook id. */
  countSources(): Promise<Record<string, number>>;

  /** Adds a source with its passages and moves its notebook to the top. */
  addSource(source: Source, chunks: Chunk[], now: number): Promise<void>;
  getSource(id: string): Promise<Source | undefined>;
  /** The sources that exist among `ids`, in the order given. */
  getSources(ids: string[]): Promise<Source[]>;
  /** A notebook's sources, oldest first. */
  listSources(notebookId: string): Promise<Source[]>;
  patchSource(id: string, patch: Partial<Source>): Promise<void>;
  patchNotebookSources(notebookId: string, patch: Partial<Source>): Promise<void>;
  /** Deletes a source with its passages. */
  deleteSource(id: string): Promise<void>;
  /** The passages of these sources, in no particular order. */
  getChunks(sourceIds: string[]): Promise<Chunk[]>;

  getConversation(id: string): Promise<Conversation | undefined>;
  /** A notebook's conversations, the most recent first. */
  listConversations(notebookId: string): Promise<Conversation[]>;
  /** A conversation's messages, in order. */
  loadMessages(conversationId: string): Promise<StoredMessage[]>;
  /**
   * Replaces a conversation's messages and saves the conversation, keeping its
   * saved title and creation time when it exists. Moves the notebook to the top.
   */
  saveChat(conversation: Conversation, rows: StoredMessage[]): Promise<void>;
  patchConversation(id: string, patch: Partial<Conversation>): Promise<void>;
  /** Deletes a conversation with its messages. */
  deleteConversation(id: string): Promise<void>;

  getOutput(id: string): Promise<StudioOutput | undefined>;
  /** A notebook's outputs, newest first. */
  listOutputs(notebookId: string): Promise<StudioOutput[]>;
  /** Adds an output and moves its notebook to the top. */
  addOutput(output: StudioOutput): Promise<void>;
  patchOutput(id: string, patch: Partial<StudioOutput>): Promise<void>;
  /** Changes a ready output's data. False when it is gone or not ready. */
  patchReadyOutput(id: string, patch: Partial<StudioOutput>): Promise<boolean>;
  /** Marks outputs still generating, except `running`, as failed. */
  interruptOutputs(running: string[], error: string): Promise<void>;
  deleteOutput(id: string): Promise<void>;

  getSetting(key: string): Promise<unknown>;
  putSetting(key: string, value: unknown): Promise<void>;
  clearSettings(): Promise<void>;

  /** Every notebook, source, conversation, message and output. */
  exportAll(): Promise<StoreContent>;
  /** Adds content, replacing rows with the same id and the passages of its sources. */
  importAll(content: StoreContent, chunks: Chunk[]): Promise<void>;
  /** Deletes every notebook and everything in them. Settings are kept. */
  clearAll(): Promise<void>;
  /** The number of rows in a table. Used by tests. */
  count(table: TableName): Promise<number>;
}

export interface StoreContent {
  notebooks: Notebook[];
  sources: Source[];
  conversations: Conversation[];
  messages: StoredMessage[];
  outputs: StudioOutput[];
}

export const tableNames = [
  "notebooks",
  "sources",
  "chunks",
  "conversations",
  "messages",
  "outputs",
  "settings",
] as const;

export type TableName = (typeof tableNames)[number];

export type BackendMethod = keyof Backend;

/**
 * The tables each write changes. The desktop app tells open windows about
 * them, so live queries reading those tables run again.
 */
export const writes = {
  addNotebook: ["notebooks"],
  patchNotebook: ["notebooks"],
  deleteNotebook: ["notebooks", "sources", "chunks", "conversations", "messages", "outputs"],
  addSource: ["sources", "chunks", "notebooks"],
  patchSource: ["sources"],
  patchNotebookSources: ["sources"],
  deleteSource: ["sources", "chunks"],
  saveChat: ["messages", "conversations", "notebooks"],
  patchConversation: ["conversations"],
  deleteConversation: ["conversations", "messages"],
  addOutput: ["outputs", "notebooks"],
  patchOutput: ["outputs"],
  patchReadyOutput: ["outputs"],
  interruptOutputs: ["outputs"],
  deleteOutput: ["outputs"],
  putSetting: ["settings"],
  clearSettings: ["settings"],
  importAll: ["notebooks", "sources", "chunks", "conversations", "messages", "outputs"],
  clearAll: ["notebooks", "sources", "chunks", "conversations", "messages", "outputs"],
} as const satisfies Partial<Record<BackendMethod, readonly TableName[]>>;

/** Every backend method, the list the desktop app accepts over IPC. */
export const backendMethods = [
  "listNotebooks",
  "getNotebook",
  "addNotebook",
  "patchNotebook",
  "deleteNotebook",
  "countSources",
  "addSource",
  "getSource",
  "getSources",
  "listSources",
  "patchSource",
  "patchNotebookSources",
  "deleteSource",
  "getChunks",
  "getConversation",
  "listConversations",
  "loadMessages",
  "saveChat",
  "patchConversation",
  "deleteConversation",
  "getOutput",
  "listOutputs",
  "addOutput",
  "patchOutput",
  "patchReadyOutput",
  "interruptOutputs",
  "deleteOutput",
  "getSetting",
  "putSetting",
  "clearSettings",
  "exportAll",
  "importAll",
  "clearAll",
  "count",
] as const satisfies readonly BackendMethod[];

// Fails to compile when a method is missing from the list above.
type Missing = Exclude<BackendMethod, (typeof backendMethods)[number]>;
const _complete: Missing extends never ? true : Missing = true;
void _complete;
