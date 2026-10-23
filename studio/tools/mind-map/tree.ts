/** A mind map as a tree, read from Mermaid `mindmap` text. */
export interface MindNode {
  /** Its path from the root, e.g. "0.2.1": stable while branches open and close. */
  id: string;
  label: string;
  children: MindNode[];
}

/** The text of a Mermaid mindmap node: `root((Text))`, `id[Text]`, `id(Text)`, `id{{Text}}`, or plain text. */
export function nodeLabel(line: string): string {
  let text = line.trim().replace(/:::[\w-]+\s*$/, "").trim();
  const shaped = text.match(/^[^\s([{)]*?(\(\(|\)\)|\{\{|\(|\)|\[)([\s\S]*?)(\)\)|\(\(|\}\}|\)|\(|\])$/);
  if (shaped) text = shaped[2];
  return text.replace(/^["'`]+|["'`]+$/g, "").replace(/\s+/g, " ").trim();
}

/** Reads Mermaid `mindmap` source into a tree, by indentation. Returns null if there is no root. */
export function parseMindmap(source: string): MindNode | null {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const start = lines.findIndex((line) => /^\s*mindmap\b/.test(line));
  const stack: { indent: number; node: MindNode }[] = [];
  let root: MindNode | null = null;
  for (const raw of lines.slice(start + 1)) {
    if (!raw.trim() || raw.trim().startsWith("%%") || raw.trim().startsWith("::icon")) continue;
    const indent = raw.match(/^[ \t]*/)![0].replace(/\t/g, "    ").length;
    const label = nodeLabel(raw);
    if (!label) continue;
    while (stack.length > 0 && stack[stack.length - 1].indent >= indent) stack.pop();
    const parent = stack.at(-1)?.node;
    if (!parent) {
      if (root) continue; // A second root is not valid Mermaid; ignore it.
      root = { id: "0", label, children: [] };
      stack.push({ indent, node: root });
      continue;
    }
    const node: MindNode = { id: `${parent.id}.${parent.children.length}`, label, children: [] };
    parent.children.push(node);
    stack.push({ indent, node });
  }
  return root;
}

/** Every node that has children: the set that shows the whole map. */
export function branchIds(root: MindNode): Set<string> {
  const ids = new Set<string>();
  const walk = (node: MindNode) => {
    if (node.children.length > 0) ids.add(node.id);
    node.children.forEach(walk);
  };
  walk(root);
  return ids;
}

/** The labels from the root down to a node, for asking about it in context. */
export function pathTo(root: MindNode, id: string): string[] {
  const out: string[] = [];
  let node: MindNode | undefined = root;
  const steps = id.split(".").slice(1).map(Number);
  out.push(root.label);
  for (const step of steps) {
    node = node?.children[step];
    if (node) out.push(node.label);
  }
  return out;
}

export const NODE_HEIGHT = 44;
export const TOGGLE = 22;
const TOGGLE_GAP = 8;
const GAP_X = 52;
const GAP_Y = 18;
export const PAD_X = 16;
export const MAX_NODE_WIDTH = 480;

export interface PlacedNode {
  node: MindNode;
  depth: number;
  x: number;
  y: number;
  width: number;
  expanded: boolean;
}

export interface Edge {
  id: string;
  /** The SVG path from the parent's toggle to the child. */
  d: string;
  depth: number;
}

export interface Layout {
  nodes: PlacedNode[];
  edges: Edge[];
  width: number;
  height: number;
}

/**
 * Lays the open part of the tree out from left to right: each node centred
 * on its children, siblings stacked with a gap, curves from each parent's
 * toggle to its children.
 */
export function layoutTree(root: MindNode, expanded: ReadonlySet<string>, measure: (text: string) => number): Layout {
  const widthOf = (node: MindNode) => Math.min(MAX_NODE_WIDTH, Math.max(56, Math.ceil(measure(node.label)) + PAD_X * 2));
  const open = (node: MindNode) => expanded.has(node.id) && node.children.length > 0;
  const heights = new Map<string, number>();
  const heightOf = (node: MindNode): number => {
    const known = heights.get(node.id);
    if (known !== undefined) return known;
    const height = open(node)
      ? Math.max(NODE_HEIGHT, node.children.reduce((sum, child) => sum + heightOf(child), 0) + GAP_Y * (node.children.length - 1))
      : NODE_HEIGHT;
    heights.set(node.id, height);
    return height;
  };

  const nodes: PlacedNode[] = [];
  const edges: Edge[] = [];
  let right = 0;

  const place = (node: MindNode, x: number, top: number, depth: number) => {
    const height = heightOf(node);
    const width = widthOf(node);
    const centre = top + height / 2;
    nodes.push({ node, depth, x, y: centre - NODE_HEIGHT / 2, width, expanded: open(node) });
    right = Math.max(right, x + width + (node.children.length > 0 ? TOGGLE_GAP + TOGGLE : 0));
    if (!open(node)) return;
    const fromX = x + width + TOGGLE_GAP + TOGGLE;
    const childX = fromX + GAP_X;
    const span = node.children.reduce((sum, child) => sum + heightOf(child), 0) + GAP_Y * (node.children.length - 1);
    let cursor = top + (height - span) / 2;
    for (const child of node.children) {
      const childHeight = heightOf(child);
      const childCentre = cursor + childHeight / 2;
      const bend = GAP_X * 0.55;
      edges.push({
        id: child.id,
        depth: depth + 1,
        d: `M ${fromX} ${centre} C ${fromX + bend} ${centre}, ${childX - bend} ${childCentre}, ${childX} ${childCentre}`,
      });
      place(child, childX, cursor, depth + 1);
      cursor += childHeight + GAP_Y;
    }
  };

  place(root, 0, 0, 0);
  return { nodes, edges, width: right, height: heightOf(root) };
}

/** Light colours for exported images, from Panel's chart ramp. */
const EXPORT_COLOURS = ["#8b5cf6", "#3b82f6", "#10b981", "#f59e0b"];

const escapeXml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The whole map as a standalone SVG image. */
export function mindMapSvg(root: MindNode, measure: (text: string) => number, font: string): { svg: string; width: number; height: number } {
  const layout = layoutTree(root, branchIds(root), measure);
  const margin = 24;
  const width = Math.ceil(layout.width + margin * 2);
  const height = Math.ceil(layout.height + margin * 2);
  const colour = (depth: number) => EXPORT_COLOURS[depth % EXPORT_COLOURS.length];
  const edges = layout.edges
    .map((edge) => `<path d="${edge.d}" fill="none" stroke="${colour(edge.depth)}" stroke-opacity="0.55" stroke-width="1.6"/>`)
    .join("");
  const nodes = layout.nodes
    .map(({ node, depth, x, y, width: w }) => {
      const label = node.label.length > 60 ? `${node.label.slice(0, 57)}…` : node.label;
      return `<g transform="translate(${x} ${y})"><rect width="${w}" height="${NODE_HEIGHT}" rx="12" fill="${colour(depth)}" fill-opacity="0.16" stroke="${colour(depth)}" stroke-opacity="0.45"/><text x="${PAD_X}" y="${NODE_HEIGHT / 2}" dominant-baseline="central" font-size="15" font-weight="${depth === 0 ? 600 : 500}" fill="#262626">${escapeXml(label)}</text></g>`;
    })
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="${escapeXml(font)}"><rect width="100%" height="100%" fill="#ffffff"/><g transform="translate(${margin} ${margin})">${edges}${nodes}</g></svg>`;
  return { svg, width, height };
}
