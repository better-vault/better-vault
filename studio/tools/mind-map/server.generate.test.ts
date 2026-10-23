import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";
import { generateMindMap } from "./server";

function answering(...texts: string[]) {
  const calls: string[] = [];
  const model = new MockLanguageModelV4({
    doGenerate: async () => {
      const text = texts[Math.min(calls.length, texts.length - 1)];
      calls.push(text);
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
  return { model, calls };
}

const args = { language: "auto", focus: "", passages: [] };
const good = JSON.stringify({ title: "Ventures", mermaid: "mindmap\n  root((Ventures))\n    Ideas\n    Risk" });
const broken = JSON.stringify({ title: "Ventures", mermaid: "mindmap\n  root((Ventures))\n    (((" });

describe("generateMindMap", () => {
  it("returns a valid diagram on the first try", async () => {
    const { model, calls } = answering(good);
    const result = await generateMindMap({ ...args, model, options: { diagram: "mindmap", detail: "concise" } });
    expect(result.title).toBe("Ventures");
    expect(result.data.mermaid.startsWith("mindmap")).toBe(true);
    expect(calls).toHaveLength(1);
  });

  it("asks the model to repair a diagram that does not parse", async () => {
    const { model, calls } = answering(broken, good);
    const result = await generateMindMap({ ...args, model, options: { diagram: "mindmap", detail: "concise" } });
    expect(result.data.mermaid).toContain("Risk");
    expect(calls).toHaveLength(2);
  });

  it("gives up after two repairs", async () => {
    const { model, calls } = answering(broken);
    await expect(
      generateMindMap({ ...args, model, options: { diagram: "mindmap", detail: "concise" } }),
    ).rejects.toThrow(/could not be drawn/);
    expect(calls).toHaveLength(3);
  });
});
