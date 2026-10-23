import { z } from "zod";
import { amounts, difficulties } from "@/studio/tools/flashcards/definition";
import { defineTool } from "@/studio/types";

export const quizOptions = z.object({
  amount: z.enum(amounts),
  difficulty: z.enum(difficulties),
});

export const quizQuestion = z.object({
  question: z.string(),
  options: z.array(z.string()),
  /** Index of the right option. */
  answer: z.number().int(),
  explanation: z.string(),
  hint: z.string(),
});

export const quizData = z.object({ questions: z.array(quizQuestion) });

export type QuizOptions = z.infer<typeof quizOptions>;
export type QuizQuestion = z.infer<typeof quizQuestion>;
export type QuizData = z.infer<typeof quizData>;

export const quizCounts = { fewer: 5, standard: 10, more: 20 } as const;

const LETTERS = "ABCDEFGH";

export const quizTool = defineTool({
  id: "quiz",
  options: quizOptions,
  defaults: { amount: "standard", difficulty: "medium" } satisfies QuizOptions,
  data: quizData,
  download: (title, data) => ({
    content: [
      `# ${title}`,
      ...data.questions.map((q, at) =>
        [
          `## ${at + 1}. ${q.question}`,
          ...q.options.map((option, i) => `- ${LETTERS[i]}. ${option}`),
          "",
          `**Answer:** ${LETTERS[q.answer]}. ${q.options[q.answer] ?? ""}`,
          "",
          q.explanation,
        ].join("\n"),
      ),
    ].join("\n\n"),
    extension: "md",
    type: "text/markdown",
  }),
});
