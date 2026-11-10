import { z } from "zod";
import { defineTool, textBlob } from "@/studio/types";
import { canvasData, emptyCanvas } from "./schema";

/** The canvas: cards and arrows made in the browser, saved in the JSON Canvas format. */
export const canvasTool = defineTool({
  id: "canvas",
  options: z.object({}),
  defaults: {},
  data: canvasData,
  local: { blank: emptyCanvas },
  exports: [
    {
      format: "canvas",
      build: async (_title, data) =>
        textBlob(
          JSON.stringify({ nodes: data.nodes, edges: data.edges }, null, 2),
          "application/json",
        ),
    },
  ],
});
