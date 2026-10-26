import { z } from "zod";
import { csvRow } from "@/studio/csv";
import { defineTool, textBlob } from "@/studio/types";

export const amounts = ["fewer", "standard", "more"] as const;
export const difficulties = ["easy", "medium", "hard"] as const;

export const flashcardsOptions = z.object({
  amount: z.enum(amounts),
  difficulty: z.enum(difficulties),
});

export const flashcardsData = z.object({
  cards: z.array(z.object({ front: z.string(), back: z.string() })),
});

export type FlashcardsOptions = z.infer<typeof flashcardsOptions>;
export type FlashcardsData = z.infer<typeof flashcardsData>;

export const flashcardCounts = { fewer: 10, standard: 20, more: 35 } as const;

export const flashcardsTool = defineTool({
  id: "flashcards",
  options: flashcardsOptions,
  defaults: { amount: "standard", difficulty: "medium" } satisfies FlashcardsOptions,
  data: flashcardsData,
  exports: [
    {
      format: "docx",
      build: async (title, data, text) => {
        const {
          isRightToLeft,
          wordDocument,
          Paragraph,
          ShadingType,
          Table,
          TableCell,
          TableRow,
          TextRun,
          WidthType,
        } = await import("@/studio/exports/docx");
        const rtl = isRightToLeft(data.cards.map((card) => card.front).join(" "));
        const cell = (value: string, header = false) =>
          new TableCell({
            shading: header ? { type: ShadingType.CLEAR, fill: "EFEFEF" } : undefined,
            children: [
              new Paragraph({
                bidirectional: rtl,
                children: [new TextRun({ text: value, bold: header })],
              }),
            ],
          });
        const table = new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          visuallyRightToLeft: rtl,
          rows: [
            new TableRow({
              tableHeader: true,
              children: [cell(text.question, true), cell(text.answer, true)],
            }),
            ...data.cards.map(
              (card) => new TableRow({ children: [cell(card.front), cell(card.back)] }),
            ),
          ],
        });
        return wordDocument({ title, rtl, children: [table] });
      },
    },
    {
      // Two columns, front and back: imports into Anki and most flashcard apps.
      format: "csv",
      build: async (_title, data) =>
        textBlob(data.cards.map((card) => csvRow([card.front, card.back])).join("\n"), "text/csv"),
    },
  ],
});
