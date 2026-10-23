import { describe, expect, it } from "vitest";
import { diagramKinds } from "./definition";
import { cleanMermaid, diagramProblem } from "./server";
import { diagramSyntax } from "./syntax";

describe("diagram syntax examples", () => {
  it.each(diagramKinds)("the %s example draws with Pele", (kind) => {
    expect(diagramProblem(diagramSyntax[kind].example, kind)).toBeNull();
  });
});

describe("diagramProblem", () => {
  it("rejects the wrong kind of diagram", () => {
    expect(diagramProblem(diagramSyntax.flowchart.example, "mindmap")).toMatch(/must start with "mindmap"/);
  });

  it("reports parse errors", () => {
    expect(diagramProblem("mindmap\n  root((A))\n    (((", "mindmap")).toMatch(/Parse error/);
  });
});

describe("cleanMermaid", () => {
  it("removes code fences", () => {
    expect(cleanMermaid("```mermaid\nmindmap\n  root((A))\n```")).toBe("mindmap\n  root((A))");
  });
});
