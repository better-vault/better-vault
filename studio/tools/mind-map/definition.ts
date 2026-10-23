import { z } from "zod";
import { defineTool } from "@/studio/types";

/** Diagram kinds offered, all rendered by Pele from Mermaid text. */
export const diagramKinds = [
  "mindmap",
  "flowchart",
  "timeline",
  "sequence",
  "state",
  "class",
  "er",
  "quadrant",
  "journey",
  "ishikawa",
  "kanban",
  "gantt",
] as const;

export type DiagramKind = (typeof diagramKinds)[number];

export const details = ["concise", "standard", "detailed"] as const;

export const mindMapOptions = z.object({
  diagram: z.enum(diagramKinds),
  detail: z.enum(details),
});

export const mindMapData = z.object({
  diagram: z.enum(diagramKinds),
  mermaid: z.string(),
});

export type MindMapOptions = z.infer<typeof mindMapOptions>;
export type MindMapData = z.infer<typeof mindMapData>;

export const mindMapTool = defineTool({
  id: "mind-map",
  options: mindMapOptions,
  defaults: { diagram: "mindmap", detail: "standard" } satisfies MindMapOptions,
  data: mindMapData,
  download: (_title, data) => ({ content: data.mermaid, extension: "mmd", type: "text/plain" }),
});
