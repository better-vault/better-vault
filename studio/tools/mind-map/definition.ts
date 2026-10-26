import { z } from "zod";
import { defineTool, textBlob } from "@/studio/types";

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
  exports: [
    {
      format: "png",
      build: async (_title, data) => {
        const [{ exportSvg }, { svgToPng }] = await Promise.all([
          import("./render"),
          import("@/studio/exports/image"),
        ]);
        const image = await exportSvg(data);
        return svgToPng(image.svg, image.width, image.height);
      },
    },
    {
      format: "svg",
      build: async (_title, data) => {
        const { exportSvg } = await import("./render");
        return textBlob((await exportSvg(data)).svg, "image/svg+xml");
      },
    },
    { format: "mmd", build: async (_title, data) => textBlob(data.mermaid, "text/plain") },
  ],
});
