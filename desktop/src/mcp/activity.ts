import { z } from "zod";
import type { ChatMessage } from "../../../lib/chat/types";
import { studioToolIds } from "../../../studio/tools";
import { cut, failure, guarded, text, type ToolContext } from "./context";

/** A message's text, without tool calls or files. */
const messageText = (message: ChatMessage) =>
  message.parts
    .flatMap((part) => (part.type === "text" ? [part.text] : []))
    .join("\n")
    .trim();

/** What the user made with the app: chats, Studio outputs and bots' threads. Read only. */
export function registerActivityTools(ctx: ToolContext) {
  const { mcp, store, log } = ctx;

  mcp.registerTool(
    "list_chats",
    {
      description: "List a notebook's chats (conversations), the most recent first.",
      inputSchema: { notebookId: z.string() },
      annotations: { readOnlyHint: true },
    },
    async ({ notebookId }) =>
      guarded(() => {
        log("list_chats");
        return text(
          store.listConversations(notebookId).map((chat) => ({
            id: chat.id,
            title: chat.title,
            updatedAt: new Date(chat.updatedAt).toISOString(),
          })),
        );
      }),
  );

  mcp.registerTool(
    "read_chat",
    {
      description:
        "Read a chat's messages. Answers cite the notebook's sources as [n]; each answer lists the passages it read.",
      inputSchema: { chatId: z.string() },
      annotations: { readOnlyHint: true },
    },
    async ({ chatId }) =>
      guarded(() => {
        log("read_chat");
        const chat = store.getConversation(chatId);
        if (!chat) return failure("No chat with that id.");
        const messages = store.loadMessages(chatId).map(({ message }) => ({
          role: message.role,
          text: cut(messageText(message), 20_000),
          sources: message.metadata?.passages?.map((passage) => ({
            n: passage.n,
            title: passage.title,
            sourceId: passage.sourceId,
          })),
        }));
        return text({ title: chat.title, messages });
      }),
  );

  mcp.registerTool(
    "list_outputs",
    {
      description: `List a notebook's Studio outputs (${studioToolIds.join(", ")}), newest first.`,
      inputSchema: { notebookId: z.string() },
      annotations: { readOnlyHint: true },
    },
    async ({ notebookId }) =>
      guarded(() => {
        log("list_outputs");
        return text(
          store.listOutputs(notebookId).map((output) => ({
            id: output.id,
            tool: output.toolId,
            title: output.title,
            status: output.status,
            createdAt: new Date(output.createdAt).toISOString(),
          })),
        );
      }),
  );

  mcp.registerTool(
    "read_output",
    {
      description:
        "Read a Studio output's content as JSON (a report's text, flashcards, a quiz, a mind map's Mermaid…). Audio and pictures are not included.",
      inputSchema: { outputId: z.string() },
      annotations: { readOnlyHint: true },
    },
    async ({ outputId }) =>
      guarded(() => {
        log("read_output");
        const output = store.getOutput(outputId);
        if (!output) return failure("No output with that id.");
        const json = JSON.stringify(output.data ?? null);
        const head = { tool: output.toolId, title: output.title, status: output.status };
        // Very large outputs come back as cut JSON text rather than an object.
        return text(
          json.length > 200_000
            ? { ...head, error: output.error, dataJson: cut(json, 200_000) }
            : { ...head, error: output.error, data: output.data ?? null },
        );
      }),
  );

  mcp.registerTool(
    "list_bots",
    {
      description: "List the user's bots: each one's name, role and instructions.",
      annotations: { readOnlyHint: true },
    },
    async () =>
      guarded(() => {
        log("list_bots");
        return text(
          store.listBots().map((bot) => ({
            id: bot.id,
            name: bot.name,
            title: bot.title,
            instructions: bot.instructions,
          })),
        );
      }),
  );

  mcp.registerTool(
    "read_bot_thread",
    {
      description: "Read the latest messages of a bot's thread.",
      inputSchema: {
        botId: z.string(),
        limit: z
          .number()
          .int()
          .min(1)
          .max(200)
          .optional()
          .describe("How many, from the end (default 40)"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ botId, limit = 40 }) =>
      guarded(() => {
        log("read_bot_thread");
        const bot = store.getBot(botId);
        if (!bot) return failure("No bot with that id.");
        const messages = store
          .loadBotThread(botId)
          .slice(-limit)
          .map(({ message }) => ({ role: message.role, text: cut(messageText(message), 20_000) }))
          .filter((message) => message.text);
        return text({ bot: bot.name, messages });
      }),
  );
}
