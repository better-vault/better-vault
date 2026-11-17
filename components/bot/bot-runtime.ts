import { Chat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  isToolUIPart,
  getToolName,
  lastAssistantMessageIsCompleteWithToolCalls,
} from "ai";
import { useSyncExternalStore } from "react";
import { botAccess, botToolsFor } from "@/lib/bot/access";
import { runBotTool, type ToolContext } from "@/lib/bot/run-tool";
import { botWriteTools, isBotTool, type BotToolName } from "@/lib/bot/tools";
import type { ChatMessage } from "@/lib/chat/types";
import { getBot, listBots, loadBotThread, saveBotThread } from "@/lib/db/bots";
import { activeModel, credentialsFor, effortFor, getSettings } from "@/lib/db/settings";
import { store } from "@/lib/db/store";
import type { Vault } from "@/lib/db/types";
import { currentVaultId, DEFAULT_VAULT } from "@/lib/db/vaults";
import { sameName } from "@/lib/notes/syntax";

/**
 * The bots' running state, kept for the page's life so a bot keeps working
 * (and a delegate keeps answering) while another bot is shown. One `Chat` per
 * bot; its tool calls run here, on the user's device.
 */

/** How many earlier messages are sent with each turn. */
const HISTORY = 24;

/** What a bot is doing, shown by its avatar and in the roster. */
export type BotActivity = "idle" | "thinking" | "waiting" | "done";

interface Environment {
  /** A vault's name as shown ("My vault" for the default one). */
  vaultLabel: (vault: Pick<Vault, "name">) => string;
}

let environment: Environment = { vaultLabel: (vault) => vault.name || "My vault" };

/** Set by the Bot view, which has the translations. */
export function setBotEnvironment(next: Environment) {
  environment = next;
}

// ---- Activity ---------------------------------------------------------------

const activity = new Map<string, BotActivity>();
const listeners = new Set<() => void>();
const doneTimers = new Map<string, ReturnType<typeof setTimeout>>();

