import { describe, expect, it } from "vitest";
import { chatSystemPrompt } from "@/lib/ai/prompts";
import { visualKindOf, visualKinds, visualSchemas, visualToolName } from "./visuals";

describe("chat visuals", () => {
  it("maps tool names to kinds and back", () => {
    for (const kind of visualKinds) expect(visualKindOf(visualToolName(kind))).toBe(kind);
    expect(visualKindOf("web_search")).toBeNull();
  });

  it("accepts a chart and refuses a malformed one", () => {
    const chart = {
      title: "Sales",
      type: "bar",
      labels: ["Q1", "Q2"],
      series: [{ name: "2026", values: [3, 5] }],
    };
    expect(visualSchemas.chart.safeParse(chart).success).toBe(true);
    expect(visualSchemas.chart.safeParse({ ...chart, type: "radar" }).success).toBe(false);
  });

  it("tells the model about visuals and attached skills only when given", () => {
    const plain = chatSystemPrompt("sources", []);
    expect(plain).not.toContain("show_*");
    const rich = chatSystemPrompt("sources", [], {
      visuals: true,
      skills: [{ name: "brief", description: "Short answers", body: "Use three bullets." }],
    });
    expect(rich).toContain("show_*");
    expect(rich).toContain('<skill name="brief">');
    expect(rich).toContain("Use three bullets.");
  });
});
