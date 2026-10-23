import { render } from "pele";
import type { MindMapData } from "./definition";
import { mindMapSvg, parseMindmap } from "./tree";

/** Pele's drawing of the Mermaid source. Links and images are off: the code comes from a model. */
export function renderDiagram(mermaid: string): { svg: string; width: number; height: number } | { error: string } {
  try {
    const result = render(mermaid, { links: false, images: false, responsive: false });
    return { svg: result.svg, width: result.width, height: result.height };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

/** The output as a standalone image: the tree for a mind map, Pele's drawing for the rest. */
export async function exportSvg(data: MindMapData): Promise<{ svg: string; width: number; height: number }> {
  if (data.diagram === "mindmap") {
    const root = parseMindmap(data.mermaid);
    if (root) {
      const { pageFont, textMeasurer } = await import("./measure");
      return mindMapSvg(root, textMeasurer(600), pageFont());
    }
  }
  const drawn = renderDiagram(data.mermaid);
  if ("error" in drawn) throw new Error(drawn.error);
  // A white backdrop, so the image reads the same in any viewer.
  const svg = drawn.svg.replace(/^<svg([^>]*)>/, `<svg$1><rect width="100%" height="100%" fill="#ffffff"/>`);
  return { svg, width: drawn.width, height: drawn.height };
}
