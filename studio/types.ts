import { z } from "zod";
import type { StudioToolId } from "./tools";

/** Options every Studio tool shares, set in the dialog's shared fields. */
export const commonOptionsSchema = z.object({
  /** BCP 47 code of the output language, or "auto" for the sources' language. */
  language: z.string().min(1).max(20),
  /** What the output should be about; empty for everything. */
  focus: z.string().max(4000),
  sourceIds: z.array(z.string()).max(500),
});

export type CommonOptions = z.infer<typeof commonOptionsSchema>;

/** What a tool is, shared by the browser and the server. */
export interface ToolDefinition<Options = unknown, Data = unknown> {
  id: StudioToolId;
  /** The tool's own options and their defaults. */
  options: z.ZodType<Options>;
  defaults: Options;
  /** The shape of a finished output. */
  data: z.ZodType<Data>;
  /** Files the output can be downloaded as; the first is the main one. */
  exports?: ExportOption<Data>[];
}

export type ExportFormat = "docx" | "xlsx" | "csv" | "md" | "svg" | "png" | "mmd";

/** Words written into exported documents, in the UI language. */
export interface ExportText {
  question: string;
  answer: string;
  answerKey: string;
}

export interface ExportOption<Data> {
  format: ExportFormat;
  /** Builds the file in the browser. Heavy libraries are imported inside, only when needed. */
  build: (title: string, data: Data, text: ExportText) => Promise<Blob>;
}

/** A text file as a Blob. */
export const textBlob = (content: string, type: string) => new Blob([content], { type: `${type};charset=utf-8` });

export function defineTool<Options, Data>(definition: ToolDefinition<Options, Data>) {
  return definition;
}

/** How a Studio output's options are saved. */
export interface SavedOptions<Options = unknown> {
  common: CommonOptions;
  tool: Options;
}

/** Any tool, for registries that hold tools of different shapes. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyToolDefinition = ToolDefinition<any, any>;