function setActivity(botId: string, next: BotActivity) {
  clearTimeout(doneTimers.get(botId));
  if (next === "done")
    doneTimers.set(
      botId,
      setTimeout(() => setActivity(botId, "idle"), 1600),
    );
  if (activity.get(botId) === next) return;
  activity.set(botId, next);
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useBotActivity(botId: string | undefined): BotActivity {
  return useSyncExternalStore(
    subscribe,
    () => (botId && activity.get(botId)) || "idle",
    () => "idle",
  );
}

// ---- Thread state -------------------------------------------------------------

/** The tool calls of a message still waiting: for the page to run them, or for the user's OK. */
export function pendingTools(message: ChatMessage | undefined) {
  const parts = message?.role === "assistant" ? message.parts.filter(isToolUIPart) : [];
  const open = parts.filter(
    (part) => part.state === "input-available" || part.state === "input-streaming",
  );
  const approvals = open.filter((part) => {
    const name = getToolName(part);
    return isBotTool(name) && botWriteTools.has(name);
  });
  return { approvals, running: open.length - approvals.length };
}

/** Where a thread stands once a request has ended. */
function settle(botId: string, messages: ChatMessage[], failed: boolean) {
  const last = messages.at(-1);
  const { approvals, running } = pendingTools(last);
  if (!failed && running > 0) return; // Its tools are running; another request follows.
  const outcome: Outcome = failed
    ? { state: "error" }
    : approvals.length
      ? { state: "waiting" }
      : { state: "done", answer: answerOf(last) };
  setActivity(botId, outcome.state === "waiting" ? "waiting" : failed ? "idle" : "done");
  const waiting = waiters.get(botId) ?? [];
  waiters.delete(botId);
  for (const resolve of waiting) resolve(outcome);
}

type Outcome = { state: "done"; answer: string } | { state: "waiting" } | { state: "error" };

const waiters = new Map<string, ((outcome: Outcome) => void)[]>();

function nextOutcome(botId: string): Promise<Outcome> {
  return new Promise((resolve) => waiters.set(botId, [...(waiters.get(botId) ?? []), resolve]));
}

function answerOf(message: ChatMessage | undefined): string {
  if (message?.role !== "assistant") return "";
  return message.parts
    .flatMap((part) => (part.type === "text" ? [part.text] : []))
    .join("\n")
    .trim();
}

// ---- Requests ---------------------------------------------------------------

/** Who handed the thread's latest task over, if a bot did. */
function delegatorOf(messages: ChatMessage[]): string | undefined {
  const lastUser = [...messages].reverse().find((message) => message.role === "user");
  return lastUser?.metadata?.from;
}

async function vaultList(): Promise<Vault[]> {
  const vaults = await store().listVaults();
  return vaults.some((vault) => vault.id === DEFAULT_VAULT)
    ? vaults
    : [{ id: DEFAULT_VAULT, name: "" } as Vault, ...vaults];
}

/** Thrown when no model is set up; the thread asks the user to add a key. */
export class NoModelError extends Error {
  constructor() {
    super("no-model");
  }
}

async function requestBody(botId: string, messages: ChatMessage[]) {
  const [bot, bots, settings, vaults] = await Promise.all([
    getBot(botId),
    listBots(),
    getSettings(),
    vaultList(),
  ]);
  if (!bot) throw new Error("This bot was deleted.");
  const model = bot.model ?? activeModel(settings);
  if (!model) throw new NoModelError();
  const delegatorId = delegatorOf(messages);
  const delegator = delegatorId ? bots.find((each) => each.id === delegatorId) : undefined;
  const current = currentVaultId();
  const label = environment.vaultLabel;
  const scopeId = botAccess(bot).vault;
  const scope = scopeId ? vaults.find((vault) => vault.id === scopeId) : undefined;
  return {
    messages: messages.slice(-HISTORY),
    model,
    credentials: credentialsFor(settings, model.provider),
    effort: effortFor(settings, model.provider),
    bot: { name: bot.name, title: bot.title, instructions: bot.instructions },
    tools: botToolsFor(bot, { handedOver: Boolean(delegatorId) }),
    // A task handed over is not handed on: one level, so bots never loop.
    roster:
      bot.canDelegate && !delegatorId
        ? bots
            .filter((each) => each.id !== bot.id)
            .map((each) => ({ name: each.name, title: each.title }))
        : [],
    delegatedBy: delegator?.name,
    now: new Date().toString(),
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    vaults: vaults.map(label),
    currentVault: label(vaults.find((vault) => vault.id === current) ?? vaults[0]),
    scopeVault: scope ? label(scope) : undefined,
  };
}

/** What a bot's tool calls may touch: its tools and its vault, read fresh for each call. */
async function toolContext(botId: string, messages: ChatMessage[]): Promise<ToolContext> {
  const bot = await getBot(botId);
  const handedOver = Boolean(delegatorOf(messages));
  const vault = bot ? botAccess(bot).vault : undefined;
  return {
    currentVault: currentVaultId(),
    vaultLabel: environment.vaultLabel,
    askBot: (target, task) => askBot(botId, target, task),
    allowed: new Set(bot ? botToolsFor(bot, { handedOver }) : []),
    ...(vault ? { vault } : {}),
  };
}

const transport = new DefaultChatTransport<ChatMessage>({
  api: "/api/bot",
  prepareSendMessagesRequest: async ({ id, messages }) => ({
    body: await requestBody(id, messages),
  }),
});

// ---- Chats ------------------------------------------------------------------

const chats = new Map<string, Promise<Chat<ChatMessage>>>();

/** The bot's chat, loading its thread the first time. */
export function botChat(botId: string): Promise<Chat<ChatMessage>> {
  let chat = chats.get(botId);
  if (!chat) {
    chat = loadBotThread(botId).then((messages) => createChat(botId, messages));
    chats.set(botId, chat);
  }
  return chat;
}

/** Forgets a bot's chat (after it is deleted or its thread cleared), stopping its answer. */
export async function dropBotChat(botId: string) {
  const chat = chats.get(botId);
  chats.delete(botId);
  setActivity(botId, "idle");
  await (await chat)?.stop();
}

function createChat(botId: string, messages: ChatMessage[]): Chat<ChatMessage> {
  const chat: Chat<ChatMessage> = new Chat<ChatMessage>({
    id: botId,
    messages,
    transport,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    onToolCall: ({ toolCall }) => {
      if (toolCall.dynamic || !isBotTool(toolCall.toolName)) return;
      const name: BotToolName = toolCall.toolName;
      // Writes wait for the user's OK in the thread.
      if (botWriteTools.has(name)) return;
      void toolContext(botId, chat.messages)
        .then((context) => runBotTool(name, toolCall.input, context))
        .then((output) => {
          void chat.addToolOutput({
            tool: name as never,
            toolCallId: toolCall.toolCallId,
            output: output as never,
          });
        });
    },
    onFinish: ({ messages: finished, isError, isAbort }) => {
      void saveBotThread(botId, finished);
      settle(botId, finished, isError || isAbort);
    },
    onError: () => setActivity(botId, "idle"),
  });
  return chat;
}

/** Sends the user's message to a bot. */
export async function sendToBot(botId: string, text: string) {
  const chat = await botChat(botId);
  setActivity(botId, "thinking");
  await chat.sendMessage({ text, metadata: { createdAt: Date.now() } });
}

/** Answers a write the bot asked to make: runs it on an OK, or tells the bot no. */
export async function answerApproval(
  botId: string,
  toolCallId: string,
  approved: boolean,
): Promise<void> {
  const chat = await botChat(botId);
  const part = chat.messages
    .flatMap((message) => message.parts)
    .filter(isToolUIPart)
    .find((each) => each.toolCallId === toolCallId);
  if (!part || part.state !== "input-available") return;
  const name = getToolName(part);
  if (!isBotTool(name)) return;
  setActivity(botId, "thinking");
  const output = approved
    ? await runBotTool(name, part.input, await toolContext(botId, chat.messages))
    : { ok: false, declined: true, note: "The user said no. Do not try again unless asked." };
  await chat.addToolOutput({ tool: name as never, toolCallId, output: output as never });
  // Saved now, so a change that was made is never offered again, even if the bot's reply fails.
  await saveBotThread(botId, chat.messages);
}

/**
 * Hands a task from one bot to another: the task goes into the other bot's
 * thread, marked as coming from the first, and the answer comes back.
 */
async function askBot(fromId: string, target: string, task: string): Promise<unknown> {
  const bots = await listBots();
  const bot = bots.find((each) => sameName(each.name, target) && each.id !== fromId);
  if (!bot) return { error: `No other bot is called "${target}".` };
  const chat = await botChat(bot.id);
  if (chat.status === "submitted" || chat.status === "streaming")
    return { error: `${bot.name} is busy with another task. Try again later.` };
  const outcome = nextOutcome(bot.id);
  setActivity(bot.id, "thinking");
  void chat
    .sendMessage({ text: task, metadata: { createdAt: Date.now(), from: fromId } })
    .catch(() => settle(bot.id, chat.messages, true));
  const result = await outcome;
  if (result.state === "done") return { bot: bot.name, answer: result.answer || "(no answer)" };
  if (result.state === "waiting")
    return {
      bot: bot.name,
      pendingApproval: true,
      note: `${bot.name} asked the user to approve a change in its own chat. It is not done until they do.`,
    };
  return { bot: bot.name, error: `${bot.name} could not finish the task.` };
}
