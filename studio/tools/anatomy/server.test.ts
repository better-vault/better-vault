import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";
import { springScale } from "./example";
import { generateAnatomy, mergeScene } from "./server";

function answering(...texts: string[]) {
  const prompts: string[] = [];
  const model = new MockLanguageModelV4({
    doGenerate: async (options) => {
      prompts.push(JSON.stringify(options.prompt));
      const text = texts[Math.min(prompts.length - 1, texts.length - 1)];
      return {
        content: [{ type: "text", text }],
        finishReason: { unified: "stop", raw: undefined },
        usage: {
          inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
          outputTokens: { total: 1, text: 1, reasoning: undefined },
        },
        warnings: [],
      };
    },
  });
  return { model, prompts };
}

const plan = {
  title: springScale.title,
  object: springScale.object,
  caption: springScale.caption,
  assemblies: springScale.assemblies.map(({ id, name }) => ({ id, name })),
  parts: springScale.parts.map(({ id, name, role, assembly, explanation }) => ({
    id,
    name,
    role,
    assembly,
    explanation,
  })),
  steps: springScale.steps.map(({ title, explanation, readout, focus }) => ({
    title,
    explanation,
    readout,
    focus,
    motion: "",
  })),
};
const build = {
  camera: springScale.camera,
  assemblies: springScale.assemblies.map(({ id, explode }) => ({ id, explode })),
  parts: springScale.parts.map(({ id, geometry }) => ({ id, geometry })),
  steps: springScale.steps.map(({ moves }) => ({ moves })),
};
const floating = {
  ...build,
  parts: build.parts.map((part) =>
    part.id === "dial" && part.geometry.kind === "cylinder"
      ? { ...part, geometry: { ...part.geometry, z: 60 } }
      : part,
  ),
};
const args = { language: "auto", focus: "", passages: [], options: { detail: "simple" as const } };

describe("mergeScene", () => {
  it("puts the design and the geometry back together", () => {
    expect(mergeScene(plan, build)).toEqual(springScale);
  });

  it("leaves out parts without geometry", () => {
    const scene = mergeScene(plan, { ...build, parts: build.parts.slice(1) });
    expect(scene.parts.map((part) => part.id)).not.toContain("base-plate");
  });
});

describe("generateAnatomy", () => {
  it("designs, then builds the figure", async () => {
    const { model, prompts } = answering(JSON.stringify(plan), JSON.stringify(build));
    const result = await generateAnatomy({ ...args, model });
    expect(result.title).toBe("Spring scale");
    expect(result.data.scene.parts).toHaveLength(springScale.parts.length);
    expect(prompts).toHaveLength(2);
  });

  it("sends problems back to the model and keeps the fixed geometry", async () => {
    const { model, prompts } = answering(
      JSON.stringify(plan),
      JSON.stringify(floating),
      JSON.stringify(build),
    );
    const result = await generateAnatomy({ ...args, model });
    expect(prompts).toHaveLength(3);
    expect(prompts[2]).toContain("touches no other part");
    const dial = result.data.scene.parts.find((part) => part.id === "dial")!;
    expect(dial.geometry.kind === "cylinder" && dial.geometry.z).toBe(10);
  });

  it("stops repairing after two tries and keeps the best figure", async () => {
    const { model, prompts } = answering(JSON.stringify(plan), JSON.stringify(floating));
    const result = await generateAnatomy({ ...args, model });
    expect(prompts).toHaveLength(4);
    expect(result.data.scene.parts).toHaveLength(springScale.parts.length);
  });
});
