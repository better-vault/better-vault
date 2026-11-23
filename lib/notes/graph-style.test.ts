import { describe, expect, it } from "vitest";
import type { GraphNode } from "./graph";
import { builtInGraphStyles, graphStyleSchema, radialLayout } from "./graph-style";

const node = (id: string, degree = 1): GraphNode => ({ id, kind: "note", label: id, vaultId: "v", degree });

describe("graph styles", () => {
  it("fills in a partial style, and refuses colours that could escape", () => {
    expect(graphStyleSchema.parse({ layout: "radial" }).link.width).toBe(1);
    expect(builtInGraphStyles.constellation.layout).toBe("radial");
    expect(graphStyleSchema.safeParse({ node: { color: "red;}" } }).success).toBe(false);
  });

  it("lays notes out as rings around the hub, with every note placed", () => {
    const nodes = [node("hub", 3), node("a"), node("b"), node("c"), node("loose", 0)];
    const edges = [
      { source: "hub", target: "a" },
      { source: "hub", target: "b" },
      { source: "a", target: "c" },
    ];
    const positions = radialLayout(nodes, edges, null, 100);
    expect(positions.size).toBe(5);
    expect(positions.get("hub")).toMatchObject({ x: 0, y: 0, depth: 0 });
    expect(positions.get("c")?.depth).toBe(2);
    expect(positions.get("c")?.parent).toBe("a");
    expect(positions.get("loose")?.parent).toBe("hub");
    const distance = (id: string) => Math.hypot(positions.get(id)!.x, positions.get(id)!.y);
    expect(distance("c")).toBeGreaterThan(distance("a"));
  });
});
