import { generateText } from "ai";
import { toPassageRefs } from "@/lib/grounding/passages";
import { studioSystem, type Generator } from "@/studio/server/shared";
import type { ReportData, ReportOptions } from "./definition";

const TASKS: Record<Exclude<ReportOptions["template"], "custom">, string> = {
  briefing: `Write a briefing document for someone who needs to understand the sources quickly.
Structure:
- Open with a short paragraph on what the sources are about and why it matters.
- "## Key takeaways": 4 to 7 bullets, each a full sentence with its key term in **bold**.
- One "##" section per main theme, with "###" sub-sections where useful: the important facts, figures, names and examples, and short direct quotes as "> " blockquotes.
- "## Summary": a closing paragraph.`,
  "study-guide": `Write a study guide that helps a student learn the material.
Structure:
- Open with an engaging introduction (a question or a striking fact from the sources), then "**Learning objectives:**" as 3 to 5 bullets that start with a verb in bold, such as "**Define** …".
- "## Key concepts": each concept under a "###" heading, with a clear explanation and an example from the sources.
- "## Short-answer quiz": 8 to 10 numbered questions.
- "## Answer key": the answers, numbered the same way.
- "## Essay questions": 4 or 5 questions, without answers.
- "## Glossary": a Markdown table with the columns Term and Definition.`,
  "blog-post": `Write an engaging blog post for a general audience.
Structure:
- A catchy title, and a hook in the first paragraph.
- "##" sections with concrete takeaways, short paragraphs and lists where they help.
- One or two striking quotes as "> " blockquotes.
- A short conclusion with a takeaway for the reader.`,
};

const LENGTH: Record<ReportOptions["length"], string> = {
  short: "Keep it short: about 500 to 800 words.",
  standard: "Aim for about 1,200 to 1,800 words.",
  long: "Be thorough: about 2,500 to 3,500 words, covering every important point in the sources.",
};

const FORMAT = `Write in Markdown. Start with a level-1 heading that names the document ("# Title"). Use "##" for sections and "###" for sub-sections, **bold** for key terms and figures, and lists or tables where they make things clearer. After each sentence that uses a passage, cite it with its number in square brackets, like [3].`;

/** Splits "# Title" off the top of the text. */
export function splitTitle(markdown: string, fallback: string): { title: string; body: string } {
  const text = markdown.replace(/^\s*```(?:markdown|md)?\s*\n([\s\S]*?)\n```\s*$/, "$1").trim();
  const match = text.match(/^#\s+(.+?)\s*#*\s*(?:\n|$)/);
  if (!match) return { title: fallback, body: text };
  return {
    title: match[1].replace(/\[\d+\]/g, "").trim() || fallback,
    body: text.slice(match[0].length).trim(),
  };
}

export const generateReport: Generator<ReportOptions, ReportData> = async ({
  model,
  options,
  abortSignal,
  ...args
}) => {
  const task =
    options.template === "custom"
      ? `Write the document the user describes:\n"""${options.instructions.trim() || "A clear overview of the sources."}"""\nUnless they ask for something else, give it sections with "##" headings and end with a short summary.`
      : TASKS[options.template];
  const { text } = await generateText({
    model,
    system: studioSystem(`${task}\n\n${LENGTH[options.length]}\n\n${FORMAT}`, args),
    prompt: "Write the document now.",
    abortSignal,
  });
  const { title, body } = splitTitle(text, "Report");
  return { title, data: { markdown: body, passages: toPassageRefs(args.passages) } };
};
