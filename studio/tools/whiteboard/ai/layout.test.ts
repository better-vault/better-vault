import { describe, expect, it } from "vitest";
import { boardItemKinds, type BoardItem } from "./schema";
import { answerOrigin, BoardLayout } from "./layout";

const samples: Record<(typeof boardItemKinds)[number], BoardItem> = {
  heading: { kind: "heading", text: "Inside a plant" },
  text: { kind: "text", text: "A plant is built from tissues." },
  list: { kind: "list", items: ["Roots", "Stem"] },
  steps: { kind: "steps", items: ["Roots take in water", "Xylem carries it"] },
  table: { kind: "table", columns: ["Tissue", "Job"], rows: [["Xylem", "Water"]] },
  formula: { kind: "formula", text: "6CO2 + 6H2O → C6H12O6 + 6O2" },
  note: { kind: "note", text: "Remember: xylem up, phloem both ways." },
  flow: { kind: "flow", items: ["Roots", "Stem", "Leaves"] },
  icons: {
    kind: "icons",
    icons: [{ label: "Cell", shapes: [{ type: "circle", points: [50, 50], r: 30 }] }],
  },
};

describe("whiteboard answer layout", () => {
  it("turns every kind of item into strokes and text, one below another", () => {
    const layout = new BoardLayout(0, 0);
    let bottom = 0;
    for (const kind of boardItemKinds) {
      const ops = layout.place(samples[kind]);
      expect(ops.length, kind).toBeGreaterThan(0);
      const top = Math.min(...ops.map((op) => op.element.y));
      expect(top, kind).toBeGreaterThanOrEqual(bottom - 1);
      bottom = Math.max(...ops.map((op) => op.element.y + op.element.height));
    }
  });

  it("draws a flow as boxes, words and arrows", () => {
    const ops = new BoardLayout(0, 0).place(samples.flow);
    expect(ops.filter((op) => op.kind === "text")).toHaveLength(3);
    // Three boxes and two arrows of two strokes each.
    expect(ops.filter((op) => op.kind === "stroke")).toHaveLength(7);
  });

  it("anchors right-to-left writing at its right edge", () => {
    const ops = new BoardLayout(0, 0).place({ kind: "text", text: "التنفس الخلوي" });
    const [first] = ops;
    expect(first.kind === "text" && first.element.align).toBe("end");
  });

  it("puts an answer beside what is on the board, or at the view's corner", () => {
    expect(answerOrigin([], [5, 6])).toEqual([5, 6]);
    expect(answerOrigin([{ x: 0, y: 10, width: 100, height: 20 }], [5, 6])).toEqual([260, 10]);
  });
});
