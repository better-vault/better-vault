import { z } from "zod";

/**
 * Generative UI for chat answers, in the spirit of json-render: the model
 * never writes HTML or code for the page, only data for one of these kinds,
 * each drawn by a component of the app's own (components/chat/visual). Each
 * kind is its own tool, `show_<kind>`, with a plain object schema every
 * provider accepts. The schemas are shared by the server (the tools) and the
 * browser (checking what it draws).
 */
const title = z.string().min(1).max(120).describe("A short title shown above the visual");
const short = (max = 200) => z.string().max(max);

export const visualSchemas = {
  diagram: z.object({
    title,
    mermaid: z
      .string()
      .max(6000)
      .describe(
        "Mermaid source: flowchart, sequenceDiagram, mindmap, timeline, classDiagram, stateDiagram or erDiagram. Quote labels that contain punctuation.",
      ),
  }),
  table: z.object({
    title,
    columns: z.array(short(60)).min(1).max(8),
    rows: z
      .array(z.array(short(300)).max(8))
      .min(1)
      .max(40),
  }),
  chart: z.object({
    title,
    type: z.enum(["bar", "line", "pie"]),
    unit: short(20).optional().describe("The unit of the values, such as % or km"),
    labels: z.array(short(40)).min(1).max(24).describe("The category or x-axis labels"),
    series: z
      .array(z.object({ name: short(40), values: z.array(z.number()).min(1).max(24) }))
      .min(1)
      .max(5)
      .describe("One series for a pie; one value per label in each series"),
  }),
  timeline: z.object({
    title,
    items: z
      .array(z.object({ when: short(40), title: short(120), detail: short(300).optional() }))
      .min(2)
      .max(20),
  }),
  steps: z.object({
    title,
    steps: z
      .array(z.object({ title: short(120), detail: short(400).optional() }))
      .min(2)
      .max(12),
  }),
  comparison: z.object({
    title,
    columns: z
      .array(z.object({ name: short(60), points: z.array(short(200)).min(1).max(8) }))
      .min(2)
      .max(4),
  }),
  facts: z.object({
    title,
    facts: z
      .array(z.object({ label: short(60), value: short(40), detail: short(160).optional() }))
      .min(2)
      .max(8),
  }),
  flashcards: z.object({
    title,
    cards: z
      .array(z.object({ front: short(300), back: short(600) }))
      .min(2)
      .max(20),
  }),
} as const;

export type VisualKind = keyof typeof visualSchemas;
export const visualKinds = Object.keys(visualSchemas) as VisualKind[];
export type VisualInput<K extends VisualKind> = z.infer<(typeof visualSchemas)[K]>;

export const visualToolName = (kind: VisualKind) => `show_${kind}` as const;
export function visualKindOf(toolName: string): VisualKind | null {
  const kind = toolName.startsWith("show_") ? toolName.slice(5) : "";
  return (visualKinds as string[]).includes(kind) ? (kind as VisualKind) : null;
}

export const visualDescriptions: Record<VisualKind, string> = {
  diagram: "Show a diagram (Mermaid) of a process, structure, flow or relationships.",
  table: "Show a table to compare items across several attributes or list structured data.",
  chart: "Show a bar, line or pie chart of numbers from the sources.",
  timeline: "Show a timeline of dated events in order.",
  steps: "Show numbered steps of a procedure or method.",
  comparison: "Show two to four options side by side with their points.",
  facts: "Show a few key figures or facts as tiles.",
  flashcards: "Show flashcards to help the user study the answer.",
};

/** What the model is told about visuals in the system prompt. */
export const VISUALS_PROMPT = `You can show visuals in your answer with the show_* tools (diagram, table, chart, timeline, steps, comparison, facts, flashcards). Use one when it explains better than text: a process or structure (diagram or steps), a comparison (table or comparison), numbers (chart or facts), dates (timeline), or when the user wants to study (flashcards). Long answers usually deserve one. Do not show a visual for short or simple answers, and show at most two per answer. Write a sentence or two of text around each visual. Visuals take only facts from the passages; keep [n] citations in your text, not in visuals.`;
