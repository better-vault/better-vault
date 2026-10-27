import type { ComponentType } from "react";
import type { ToolFormProps, ToolViewerProps } from "./shared/form";
import type { StudioToolId } from "./tools";
import { AnatomyForm } from "./tools/anatomy/dialog";
import { AnatomyViewer } from "./tools/anatomy/viewer";
import { DataTableForm } from "./tools/data-table/dialog";
import { DataTableViewer } from "./tools/data-table/viewer";
import { FlashcardsForm } from "./tools/flashcards/dialog";
import { FlashcardsViewer } from "./tools/flashcards/viewer";
import { InfographicForm } from "./tools/infographic/dialog";
import { InfographicViewer } from "./tools/infographic/viewer";
import { MindMapForm } from "./tools/mind-map/dialog";
import { MindMapViewer } from "./tools/mind-map/viewer";
import { QuizForm } from "./tools/quiz/dialog";
import { QuizViewer } from "./tools/quiz/viewer";
import { ReportForm } from "./tools/report/dialog";
import { ReportViewer } from "./tools/report/viewer";
import { SlideDeckForm } from "./tools/slide-deck/dialog";
import { SlideDeckViewer } from "./tools/slide-deck/viewer";

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface ToolClient {
  /** The tool's own fields in its dialog. Local tools have no dialog. */
  Form?: ComponentType<ToolFormProps<any>>;
  Viewer: ComponentType<ToolViewerProps<any>>;
  /** Whether these options are complete enough to create the output. */
  canCreate?: (options: any) => boolean;
  /** Viewers that run edge to edge, with no page margin or width limit. */
  bleed?: boolean;
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
  report: {
    Form: ReportForm,
    Viewer: ReportViewer,
    wide: true,
    wideViewer: true,
    // "Create your own" needs a description.
    canCreate: (options: { template: string; instructions: string }) =>
      options.template !== "custom" || options.instructions.trim() !== "",
  },
  flashcards: { Form: FlashcardsForm, Viewer: FlashcardsViewer },
  quiz: { Form: QuizForm, Viewer: QuizViewer },
  "data-table": { Form: DataTableForm, Viewer: DataTableViewer },
  "mind-map": { Form: MindMapForm, Viewer: MindMapViewer, wide: true, fill: true },
  anatomy: { Form: AnatomyForm, Viewer: AnatomyViewer, fill: true },
  "slide-deck": { Form: SlideDeckForm, Viewer: SlideDeckViewer, wide: true, fill: true },
  infographic: {
    Form: InfographicForm,
    Viewer: InfographicViewer,
    wide: true,
    fill: true,
    canCreate: (options: { imageModel: unknown }) => options.imageModel !== null,
  },
};
