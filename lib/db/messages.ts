import type { ChatMessage } from "@/lib/chat/types";
import { db } from "./database";

/** A notebook's chat, in order. */
export async function loadChat(notebookId: string): Promise<ChatMessage[]> {
  const rows = await db.messages
    .where("[notebookId+createdAt]")
    .between([notebookId, -Infinity], [notebookId, Infinity])
    .toArray();
  return rows.map((row) => row.message);
}

/** Replaces a notebook's saved chat with these messages. */
export async function saveChat(notebookId: string, messages: ChatMessage[]) {
  const base = Date.now() - messages.length;
  await db.transaction("rw", [db.messages, db.notebooks], async () => {
    await db.messages.where("notebookId").equals(notebookId).delete();
    await db.messages.bulkPut(
      messages.map((message, at) => ({
        id: `${notebookId}:${message.id}`,
        notebookId,
        // The position in the chat, so the order survives a reload.
        createdAt: base + at,
        message,
      })),
    );
    await db.notebooks.update(notebookId, { updatedAt: Date.now() });
  });
}

export async function clearChat(notebookId: string) {
  await db.messages.where("notebookId").equals(notebookId).delete();
}
