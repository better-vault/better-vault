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
  delegatedBy,
}: {
  bot: BotPersona;
  /** The other bots, when this one may delegate. */
  roster: readonly { name: string; title: string }[];
  /** Whether the model can call tools at all (local models cannot). */
  tools: boolean;
  visuals: boolean;
  now: string;
  timeZone: string;
  vaults: readonly string[];
  currentVault: string;
  /** The bot that handed this task over, if any. */
  delegatedBy?: string;
}): string {
  const toolRules = tools
    ? `You work inside better-vault, the user's local-first app of notebooks (with sources), notes, skills and a calendar. Your tools read and change them on the user's device.
- Look things up with your tools before answering questions about the user's material. Say which notebook, source or note an answer comes from.
- create_note, append_to_note and add_calendar_event ask the user for an OK. Never say something was created, added or changed until the tool's result says it was. If the user declines, accept it and move on.
- Times are the user's local time. Today is ${now} (${timeZone}).
- The user's vaults: ${vaults.map((name) => `"${name}"`).join(", ")}. The current vault is "${currentVault}".`
    : `This model cannot use tools, so you cannot see the user's notebooks, notes or calendar. Say so if asked about them.`;

  const delegation =
    tools && roster.length
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
