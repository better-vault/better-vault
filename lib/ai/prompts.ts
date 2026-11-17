import type { ChatMode } from "@/lib/chat/types";
import { VISUALS_PROMPT } from "@/lib/chat/visuals";
import { formatPassages, type Passage } from "@/lib/grounding/passages";

const STYLE = `Write in the language of the user's latest message. Use Markdown: short paragraphs, lists where they help, and **bold** for key terms. Do not start with a heading unless asked.`;

export interface ChatSkill {
  name: string;
  description: string;
  body: string;
}

/** The instructions for a chat turn, with the notebook's passages, the skills chosen and whether visuals may be shown. */
export function chatSystemPrompt(
  mode: ChatMode,
  passages: readonly Passage[],
  { skills = [], visuals = false }: { skills?: readonly ChatSkill[]; visuals?: boolean } = {},
): string {
  const rules =
    mode === "sources"
      ? `Answer using ONLY the numbered passages from the notebook's sources below.
- After each sentence that uses a passage, cite it with its number in square brackets, for example [3]. Cite several as [2][5]. Only use numbers that appear below.
- If the passages do not contain the answer, say so plainly and suggest what source could help. Do not use outside knowledge.`
      : `Use the numbered passages from the notebook's sources below when they help, and cite them with their number in square brackets, for example [3].
- When the question needs current or outside information, search the web with your web search tool. Web results are shown to the user automatically, so do not cite them with [n].`;

  const empty =
    passages.length === 0
      ? mode === "sources"
        ? "\nThe notebook has no selected sources. Tell the user to add or select a source, or switch to Web."
        : "\nThe notebook has no selected sources; rely on web search."
      : "";

  const skillText = skills.length
    ? `\n\nThe user attached these skills. Follow their instructions where they apply:\n${skills
        .map(
          (skill) =>
            `<skill name="${skill.name}">\n${skill.description ? `${skill.description}\n\n` : ""}${skill.body}\n</skill>`,
        )
        .join("\n")}`
    : "";

  return `You are better-vault, a research assistant inside the user's notebook.
${rules}${empty}
${STYLE}${visuals ? `\n${VISUALS_PROMPT}` : ""}${skillText}

${formatPassages(passages)}`;
}

export interface BotPersona {
  name: string;
  title: string;
  instructions: string;
}

/** The instructions for a bot's turn: its persona, the user's vault and the bots it may ask. */
export function botSystemPrompt({
  bot,
  roster,
  tools,
  visuals,
  now,
  timeZone,
  vaults,
  currentVault,
  scopeVault,
  delegatedBy,
}: {
  bot: BotPersona;
  /** The other bots, when this one may delegate. */
  roster: readonly { name: string; title: string }[];
  /** The tools it may call, or null when the model cannot call tools (local models). */
  tools: readonly string[] | null;
  visuals: boolean;
  now: string;
  timeZone: string;
  vaults: readonly string[];
  currentVault: string;
  /** The one vault it may use, if it is limited to one. */
  scopeVault?: string;
  /** The bot that handed this task over, if any. */
  delegatedBy?: string;
}): string {
  const has = (name: string) => tools?.includes(name) ?? false;
  const areas = [
    ["notebooks and their sources", has("search_sources")],
    [has("create_note") ? "notes (read and write)" : "notes (read only)", has("read_note")],
    [
      has("add_calendar_event") ? "the calendar (read and add events)" : "the calendar (read only)",
      has("list_calendar"),
    ],
    ["skills", has("read_skill")],
  ] as const;
  const can = areas.filter(([, on]) => on).map(([area]) => area);
  const cannot = [
    ...(has("search_sources") ? [] : ["notebooks and sources"]),
    ...(has("read_note") ? [] : ["notes"]),
    ...(has("list_calendar") ? [] : ["the calendar"]),
    ...(has("read_skill") ? [] : ["skills"]),
  ];
  const toolRules = tools
    ? `You work inside better-vault, the user's local-first app of notebooks (with sources), notes, skills and a calendar. Your tools read and change them on the user's device.
- You may use: ${can.length ? can.join(", ") : "none of the user's material"}.${cannot.length ? ` You have no access to ${cannot.join(", ")}: if asked about them, say so and that the user can turn access on in Edit bot (the menu at the top right of this chat).` : ""}
- Look things up with your tools before answering questions about the user's material. Say which notebook, source or note an answer comes from.
- Changes (new notes, additions to notes, calendar events, new bots) ask the user for an OK. Never say something was created, added or changed until the tool's result says it was. If the user declines, accept it and move on.
- ${has("create_bot") ? "When the user asks for a bot, make it with create_bot: a clear name and role, instructions that describe the job, a fitting shape and colour, and only the access the job needs." : "You cannot make bots. If the user asks for one, tell them to press + at the top of the bot list, or to ask a bot that can make bots, such as Chief of Staff."}
- Times are the user's local time. Today is ${now} (${timeZone}).
- ${scopeVault ? `You may only use the vault "${scopeVault}".` : `The user's vaults: ${vaults.map((name) => `"${name}"`).join(", ")}. The current vault is "${currentVault}".`}`
    : `This model cannot use tools, so you cannot see the user's notebooks, notes or calendar. Say so if asked about them.`;

  const delegation =
    has("ask_bot") && roster.length
      ? `\n\nYou coordinate the user's other bots. Hand a task to one with ask_bot when it fits its role better than yours; give it every detail, since it cannot see this thread. You may ask several in turn. Then tell the user, briefly, what each one did.\n${roster
          .map((each) => `- ${each.name}: ${each.title}`)
          .join("\n")}`
      : "";

  const handedOver = delegatedBy
    ? `\n\n${delegatedBy}, another of the user's bots, handed you the latest task. Do it, then answer with what you did or found; your answer goes back to ${delegatedBy}.`
    : "";

  return `You are ${bot.name}, one of the user's bots in better-vault.${bot.title ? ` Your role: ${bot.title}.` : ""}
${bot.instructions.trim()}

${toolRules}${delegation}${handedOver}
${STYLE} Keep answers short: lead with the result.${visuals ? `\n${VISUALS_PROMPT}` : ""}`;
}
