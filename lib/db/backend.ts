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
} from "./types";

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
  /** Deletes a notebook with its sources, passages, chats, outputs and files. */
  deleteNotebook(id: string): Promise<void>;
  /** How many sources each notebook has, by notebook id. */
  countSources(): Promise<Record<string, number>>;

  /** Every calendar entry. */
  listCalendar(): Promise<CalendarEntry[]>;
  /** Replaces the calendar with these entries (the calendar saves its whole list on each change). */
  saveCalendar(entries: CalendarEntry[]): Promise<void>;

  listVaults(): Promise<Vault[]>;
  /** Adds a vault or replaces it. */
  putVault(vault: Vault): Promise<void>;
  /** Deletes a vault's row only; `lib/db/vaults.ts` deletes what is in it first. */
  deleteVault(id: string): Promise<void>;

  listFolders(): Promise<Folder[]>;
  addFolder(folder: Folder): Promise<void>;
  patchFolder(id: string, patch: Partial<Folder>): Promise<void>;
  /** Deletes a folder. What it held, folders and notebooks, moves to its parent. */
  deleteFolder(id: string): Promise<void>;

  /** Adds a source with its passages and moves its notebook to the top. */
  addSource(source: Source, chunks: Chunk[], now: number): Promise<void>;
  getSource(id: string): Promise<Source | undefined>;
  /** The sources that exist among `ids`, in the order given. */
  getSources(ids: string[]): Promise<Source[]>;
  /** A notebook's sources, oldest first. */
  listSources(notebookId: string): Promise<Source[]>;
  /** Every source of every notebook, for the search index. */
  listAllSources(): Promise<Source[]>;
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
  /** Every Studio output of every notebook, for the search index. */
  listAllOutputs(): Promise<StudioOutput[]>;
  /** Adds an output and moves its notebook to the top. */
  addOutput(output: StudioOutput): Promise<void>;
  patchOutput(id: string, patch: Partial<StudioOutput>): Promise<void>;
  /** Changes a ready output's data. False when it is gone or not ready. */
  patchReadyOutput(id: string, patch: Partial<StudioOutput>): Promise<boolean>;
  /** Marks outputs still generating, except `running`, as failed. */
  interruptOutputs(running: string[], error: string): Promise<void>;
  /** Deletes an output with its files. */
  deleteOutput(id: string): Promise<void>;

  putBlob(blob: StoredBlob): Promise<void>;
  getBlob(id: string): Promise<StoredBlob | undefined>;

  getSetting(key: string): Promise<unknown>;
  putSetting(key: string, value: unknown): Promise<void>;
  clearSettings(): Promise<void>;

  /** Every folder, notebook, source, conversation, message, output and file. */
  exportAll(): Promise<StoreContent>;
  /** Adds content, replacing rows with the same id and the passages of its sources. */
  importAll(content: StoreContent, chunks: Chunk[]): Promise<void>;
  /** Deletes every folder and notebook and everything in them. Settings are kept. */
  clearAll(): Promise<void>;
  /** The number of rows in a table. Used by tests. */
  count(table: TableName): Promise<number>;
}

export interface StoreContent {
  calendar: CalendarEntry[];
  vaults: Vault[];
  folders: Folder[];
  notebooks: Notebook[];
  sources: Source[];
  conversations: Conversation[];
  messages: StoredMessage[];
  outputs: StudioOutput[];
  blobs: StoredBlob[];
}

export const tableNames = [
  "calendar",
  "vaults",
  "folders",
  "notebooks",
  "sources",
  "chunks",
  "conversations",
  "messages",
  "outputs",
  "blobs",
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
  deleteNotebook: [
    "notebooks",
    "sources",
    "chunks",
    "conversations",
    "messages",
    "outputs",
    "blobs",
  ],
  saveCalendar: ["calendar"],
  putVault: ["vaults"],
  deleteVault: ["vaults"],
  addFolder: ["folders"],
  patchFolder: ["folders"],
  deleteFolder: ["folders", "notebooks"],
  addSource: ["sources", "chunks", "notebooks"],
  patchSource: ["sources"],
  patchNotebookSources: ["sources"],
  deleteSource: ["sources", "chunks", "blobs"],
  saveChat: ["messages", "conversations", "notebooks"],
  patchConversation: ["conversations"],
  deleteConversation: ["conversations", "messages"],
  addOutput: ["outputs", "notebooks"],
  patchOutput: ["outputs"],
  patchReadyOutput: ["outputs"],
  interruptOutputs: ["outputs"],
  deleteOutput: ["outputs", "blobs"],
  putBlob: ["blobs"],
  putSetting: ["settings"],
  clearSettings: ["settings"],
  importAll: [
    "calendar",
    "vaults",
    "folders",
    "notebooks",
    "sources",
    "chunks",
    "conversations",
    "messages",
    "outputs",
    "blobs",
  ],
  clearAll: [
    "calendar",
    "vaults",
    "folders",
    "notebooks",
    "sources",
    "chunks",
    "conversations",
    "messages",
    "outputs",
    "blobs",
  ],
} as const satisfies Partial<Record<BackendMethod, readonly TableName[]>>;

/** Every backend method, the list the desktop app accepts over IPC. */
export const backendMethods = [
  "listNotebooks",
  "getNotebook",
  "addNotebook",
  "patchNotebook",
  "deleteNotebook",
  "countSources",
  "listCalendar",
  "saveCalendar",
  "listVaults",
  "putVault",
  "deleteVault",
  "listFolders",
  "addFolder",
  "patchFolder",
  "deleteFolder",
  "addSource",
  "getSource",
  "getSources",
  "listSources",
  "listAllSources",
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
  "listAllOutputs",
  "addOutput",
  "patchOutput",
  "patchReadyOutput",
  "interruptOutputs",
  "deleteOutput",
  "putBlob",
  "getBlob",
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
