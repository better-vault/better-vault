import type { UIMessage } from "ai";
import type { ModelRef } from "@/lib/ai/catalog";
import type { SourceKind } from "@/lib/db/database";

/**
 * `sources`: answer only from the notebook's selected sources.
 * `web`: the model may also search the web with its provider's own tool.
 */
export type ChatMode = "sources" | "web";

/** A passage of a source that was given to the model as `[n]`. */
export interface PassageRef {
  n: number;
  /** The passage's chunk, so a citation can open the source at it. */
  chunkId: string;
  sourceId: string;
  title: string;
  kind: SourceKind;
  /** The start of the passage, shown when a citation is hovered. */
  snippet: string;
}

export interface ChatMessageMetadata {
  createdAt?: number;
  mode?: ChatMode;
  model?: ModelRef;
  /** The numbered passages the answer could cite. */
  passages?: PassageRef[];
}

export type ChatMessage = UIMessage<ChatMessageMetadata>;
