import { z } from "zod";
import { csvRow } from "@/studio/csv";
import { defineTool } from "@/studio/types";

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
  // Two columns, front and back: imports into Anki and most flashcard apps.
  download: (_title, data) => ({
    content: data.cards.map((card) => csvRow([card.front, card.back])).join("\n"),
    extension: "csv",
    type: "text/csv",
  }),
});
