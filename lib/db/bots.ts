import { generateId } from "ai";
import type { ChatMessage } from "@/lib/chat/types";
import { useStoreQuery } from "./live";
import { store } from "./store";
import type { Bot } from "./types";

/** What a new bot is made of; the rest is filled in. */
export type NewBot = Pick<Bot, "name" | "title" | "instructions" | "avatar"> &
  Partial<Pick<Bot, "model" | "canDelegate" | "canCreateBots" | "access" | "pinned" | "starter">>;

/** Bots deleted in this page. A run still finishing must not bring its bot back. */
const deleted = new Set<string>();

/** Every bot, in roster order. */
export function listBots(): Promise<Bot[]> {
  return store().listBots();
}

export function useBots(): Bot[] | undefined {
  return useStoreQuery(listBots, [], ["bots"]);
}

export function getBot(id: string): Promise<Bot | undefined> {
  return store().getBot(id);
}

export async function createBot(input: NewBot): Promise<Bot> {
  const bots = await store().listBots();
  const now = Date.now();
  const bot: Bot = {
    id: generateId(),
    canDelegate: false,
    pinned: false,
    ...input,
    name: input.name.trim(),
    title: input.title.trim(),
    order: bots.reduce((last, each) => Math.max(last, each.order), -1) + 1,
    createdAt: now,
    updatedAt: now,
  };
  await store().putBot(bot);
  return bot;
}

/** Changes a bot's settings. Its thread is left as it is. */
export async function updateBot(
  id: string,
  patch: Partial<Omit<Bot, "id" | "createdAt">>,
): Promise<void> {
  const bot = await store().getBot(id);
  if (!bot) return;
  const next: Bot = { ...bot, ...patch, updatedAt: Date.now() };
  if ("model" in patch && patch.model === undefined) delete next.model;
  await store().putBot(next);
}

export async function deleteBot(id: string): Promise<void> {
  deleted.add(id);
  await store().deleteBot(id);
}

/** A bot's thread, in order. */
export async function loadBotThread(botId: string): Promise<ChatMessage[]> {
  return (await store().loadBotThread(botId)).map((row) => row.message);
}

/** The start of a message's text, for the roster. */
export function messagePreview(message: ChatMessage | undefined): string | undefined {
  if (!message) return undefined;
  const text = message.parts
    .flatMap((part) => (part.type === "text" ? [part.text] : []))
    .join(" ")
    .replace(/\[\d+\]/g, "")
    .replace(/[#*_`>]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return text ? text.slice(0, 140) : undefined;
}

/** Replaces a bot's saved thread. An empty list clears it. */
export async function saveBotThread(botId: string, messages: ChatMessage[]): Promise<void> {
  if (deleted.has(botId)) return;
  const bot = await store().getBot(botId);
  if (!bot) return;
  const now = Date.now();
  const base = now - messages.length;
  const last = [...messages].reverse().find((message) => messagePreview(message));
  const next: Bot = { ...bot, updatedAt: now };
  const preview = messagePreview(last);
  if (preview) next.preview = preview;
  else delete next.preview;
  await store().saveBotThread(
    next,
    messages.map((message, at) => ({
      id: `${botId}:${message.id}`,
      botId,
      // The position in the thread, so the order survives a reload.
      createdAt: base + at,
      message,
    })),
  );
}

const SEEDED = "bots.seeded";

/**
 * Adds the starter bots the first time the Bot section opens. Starters that
 * were deleted stay deleted: the flag is kept in settings.
 */
export function seedBotsOnce(starters: () => NewBot[]): Promise<void> {
  // React runs effects twice in development; seed once per page.
  seeding ??= (async () => {
    if (await store().getSetting(SEEDED)) return;
    await store().putSetting(SEEDED, true);
    if ((await store().listBots()).length > 0) return;
    for (const starter of starters()) await createBot(starter);
  })().catch((error: unknown) => {
    seeding = null;
    throw error;
  });
  return seeding;
}

let seeding: Promise<void> | null = null;

/** Lets tests seed again on a fresh store. */
export function resetBotSeedingForTests() {
  seeding = null;
}
