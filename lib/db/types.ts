// The rows better-vault stores, in IndexedDB on the web and SQLite on desktop.

import type { ModelRef } from "@/lib/ai/catalog";
import type { ChatMessage } from "@/lib/chat/types";

export interface Notebook {
  id: string;
  title: string;
  /** Its icon's key in `lib/notebooks/icons.ts`; the default icon when missing. */
  icon?: string;
  /** A colour token name from `lib/notebooks/colors.ts`. */
  color?: string;
  /** The folder it is in; at the top level when missing or null. */
  folderId?: string | null;
  createdAt: number;
  updatedAt: number;
}

/** A folder on the notebooks page. Folders can hold folders. */
export interface Folder {
  id: string;
  name: string;
  /** The folder it is in; at the top level when null. */
  parentId: string | null;
  color?: string;
  createdAt: number;
  updatedAt: number;
}

/** A file kept with a notebook, such as an audio overview's sound. */
export interface StoredBlob {
  id: string;
  notebookId: string;
  /** The output it belongs to; deleted with it. */
  outputId?: string;
  mime: string;
  data: Uint8Array;
  createdAt: number;
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

/** One chat in a notebook. A notebook can have many. */
export interface Conversation {
  id: string;
  notebookId: string;
  /** The first question, shortened, until the user renames it. */
  title: string;
  createdAt: number;
  updatedAt: number;
}

export interface StoredMessage {
  id: string;
  notebookId: string;
  conversationId: string;
  /** The message's place in its conversation. */
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
