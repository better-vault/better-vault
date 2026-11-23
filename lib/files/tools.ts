import { z } from "zod";

/**
 * `create_file`: the AI makes a file and keeps it in the vault. Declared on
 * the server (chat and bot routes) without `execute`; the page builds the
 * file and saves it after the user's OK (lib/files/build.ts).
 */
export const fileFormats = [
  "pdf",
  "docx",
  "xlsx",
  "pptx",
  "csv",
  "md",
  "html",
  "txt",
  "json",
] as const;
export type FileFormat = (typeof fileFormats)[number];

const sheet = z.object({
  name: z.string().max(31).describe("The sheet's name"),
  rows: z
    .array(z.array(z.union([z.string(), z.number(), z.boolean(), z.null()])))
    .max(5000)
    .describe("Rows of cells; the first row is the header"),
});

const slide = z.object({
  title: z.string(),
  bullets: z.array(z.string()).max(12).default([]),
  notes: z.string().optional().describe("Speaker notes"),
});

export const createFileInput = z.object({
  format: z.enum(fileFormats).describe("The kind of file to make"),
  name: z
    .string()
    .min(1)
    .max(120)
    .describe("The file name without its extension, e.g. 'Plant cell summary'"),
  title: z.string().max(200).optional().describe("A title shown at the top of documents"),
  markdown: z
    .string()
    .max(200_000)
    .optional()
    .describe(
      "The content for pdf, docx, md, html and txt: GitHub Markdown with headings, lists, tables and code",
    ),
  sheets: z
    .array(sheet)
    .max(20)
    .optional()
    .describe("The content for xlsx (one or more sheets) and csv (the first sheet only)"),
  slides: z.array(slide).max(60).optional().describe("The content for pptx"),
  json: z.string().max(200_000).optional().describe("The content for json, as JSON text"),
  folder: z
    .string()
    .max(200)
    .optional()
    .describe(
      "A folder of the current vault to keep it in, by name; the vault's top level if left out",
    ),
});

export type CreateFileInput = z.infer<typeof createFileInput>;

export const createFileDescription =
  "Make a file of the user's choosing (PDF, Word, Excel, PowerPoint, CSV, Markdown, HTML, text or JSON) and save it in their vault. Use it when the user asks for a file, a document, a spreadsheet or slides. Fill `markdown` for documents, `sheets` for spreadsheets and CSV, `slides` for presentations and `json` for JSON. The user approves it first; afterwards say what you made.";

/** What the tool returns to the model once the file is saved, or why it isn't. */
export type CreateFileOutput =
  | { ok: true; fileId: string; name: string; size: number }
  | { ok: false; declined?: true; error?: string };
