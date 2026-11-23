import type { Bot, BotAccess } from "@/lib/db/types";
import type { BotToolName } from "./tools";

/** What a bot may use when nothing is set: everything, changes after an OK. */
export const fullAccess: BotAccess = {
  notebooks: true,
  notes: "write",
  calendar: "write",
  skills: "write",
};

const level = (value: unknown, fallback: BotAccess["skills"]): BotAccess["skills"] =>
  value === "none" || value === "read" || value === "write"
    ? value
    : value === true
      ? "write"
      : value === false
        ? "none"
        : fallback;

/** A bot's access, with defaults for what isn't set and old saved values read as today's. */
export function botAccess(bot: Pick<Bot, "access">): BotAccess {
  const access = { ...fullAccess, ...bot.access };
  return { ...access, skills: level(access.skills as unknown, fullAccess.skills) };
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
  // Any bot may offer to make a file; it is kept only once the user approves it.
  const tools: BotToolName[] = ["create_file"];
  if (access.notebooks) tools.push("list_notebooks", "search_sources", "read_source");
  if (access.notes !== "none") tools.push("list_notes", "search_notes", "read_note");
  if (access.notes === "write") tools.push("create_note", "append_to_note");
  if (access.calendar !== "none") tools.push("list_calendar");
  if (access.calendar === "write") tools.push("add_calendar_event");
  if (access.skills !== "none") tools.push("list_skills", "read_skill", "find_skills");
  if (access.skills === "write") tools.push("add_skills", "create_skill");
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
    ...(access.skills === "write" ? ["skillsWrite"] : access.skills === "read" ? ["skills"] : []),
  ];
}
