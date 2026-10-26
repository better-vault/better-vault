import { generateText, Output } from "ai";
import { render } from "pele";
import { z } from "zod";
import { clean, studioSystem, type Generator } from "@/studio/server/shared";
import type { DiagramKind, MindMapData, MindMapOptions } from "./definition";
import { DETAIL, diagramSyntax } from "./syntax";

const schema = z.object({
  title: z.string().describe("A short title for the diagram"),
  mermaid: z.string().describe("The Mermaid source code only, without ``` fences"),
});

const RULES = `Rules for the Mermaid code:
- Follow the example's syntax exactly, including indentation.
- Keep labels short (at most about 6 words) and plain: no quotes, brackets, parentheses, colons or semicolons inside a label unless the syntax needs them.
- Write only the Mermaid code in the "mermaid" field, with no \`\`\` fences and no explanation.`;

/** Removes code fences and stray whitespace around the Mermaid source. */
export function cleanMermaid(source: string): string {
  return source
    .replace(/^\s*```(?:mermaid)?\s*\n?/i, "")
    .replace(/\n?```\s*$/, "")
    .replace(/\r\n?/g, "\n")
    .trim();
}

/** Why Pele cannot draw this source as the asked kind of diagram, or null when it can. */
export function diagramProblem(source: string, kind: DiagramKind): string | null {
  const firstLine =
    source
      .split("\n")
      .find((line) => line.trim() && !line.trim().startsWith("%%"))
      ?.trim() ?? "";
  if (!diagramSyntax[kind].header.test(firstLine)) {
    return `The code must start with "${diagramSyntax[kind].example.split("\n")[0]}".`;
  }
  try {
    render(source, { links: false, images: false });
    return null;
  } catch (error) {
    return error instanceof Error ? error.message.slice(0, 600) : String(error);
  }
}

const REPAIRS = 2;

export const generateMindMap: Generator<MindMapOptions, MindMapData> = async ({
  model,
  options,
  abortSignal,
  ...args
}) => {
  const syntax = diagramSyntax[options.diagram];
  const system = studioSystem(
    `Draw ${syntax.purpose} of the sources, as Mermaid code. ${DETAIL[options.detail]}\n\nExample of the syntax:\n${syntax.example}\n\n${RULES}`,
    args,
  );

  let { output } = await generateText({
    model,
    output: Output.object({ schema }),
    system,
    prompt: "Draw the diagram now.",
    abortSignal,
  });
  let mermaid = cleanMermaid(output.mermaid);

  for (let attempt = 0; ; attempt++) {
    const problem = diagramProblem(mermaid, options.diagram);
    if (!problem) break;
    if (attempt >= REPAIRS) throw new Error(`The model's diagram could not be drawn: ${problem}`);
    ({ output } = await generateText({
      model,
      output: Output.object({ schema }),
      system,
      prompt: `This Mermaid code could not be drawn:\n\n${mermaid}\n\nError: ${problem}\n\nFix it and return the whole corrected diagram.`,
      abortSignal,
    }));
    mermaid = cleanMermaid(output.mermaid);
  }

  return { title: clean(output.title) || "Diagram", data: { diagram: options.diagram, mermaid } };
};
