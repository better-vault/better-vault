import type { StudioToolId } from "@/studio/tools";
import { generateAnatomy } from "@/studio/tools/anatomy/server";
import { generateDataTable } from "@/studio/tools/data-table/server";
import { generateFlashcards } from "@/studio/tools/flashcards/server";
import { generateInfographic } from "@/studio/tools/infographic/server";
import { generateMindMap } from "@/studio/tools/mind-map/server";
import { generateQuiz } from "@/studio/tools/quiz/server";
import { generateReport } from "@/studio/tools/report/server";
import { generateSlideDeck } from "@/studio/tools/slide-deck/server";
import type { Generator } from "./shared";

/** How each available tool is generated on the server. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const generators: Partial<Record<StudioToolId, Generator<any, any>>> = {
  report: generateReport,
  flashcards: generateFlashcards,
  quiz: generateQuiz,
  "data-table": generateDataTable,
  "mind-map": generateMindMap,
  anatomy: generateAnatomy,
  "slide-deck": generateSlideDeck,
  infographic: generateInfographic,
};
