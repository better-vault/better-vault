import { describe, expect, it } from "vitest";
import { branchIds, layoutTree, mindMapSvg, nodeLabel, parseMindmap, pathTo } from "./tree";

const source = `mindmap
  root((Entrepreneurship))
    Opportunity
      Ideas
      Market needs
    Risk[Risk and reward]
      Capital
    "Growth"
`;

const measure = (text: string) => text.length * 8;

describe("nodeLabel", () => {
  it.each([
    ["root((Main topic))", "Main topic"],
    ["id[Square]", "Square"],
    ["id(Rounded)", "Rounded"],
    ["id{{Hexagon}}", "Hexagon"],
    ["id))Bang((", "Bang"],
    ["Plain text", "Plain text"],
    ["Styled:::urgent", "Styled"],
  ])("%s → %s", (line, label) => {
    expect(nodeLabel(line)).toBe(label);
  });
});

describe("parseMindmap", () => {
  it("builds the tree by indentation with path ids", () => {
    const root = parseMindmap(source)!;
    expect(root.label).toBe("Entrepreneurship");
    expect(root.children.map((child) => child.label)).toEqual(["Opportunity", "Risk and reward", "Growth"]);
    expect(root.children[0].children.map((child) => [child.id, child.label])).toEqual([
      ["0.0.0", "Ideas"],
      ["0.0.1", "Market needs"],
    ]);
  });

  it("returns null without a root", () => {
    expect(parseMindmap("mindmap\n")).toBeNull();
  });

  it("finds branches and paths", () => {
    const root = parseMindmap(source)!;
    expect([...branchIds(root)].sort()).toEqual(["0", "0.0", "0.1"]);
    expect(pathTo(root, "0.1.0")).toEqual(["Entrepreneurship", "Risk and reward", "Capital"]);
  });
});

describe("layoutTree", () => {
  const root = parseMindmap(source)!;

  it("shows only the open branches", () => {
    const closed = layoutTree(root, new Set(["0"]), measure);
    expect(closed.nodes.map((placed) => placed.node.id)).toEqual(["0", "0.0", "0.1", "0.2"]);
    expect(closed.edges).toHaveLength(3);
    const open = layoutTree(root, branchIds(root), measure);
    expect(open.nodes).toHaveLength(7);
  });

  it("puts children to the right and centres a parent on them", () => {
    const layout = layoutTree(root, new Set(["0"]), measure);
    const [parent, ...children] = layout.nodes;
    for (const child of children) expect(child.x).toBeGreaterThan(parent.x + parent.width);
    const centre = (placed: (typeof children)[number]) => placed.y + 22;
    expect(centre(parent)).toBeCloseTo((centre(children[0]) + centre(children[2])) / 2);
  });

  it("never overlaps siblings", () => {
    const layout = layoutTree(root, branchIds(root), measure);
    const sameColumn = layout.nodes.filter((placed) => placed.depth === 2).sort((a, b) => a.y - b.y);
    for (let i = 1; i < sameColumn.length; i++) expect(sameColumn[i].y).toBeGreaterThanOrEqual(sameColumn[i - 1].y + 44);
  });
});

describe("mindMapSvg", () => {
  it("draws every node and escapes labels", () => {
    const root = parseMindmap("mindmap\n  root((A & B))\n    <C>")!;
    const { svg } = mindMapSvg(root, measure, "sans-serif");
    expect(svg).toContain("A &amp; B");
    expect(svg).toContain("&lt;C&gt;");
    expect(svg.match(/<rect /g)?.length).toBe(3);
  });
});
