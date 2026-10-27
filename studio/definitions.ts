import type { StudioToolId } from "./tools";
import { anatomyTool } from "./tools/anatomy/definition";
import { dataTableTool } from "./tools/data-table/definition";
import { flashcardsTool } from "./tools/flashcards/definition";
import { infographicTool } from "./tools/infographic/definition";
import { mindMapTool } from "./tools/mind-map/definition";
import { quizTool } from "./tools/quiz/definition";
import { reportTool } from "./tools/report/definition";
import { slideDeckTool } from "./tools/slide-deck/definition";
import type { AnyToolDefinition } from "./types";

/** The tools that can be used in this version, shared by the browser and the server. */
export const toolDefinitions: Partial<Record<StudioToolId, AnyToolDefinition>> = {
  report: reportTool,
  flashcards: flashcardsTool,
  quiz: quizTool,
  "data-table": dataTableTool,
  "mind-map": mindMapTool,
  anatomy: anatomyTool,
  "slide-deck": slideDeckTool,
  infographic: infographicTool,
};
