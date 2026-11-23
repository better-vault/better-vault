import { z } from "zod";
import { boardColors } from "../schema";

/**
 * What "Ask AI" on the whiteboard asks the model for: a board's worth of
 * explanation, as a list of items a teacher would write and draw, top to
 * bottom. The page lays them out and writes them by hand (ai/animator.ts).
 * Fields are flat (one shape for every kind), which every provider handles.
 */

export const boardItemKinds = [
  "heading",
  "text",
  "list",
  "steps",
  "table",
  "formula",
  "note",
  "flow",
  "icons",
  "sources",
] as const;
export type BoardItemKind = (typeof boardItemKinds)[number];

const color = z.enum(boardColors).optional().describe("A colour name; ink when left out");

const shape = z.object({
  type: z.enum(["circle", "line", "rect", "dot"]),
  /** For a line, x,y pairs in a 100 × 100 box; for a rect, x,y,width,height; for a circle or dot, cx,cy. */
  points: z.array(z.number()).max(40),
  r: z.number().optional().describe("Radius, for a circle"),
  color,
});

export const boardItem = z.object({
  kind: z.enum(boardItemKinds),
  text: z.string().max(600).optional().describe("heading, text, formula and note: what to write"),
  items: z
    .array(z.string().max(200))
    .max(12)
    .optional()
    .describe(
      "list and steps: the lines; flow: the boxes, in order; sources: where facts came from",
    ),
  columns: z.array(z.string().max(60)).max(5).optional().describe("table: the header"),
  rows: z
    .array(z.array(z.string().max(120)).max(5))
    .max(10)
    .optional()
    .describe("table: the rows, as many cells as columns"),
  icons: z
    .array(
      z.object({
        label: z.string().max(40),
        shapes: z.array(shape).max(10),
      }),
    )
    .max(5)
    .optional()
    .describe("icons: small drawings in a row, each a few shapes in a 100 × 100 box"),
  color,
});

export type BoardItem = z.infer<typeof boardItem>;
export type IconShape = z.infer<typeof shape>;

export const whiteboardPrompt = `You explain things on a whiteboard, like a good teacher with a marker.
Answer the question as a short board: a list of items, written top to bottom.

Items:
- heading: one short title. Start with exactly one heading.
- text: one or two short sentences. No paragraphs.
- list: 2–6 short bullet lines.
- steps: 2–6 short numbered steps, for a process.
- table: a small comparison: 2–4 columns, 2–6 rows, a few words per cell.
- formula: an equation or formula in plain text, e.g. "6CO2 + 6H2O → C6H12O6 + 6O2".
- note: one key idea to remember, boxed.
- flow: 2–5 short boxes joined by arrows, for a chain of causes or stages.
- sources: last, when you looked things up: 1–4 short "Site – page title" lines.
- icons: 2–4 small drawings with a label each, to make ideas visual. Draw each with 2–8 simple shapes in a 100 × 100 box (circles, lines, rects, dots), in colour.

Rules:
- 4 to 9 items. Mix kinds: a board with only text is a bad board.
- Write in the language of the question. Keep every line short; it is a board, not an essay.
- Colours: ink for most writing, and blue, green, red, amber or violet to highlight.
- Use what you know; be correct.
- When the user selected something, answer about that: explain it, extend it, or do what they ask with it.`;

/** Added when the model has its provider's web search. */
export const webRules = `You can search the web. Search when the question needs facts you aren't sure of, recent information, or numbers; then end the board with a sources item naming where they came from. Don't search for simple, well-known things.`;
