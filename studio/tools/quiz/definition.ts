import { z } from "zod";
import { amounts, difficulties } from "@/studio/tools/flashcards/definition";
import { defineTool, textBlob } from "@/studio/types";

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
  exports: [
    {
      format: "docx",
      build: async (title, data, text) => {
        const { HeadingLevel, isRightToLeft, Paragraph, TextRun, wordDocument } =
          await import("@/studio/exports/docx");
        const rtl = isRightToLeft(data.questions.map((q) => q.question).join(" "));
        const questions = data.questions.flatMap((q, at) => [
          new Paragraph({
            bidirectional: rtl,
            spacing: { before: 240 },
            children: [new TextRun({ text: `${at + 1}. ${q.question}`, bold: true })],
          }),
          ...q.options.map(
            (option, i) =>
              new Paragraph({
                bidirectional: rtl,
                indent: { start: 360 },
                children: [new TextRun(`${LETTERS[i]}. ${option}`)],
              }),
          ),
        ]);
        const key = [
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            pageBreakBefore: true,
            bidirectional: rtl,
            children: [new TextRun(text.answerKey)],
          }),
          ...data.questions.flatMap((q, at) => [
            new Paragraph({
              bidirectional: rtl,
              children: [
                new TextRun({
                  text: `${at + 1}. ${LETTERS[q.answer]}. ${q.options[q.answer] ?? ""}`,
                  bold: true,
                }),
              ],
            }),
            new Paragraph({
              bidirectional: rtl,
              indent: { start: 360 },
              children: [new TextRun(q.explanation)],
            }),
          ]),
        ];
        return wordDocument({ title, rtl, children: [...questions, ...key] });
      },
    },
    {
      format: "md",
      build: async (title, data, text) =>
        textBlob(
          [
            `# ${title}`,
            ...data.questions.map((q, at) =>
              [
                `## ${at + 1}. ${q.question}`,
                ...q.options.map((option, i) => `- ${LETTERS[i]}. ${option}`),
              ].join("\n"),
            ),
            `## ${text.answerKey}`,
            ...data.questions.map(
              (q, at) => `${at + 1}. **${LETTERS[q.answer]}.** ${q.explanation}`,
            ),
          ].join("\n\n"),
          "text/markdown",
        ),
    },
  ],
});
