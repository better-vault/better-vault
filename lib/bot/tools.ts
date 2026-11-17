import { z } from "zod";

/**
 * The tools a bot can call. The server only declares them: the user's data
 * lives on their device, so the page runs each call (`lib/bot/run-tool.ts`)
 * and sends the result back. Reads run at once; writes wait for the user's
 * OK in the thread; `ask_bot` hands a task to another bot.
 */
export const botToolSchemas = {
  list_notebooks: z.object({
    vault: z.string().optional().describe("Vault name, to list only that vault's notebooks"),
  }),
  search_sources: z.object({
    query: z.string().min(1).describe("What to look for"),
    notebookId: z.string().optional().describe("Only this notebook's sources"),
  }),
  read_source: z.object({ sourceId: z.string() }),
  list_notes: z.object({
    vault: z.string().optional().describe("Vault name, to list only that vault's notes"),
  }),
  search_notes: z.object({ query: z.string().min(1) }),
  read_note: z.object({
    id: z.string().optional(),
    title: z.string().optional().describe("The note's title, when the id is not known"),
  }),
  list_calendar: z.object({
    from: z.string().describe("First day, YYYY-MM-DD"),
    to: z.string().describe("Last day, YYYY-MM-DD (inclusive)"),
  }),
  list_skills: z.object({}),
  read_skill: z.object({ name: z.string() }),
  create_note: z.object({
    title: z.string().min(1).max(200),
    body: z
      .string()
      .max(100_000)
      .describe("Markdown. [[Note]] links, #tags and - [ ] tasks work as in Obsidian."),
    vault: z.string().optional().describe("Vault name; the current vault when left out"),
  }),
  append_to_note: z.object({
    id: z.string().optional(),
    title: z.string().optional().describe("The note's title, when the id is not known"),
    text: z.string().min(1).max(50_000).describe("Markdown to add at the end of the note"),
  }),
  add_calendar_event: z.object({
    title: z.string().min(1).max(200),
    start: z
      .string()
      .describe(
        "Local start: YYYY-MM-DDTHH:mm for a timed event, or YYYY-MM-DD for an all-day one",
      ),
    end: z
      .string()
      .optional()
      .describe("Local end in the same form. Timed: one hour after start when left out."),
    description: z.string().max(4000).optional(),
    location: z.string().max(200).optional(),
  }),
  ask_bot: z.object({
    bot: z.string().describe("The other bot's name, exactly as listed"),
    task: z
      .string()
      .min(1)
      .max(8000)
      .describe("What it should do, with every detail it needs; it cannot see this thread"),
  }),
} as const;

export type BotToolName = keyof typeof botToolSchemas;
export type BotToolInput<Name extends BotToolName> = z.infer<(typeof botToolSchemas)[Name]>;

export const botToolDescriptions: Record<BotToolName, string> = {
  list_notebooks: "List the user's notebooks with their sources (id, title, kind).",
  search_sources:
    "Find the passages of the notebooks' sources that best match a question. Searches every notebook unless notebookId is given.",
  read_source: "Read a source's full text (long sources are cut).",
  list_notes: "List the user's notes (id, title, vault, folder, tags).",
  search_notes: "Find notes whose title, text or tags contain every word of the query.",
  read_note: "Read a note by id or by title.",
  list_calendar: "List the calendar's events between two days.",
  list_skills: "List the user's skills (reusable instructions) with their descriptions.",
  read_skill: "Read a skill's instructions by name.",
  create_note:
    "Create a note. The user is asked to approve it first; until the result comes back, it has not been made.",
  append_to_note: "Add text to the end of an existing note. The user is asked to approve it first.",
  add_calendar_event: "Add an event to the user's calendar. The user is asked to approve it first.",
  ask_bot:
    "Hand a task to another of the user's bots and get its answer. Use it when the task fits that bot's role better than yours.",
};

/** Tools that change the user's data: they wait for the user's OK. */
export const botWriteTools = new Set<BotToolName>([
  "create_note",
  "append_to_note",
  "add_calendar_event",
]);

export const botToolNames = Object.keys(botToolSchemas) as BotToolName[];

export function isBotTool(name: string): name is BotToolName {
  return name in botToolSchemas;
}
