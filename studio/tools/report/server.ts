import { generateText } from "ai";
import { toPassageRefs } from "@/lib/grounding/passages";
import { studioSystem, type Generator } from "@/studio/server/shared";
import type { ReportData, ReportOptions } from "./definition";

const TASKS: Record<Exclude<ReportOptions["template"], "custom">, string> = {
  briefing:
    "Write a briefing document: an overview of the sources' main themes and most important ideas, with key facts, figures and short quotes where they help.",
  "study-guide":
    "Write a study guide: the key concepts with short explanations, a short-answer quiz of 8 to 10 questions with an answer key, 4 or 5 essay questions without answers, and a glossary of key terms.",
  "blog-post":
    "Write an engaging, readable blog post that shares the most insightful takeaways from the sources, with a catchy title.",
};

const FORMAT = `Format it as Markdown. Start with a level-1 heading that names it ("# Title"). Use "##" headings for sections, and lists or tables where they help. After each sentence that uses a passage, cite it with its number in square brackets, like [3].`;

/** Splits "# Title" off the top of the text. */
export function splitTitle(markdown: string, fallback: string): { title: string; body: string } {
  const text = markdown.replace(/^\s*```(?:markdown|md)?\s*\n([\s\S]*?)\n```\s*$/, "$1").trim();
  const match = text.match(/^#\s+(.+?)\s*#*\s*(?:\n|$)/);
  if (!match) return { title: fallback, body: text };
  return { title: match[1].replace(/\[\d+\]/g, "").trim() || fallback, body: text.slice(match[0].length).trim() };
}

export const generateReport: Generator<ReportOptions, ReportData> = async ({ model, options, abortSignal, ...args }) => {
  const task =
    options.template === "custom"
      ? `Write a report the way the user describes it:\n"""${options.instructions.trim() || "A clear overview of the sources."}"""`
      : TASKS[options.template];
  const { text } = await generateText({
    model,
    system: studioSystem(`${task}\n\n${FORMAT}`, args),
    prompt: "Write the report now.",
    abortSignal,
  });
  const { title, body } = splitTitle(text, "Report");
  return { title, data: { markdown: body, passages: toPassageRefs(args.passages) } };
};
