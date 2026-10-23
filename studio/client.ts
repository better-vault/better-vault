import type { ComponentType } from "react";
import type { ToolFormProps, ToolViewerProps } from "./shared/form";
import type { StudioToolId } from "./tools";
import { DataTableForm } from "./tools/data-table/dialog";
import { DataTableViewer } from "./tools/data-table/viewer";
import { FlashcardsForm } from "./tools/flashcards/dialog";
import { FlashcardsViewer } from "./tools/flashcards/viewer";
import { MindMapForm } from "./tools/mind-map/dialog";
import { MindMapViewer } from "./tools/mind-map/viewer";
import { QuizForm } from "./tools/quiz/dialog";
import { QuizViewer } from "./tools/quiz/viewer";
import { ReportForm } from "./tools/report/dialog";
import { ReportViewer } from "./tools/report/viewer";

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface ToolClient {
  Form: ComponentType<ToolFormProps<any>>;
  Viewer: ComponentType<ToolViewerProps<any>>;
  /** Wider dialogs for tools with grids of cards. */
  wide?: boolean;
  /** Viewers that fill the height of the Studio tab. */
  fill?: boolean;
  /** Viewers that use a wider page, e.g. a document with its table of contents. */
  wideViewer?: boolean;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** How each available tool looks in the browser: its dialog form and its viewer. */
export const toolClients: Partial<Record<StudioToolId, ToolClient>> = {
  report: { Form: ReportForm, Viewer: ReportViewer, wide: true, wideViewer: true },
  flashcards: { Form: FlashcardsForm, Viewer: FlashcardsViewer },
  quiz: { Form: QuizForm, Viewer: QuizViewer },
  "data-table": { Form: DataTableForm, Viewer: DataTableViewer },
  "mind-map": { Form: MindMapForm, Viewer: MindMapViewer, wide: true, fill: true },
};
