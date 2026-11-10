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
