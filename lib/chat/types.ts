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
  /** What the request was made of, in characters, to split the token count by. */
  prompt?: PromptSize;
  /** The tokens the answer took, as the provider counted them. */
  usage?: TokenUsage;
}

export interface PromptSize {
  instructions: number;
  sources: number;
  conversation: number;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  reasoningTokens?: number;
  cachedInputTokens?: number;
}

export type ChatMessage = UIMessage<ChatMessageMetadata>;
