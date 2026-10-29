import { conversationTitle } from "@/lib/chat/title";
import type { ChatMessage } from "@/lib/chat/types";
import { useStoreQuery } from "./live";
import { store } from "./store";
import type { Conversation } from "./types";

/**
 * Conversations deleted in this page. An answer stopped by the deletion still
 * finishes, and must not bring its conversation back.
 */
const deleted = new Set<string>();

/** A conversation's messages, in order. */
export async function loadChat(conversationId: string): Promise<ChatMessage[]> {
  const rows = await store().loadMessages(conversationId);
  return rows.map((row) => row.message);
}

/**
 * Replaces a conversation's saved messages, creating the conversation on its
 * first answer. Its title is the first question until the user renames it.
 */
export async function saveChat(
  conversation: { id: string; notebookId: string },
  messages: ChatMessage[],
) {
  if (messages.length === 0 || deleted.has(conversation.id)) return;
  const now = Date.now();
  const base = now - messages.length;
  await store().saveChat(
    {
      id: conversation.id,
      notebookId: conversation.notebookId,
      // Used only for a new conversation; a saved title and creation time are kept.
      title: conversationTitle(messages),
      createdAt: now,
      updatedAt: now,
    },
    messages.map((message, at) => ({
      id: `${conversation.id}:${message.id}`,
      notebookId: conversation.notebookId,
      conversationId: conversation.id,
      // The position in the conversation, so the order survives a reload.
      createdAt: base + at,
      message,
    })),
  );
}

/** The conversation used most recently in a notebook, if any. */
export async function latestConversation(notebookId: string): Promise<Conversation | undefined> {
  return (await store().listConversations(notebookId))[0];
}

export async function renameConversation(id: string, title: string) {
  await store().patchConversation(id, { title: title.trim() });
}

export async function deleteConversation(id: string) {
  deleted.add(id);
  await store().deleteConversation(id);
}

/** A notebook's conversations, the most recent first. Undefined while loading. */
export function useConversations(notebookId: string): Conversation[] | undefined {
  return useStoreQuery(
    () => store().listConversations(notebookId),
    [notebookId],
    ["conversations"],
  );
}
