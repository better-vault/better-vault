import { useLiveQuery } from "dexie-react-hooks";
import { conversationTitle } from "@/lib/chat/title";
import type { ChatMessage } from "@/lib/chat/types";
import { db, type Conversation } from "./database";

/**
 * Conversations deleted in this page. An answer stopped by the deletion still
 * finishes, and must not bring its conversation back.
 */
const deleted = new Set<string>();

/** A conversation's messages, in order. */
export async function loadChat(conversationId: string): Promise<ChatMessage[]> {
  const rows = await db.messages
    .where("[conversationId+createdAt]")
    .between([conversationId, -Infinity], [conversationId, Infinity])
    .toArray();
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
  await db.transaction("rw", [db.messages, db.conversations, db.notebooks], async () => {
    await db.messages.where("conversationId").equals(conversation.id).delete();
    await db.messages.bulkPut(
      messages.map((message, at) => ({
        id: `${conversation.id}:${message.id}`,
        notebookId: conversation.notebookId,
        conversationId: conversation.id,
        // The position in the conversation, so the order survives a reload.
        createdAt: base + at,
        message,
      })),
    );
    const saved = await db.conversations.get(conversation.id);
    await db.conversations.put({
      id: conversation.id,
      notebookId: conversation.notebookId,
      title: saved?.title || conversationTitle(messages),
      createdAt: saved?.createdAt ?? now,
      updatedAt: now,
    });
    await db.notebooks.update(conversation.notebookId, { updatedAt: now });
  });
}

/** The conversation used most recently in a notebook, if any. */
export async function latestConversation(notebookId: string): Promise<Conversation | undefined> {
  return db.conversations
    .where("[notebookId+updatedAt]")
    .between([notebookId, -Infinity], [notebookId, Infinity])
    .last();
}

export async function renameConversation(id: string, title: string) {
  await db.conversations.update(id, { title: title.trim() });
}

export async function deleteConversation(id: string) {
  deleted.add(id);
  await db.transaction("rw", [db.messages, db.conversations], async () => {
    await db.messages.where("conversationId").equals(id).delete();
    await db.conversations.delete(id);
  });
}

/** A notebook's conversations, the most recent first. Undefined while loading. */
export function useConversations(notebookId: string): Conversation[] | undefined {
  return useLiveQuery(
    () =>
      db.conversations
        .where("[notebookId+updatedAt]")
        .between([notebookId, -Infinity], [notebookId, Infinity])
        .reverse()
        .toArray(),
    [notebookId],
  );
}
