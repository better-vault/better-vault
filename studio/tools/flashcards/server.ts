import { generateText, Output } from "ai";
import { z } from "zod";
import { clean, studioSystem, type Generator } from "@/studio/server/shared";
import { flashcardCounts, type FlashcardsData, type FlashcardsOptions } from "./definition";

const LEVEL = {
  easy: "Ask about the main ideas and basic definitions.",
  medium: "Mix main ideas with important details, causes and examples.",
  hard: "Ask about subtle details, relationships between ideas, and applying them.",
};

const schema = z.object({
  title: z.string().describe("A short title for the set"),
  cards: z.array(
    z.object({
      front: z.string().describe("A question or term, at most about 15 words"),
      back: z.string().describe("The answer, one to three sentences"),
    }),
  ),
});

export const generateFlashcards: Generator<FlashcardsOptions, FlashcardsData> = async ({
  model,
  options,
  abortSignal,
  ...args
}) => {
  const count = flashcardCounts[options.amount];
  const { output } = await generateText({
    model,
    output: Output.object({ schema }),
    system: studioSystem(
      `Create ${count} flashcards for studying the sources. ${LEVEL[options.difficulty]} Each card has a short front (a question or a term) and a concise back. Do not repeat a card.`,
      args,
    ),
    prompt: `Create the ${count} flashcards now.`,
    abortSignal,
  });
  const seen = new Set<string>();
  const cards = output.cards
    .map((card) => ({ front: clean(card.front), back: clean(card.back) }))
    .filter(
      (card) =>
        card.front &&
        card.back &&
        !seen.has(card.front.toLowerCase()) &&
        seen.add(card.front.toLowerCase()),
    )
    .slice(0, count + 5);
  if (cards.length === 0) throw new Error("The model returned no flashcards.");
  return { title: clean(output.title) || "Flashcards", data: { cards } };
};
