import { tool, type ToolSet } from "ai";
import { renderDiagram } from "@/studio/tools/mind-map/render";
import { visualDescriptions, visualKinds, visualSchemas, visualToolName } from "@/lib/chat/visuals";

/**
 * The show_* tools of generative UI. They draw nothing on the server: the
 * browser draws their input. A diagram's Mermaid is checked with Pele first,
 * and an error goes back to the model to fix, as for Studio mind maps.
 */
export function createVisualTools(): ToolSet {
  return Object.fromEntries(
    visualKinds.map((kind) => [
      visualToolName(kind),
      tool({
        description: visualDescriptions[kind],
        inputSchema: visualSchemas[kind],
        execute: async (input: unknown) => {
          if (kind === "diagram") {
            const drawn = renderDiagram((input as { mermaid: string }).mermaid);
            if ("error" in drawn)
              return {
                ok: false,
                error: `The Mermaid did not parse: ${drawn.error}. Call show_diagram again with fixed Mermaid.`,
              };
          }
          return { ok: true };
        },
      }),
    ]),
  );
}
