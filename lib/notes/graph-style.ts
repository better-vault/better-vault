import { useSyncExternalStore } from "react";
import { graphStyleSchema, type GraphStyle } from "@/lib/plugins/manifest";
import type { GraphEdge, GraphNode } from "./graph";

export { graphStyleSchema, type GraphStyle };

/**
 * How the graph view looks: its layout, and how nodes, links and labels are
 * drawn. "Classic" is the force layout; "Constellation" grows the notes as a
 * radial tree around a hub, with thin curved branches and small labels. A
 * plugin may add its own style (contributes.graph); the user picks one in
 * Settings → Appearance or in the graph's toolbar. Colours are theme tokens
 * (a name such as "chart-4") or, from plugins, plain colours.
 */
export const builtInGraphStyles = {
  classic: graphStyleSchema.parse({}),
  constellation: graphStyleSchema.parse({
    layout: "radial",
    node: { color: "chart-4", size: 0.8, hubRing: true },
    link: { color: "muted-foreground", width: 0.6, opacity: 0.55, curved: true },
    label: { font: "mono", color: "muted-foreground", uppercase: true, size: 10 },
  }),
} as const;
export type BuiltInGraphStyle = keyof typeof builtInGraphStyles;

/** A colour as CSS: a token name becomes its variable's value; plain colours stay. */
export function resolveColour(value: string, read: (token: string) => string): string {
  return /^[a-z][a-z0-9-]*$/.test(value) ? read(value) : value;
}

// ---- The chosen style, remembered on this device.

const KEY = "better-vault:graph-style";
const CHANGE = "better-vault:graph-style-change";

export function readGraphStyle(): string {
  try {
    return window.localStorage.getItem(KEY) ?? "classic";
  } catch {
    return "classic";
  }
}

export function setGraphStyle(id: string) {
  try {
    window.localStorage.setItem(KEY, id);
  } catch {
    // Storage can be blocked; the choice then lasts for this page only.
  }
  window.dispatchEvent(new Event(CHANGE));
}

const subscribe = (listener: () => void) => {
  window.addEventListener(CHANGE, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(CHANGE, listener);
    window.removeEventListener("storage", listener);
  };
};

/** The chosen style's id: "classic", "constellation", or "plugin-id/style-id". */
export function useGraphStyleId(): string {
  return useSyncExternalStore(subscribe, readGraphStyle, () => "classic");
}

// ---- The radial layout.

export type Positions = Map<string, { x: number; y: number; depth: number; parent: string | null }>;

/**
 * Lays the graph out as a radial tree, like a dendrogram: a hub in the
 * middle, its neighbours on the first ring, theirs further out, each branch
 * given an arc in proportion to how much hangs from it. Notes not linked to
 * the hub's part hang from the hub too, so everything is drawn.
 */
export function radialLayout(
  nodes: readonly GraphNode[],
  edges: readonly GraphEdge[],
  hubId: string | null,
  ring = 110,
): Positions {
  const positions: Positions = new Map();
  if (nodes.length === 0) return positions;
  const neighbours = new Map<string, string[]>();
  for (const { source, target } of edges) {
    neighbours.set(source, [...(neighbours.get(source) ?? []), target]);
    neighbours.set(target, [...(neighbours.get(target) ?? []), source]);
  }
  const byDegree = [...nodes].sort((a, b) => b.degree - a.degree || a.label.localeCompare(b.label));
  const hub = nodes.find((node) => node.id === hubId) ?? byDegree[0];

  // A spanning tree by breadth-first search; other parts hang from the hub.
  const children = new Map<string, string[]>();
  const parent = new Map<string, string | null>([[hub.id, null]]);
  const depth = new Map<string, number>([[hub.id, 0]]);
  const visit = (start: string, from: string | null) => {
    parent.set(start, from);
    depth.set(start, from === null ? 0 : (depth.get(from) ?? 0) + 1);
    if (from) children.set(from, [...(children.get(from) ?? []), start]);
    const queue = [start];
    while (queue.length) {
      const current = queue.shift()!;
      for (const next of (neighbours.get(current) ?? []).sort()) {
        if (parent.has(next)) continue;
        parent.set(next, current);
        depth.set(next, (depth.get(current) ?? 0) + 1);
        children.set(current, [...(children.get(current) ?? []), next]);
        queue.push(next);
      }
    }
  };
  visit(hub.id, null);
  for (const node of byDegree) if (!parent.has(node.id)) visit(node.id, hub.id);

  // Each branch gets an arc as wide as the leaves under it.
  const leaves = new Map<string, number>();
  const count = (id: string): number => {
    const kids = children.get(id) ?? [];
    const total = kids.length ? kids.reduce((sum, kid) => sum + count(kid), 0) : 1;
    leaves.set(id, total);
    return total;
  };
  count(hub.id);
  const place = (id: string, from: number, to: number) => {
    const level = depth.get(id) ?? 0;
    const angle = (from + to) / 2;
    // Rings get closer together further out, so wide trees stay compact.
    const radius = level === 0 ? 0 : ring * (level + Math.log1p(level) * 0.6);
    positions.set(id, {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
      depth: level,
      parent: parent.get(id) ?? null,
    });
    let start = from;
    const kids = children.get(id) ?? [];
    const total = leaves.get(id) ?? 1;
    for (const kid of kids) {
      const share = ((to - from) * (leaves.get(kid) ?? 1)) / total;
      place(kid, start, start + share);
      start += share;
    }
  };
  place(hub.id, -Math.PI / 2, Math.PI * 1.5);
  return positions;
}
