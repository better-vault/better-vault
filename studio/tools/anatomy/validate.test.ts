import { describe, expect, it } from "vitest";
import { springScale } from "./example";
import type { Part, Scene } from "./scene";
import { sceneProblems, tidyScene } from "./validate";

const withParts = (parts: Part[], extra: Partial<Scene> = {}): Scene => ({
  ...springScale,
  parts,
  ...extra,
});
const box = (
  id: string,
  x: number,
  y: number,
  z: number,
  w: number,
  d: number,
  h: number,
): Part => ({
  id,
  name: id,
  role: "structure",
  assembly: "base",
  explanation: "",
  geometry: { kind: "box", x, y, z, w, d, h, corner: 0, details: [] },
});

describe("sceneProblems", () => {
  it("finds nothing wrong with the example", () => {
    expect(sceneProblems(tidyScene(springScale))).toEqual([]);
  });

  it("finds a part that floats", () => {
    const problems = sceneProblems(
      withParts([box("plate", -100, -50, 0, 200, 100, 10), box("lid", 0, 0, 40, 20, 20, 5)]),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/"lid" \(lid\) touches no other part/);
  });

  it("finds solids inside each other", () => {
    const problems = sceneProblems(
      withParts([box("plate", -100, -50, 0, 200, 100, 10), box("block", -90, -40, 2, 40, 40, 20)]),
    );
    expect(problems.some((problem) => problem.includes("fill the same space"))).toBe(true);
  });

  it("lets a slender post run through a block", () => {
    const post: Part = {
      ...box("post", 0, 0, 0, 0, 0, 0),
      geometry: { kind: "cylinder", x: 0, y: 0, z: 10, radius: 2, h: 60, details: [] },
    };
    const problems = sceneProblems(
      withParts([
        box("plate", -100, -50, 0, 200, 100, 10),
        box("clamp", -6, -6, 30, 12, 12, 10),
        post,
      ]),
    );
    expect(problems).toEqual([]);
  });

  it("asks for a sensible overall size", () => {
    const problems = sceneProblems(withParts([box("plate", 0, 0, 0, 2000, 100, 10)]));
    expect(problems.some((problem) => problem.includes("scale every part"))).toBe(true);
  });
});

describe("tidyScene", () => {
  it("brings a part down onto the part just under it", () => {
    const scene = tidyScene(
      withParts([box("plate", -100, -50, 0, 200, 100, 10), box("block", 0, 0, 11.5, 20, 20, 10)]),
    );
    const block = scene.parts.find((part) => part.id === "block")!;
    expect(block.geometry.kind === "box" && block.geometry.z).toBe(10);
    expect(sceneProblems(scene)).toEqual([]);
  });

  it("makes ids unique and keeps the steps pointing at them", () => {
    const scene = tidyScene(
      withParts(
        [
          box("Base Plate", -100, -50, 0, 200, 100, 10),
          box("Base Plate", -10, -10, 10, 20, 20, 10),
        ],
        {
          steps: [
            {
              title: "",
              explanation: "",
              readout: "",
              focus: ["Base Plate", "missing"],
              moves: [],
            },
          ],
        },
      ),
    );
    expect(scene.parts.map((part) => part.id)).toEqual(["base-plate", "base-plate-2"]);
    expect(scene.steps[0].focus).toEqual(["base-plate"]);
  });

  it("puts parts of unknown assemblies in one, and adds a step when there is none", () => {
    const scene = tidyScene(
      withParts([{ ...box("plate", 0, 0, 0, 100, 100, 10), assembly: "nowhere" }], {
        assemblies: [],
        steps: [],
      }),
    );
    expect(scene.parts[0].assembly).toBe("main");
    expect(scene.assemblies.map((assembly) => assembly.id)).toEqual(["main"]);
    expect(scene.steps).toHaveLength(1);
  });
});
