import type { Bot, BotAccess } from "@/lib/db/types";
import type { BotToolName } from "./tools";

/** What a bot may use when nothing is set: everything, changes after an OK. */
export const fullAccess: BotAccess = {
  notebooks: true,
  notes: "write",
  calendar: "write",
  skills: true,
};

export function botAccess(bot: Pick<Bot, "access">): BotAccess {
  return { ...fullAccess, ...bot.access };
}

export function canCreateBots(bot: Pick<Bot, "canCreateBots" | "canDelegate">): boolean {
  return bot.canCreateBots ?? bot.canDelegate;
}

/**
 * The tools a bot may call. A task handed over by another bot gets no
 * `ask_bot` and no `create_bot`, so bots never pass work, or make bots, in circles.
 */
export function botToolsFor(
  bot: Pick<Bot, "access" | "canDelegate" | "canCreateBots">,
  { handedOver = false }: { handedOver?: boolean } = {},
): BotToolName[] {
  const access = botAccess(bot);
  const tools: BotToolName[] = [];
  if (access.notebooks) tools.push("list_notebooks", "search_sources", "read_source");
  if (access.notes !== "none") tools.push("list_notes", "search_notes", "read_note");
  if (access.notes === "write") tools.push("create_note", "append_to_note");
  if (access.calendar !== "none") tools.push("list_calendar");
  if (access.calendar === "write") tools.push("add_calendar_event");
  if (access.skills) tools.push("list_skills", "read_skill");
  if (!handedOver && bot.canDelegate) tools.push("ask_bot");
  if (!handedOver && canCreateBots(bot)) tools.push("create_bot");
  return tools;
}

/** The areas a bot may use, as summary keys under `access.summary` (bot.json). */
export function accessSummary(access: BotAccess): string[] {
  return [
    ...(access.notebooks ? ["notebooks"] : []),
    ...(access.notes === "write" ? ["notesWrite"] : access.notes === "read" ? ["notes"] : []),
    ...(access.calendar === "write"
      ? ["calendarWrite"]
      : access.calendar === "read"
        ? ["calendar"]
        : []),
    ...(access.skills ? ["skills"] : []),
  ];
}
