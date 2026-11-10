import type { Note } from "@/lib/db/types";
import { resolveLink, type LinkWorld } from "./resolve";

export type GraphNodeKind = "note" | "missing" | "notebook" | "source" | "tag";

export interface GraphNode {
  id: string;
  kind: GraphNodeKind;
  label: string;
  /** The vault it is drawn in (its colour). Tags and missing notes have none. */
  vaultId: string | null;
  /** How many links touch it; bigger nodes have more. */
  degree: number;
}

export interface GraphEdge {
  source: string;
  target: string;
}

export interface GraphOptions {
  /** Only these vaults' notes, or every vault when null. */
  vaults: string[] | null;
  showTags: boolean;
  showOrphans: boolean;
  /** Notebooks and sources that notes link to. */
  showSources: boolean;
  /** A local graph around this note, to this many links away; null for the whole graph. */
  around: { noteId: string; depth: number } | null;
}

/** Notes, what they link to and (optionally) their tags, as nodes and edges. */
export function buildGraph(
  world: LinkWorld,
  options: GraphOptions,
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodes = new Map<string, GraphNode>();
  const edges = new Map<string, GraphEdge>();
  const notes: Note[] = options.vaults
    ? world.notes.filter((note) => options.vaults!.includes(note.vaultId))
    : world.notes;
  const add = (node: Omit<GraphNode, "degree">) => {
    if (!nodes.has(node.id)) nodes.set(node.id, { ...node, degree: 0 });
  };
  const connect = (a: string, b: string) => {
    if (a === b) return;
    const key = a < b ? `${a}|${b}` : `${b}|${a}`;
    if (!edges.has(key)) edges.set(key, { source: a, target: b });
  };

  for (const note of notes)
    add({ id: `note:${note.id}`, kind: "note", label: note.title, vaultId: note.vaultId });
  for (const note of notes) {
    const from = `note:${note.id}`;
    for (const link of note.links) {
      const target = resolveLink(link, world, note.vaultId);
      if (target?.kind === "note") {
        add({
          id: `note:${target.note.id}`,
          kind: "note",
          label: target.note.title,
          vaultId: target.note.vaultId,
        });
        connect(from, `note:${target.note.id}`);
      } else if (target?.kind === "notebook" && options.showSources) {
        add({
          id: `notebook:${target.notebook.id}`,
          kind: "notebook",
          label: target.notebook.title,
          vaultId: target.notebook.vaultId ?? "default",
        });
        connect(from, `notebook:${target.notebook.id}`);
      } else if (target?.kind === "source" && options.showSources) {
        const notebook = world.notebooks.find((each) => each.id === target.source.notebookId);
        add({
          id: `source:${target.source.id}`,
          kind: "source",
          label: target.source.title,
          vaultId: notebook?.vaultId ?? "default",
        });
        connect(from, `source:${target.source.id}`);
      } else if (!target && link.kind === "note" && link.target) {
        const id = `missing:${link.target.toLowerCase()}`;
        add({ id, kind: "missing", label: link.target, vaultId: null });
        connect(from, id);
      }
    }
    if (options.showTags) {
      for (const tag of note.tags) {
        add({ id: `tag:${tag.toLowerCase()}`, kind: "tag", label: `#${tag}`, vaultId: null });
        connect(from, `tag:${tag.toLowerCase()}`);
      }
    }
  }

  for (const edge of edges.values()) {
    nodes.get(edge.source)!.degree++;
    nodes.get(edge.target)!.degree++;
  }

  let keep = new Set(nodes.keys());
  if (options.around) {
    const start = `note:${options.around.noteId}`;
    const neighbours = new Map<string, string[]>();
    for (const edge of edges.values()) {
      neighbours.set(edge.source, [...(neighbours.get(edge.source) ?? []), edge.target]);
      neighbours.set(edge.target, [...(neighbours.get(edge.target) ?? []), edge.source]);
    }
    keep = new Set([start]);
    let frontier = [start];
    for (let step = 0; step < options.around.depth; step++) {
      frontier = frontier.flatMap((id) => neighbours.get(id) ?? []).filter((id) => !keep.has(id));
      for (const id of frontier) keep.add(id);
    }
  }
  if (!options.showOrphans && !options.around) {
    for (const node of nodes.values()) if (node.degree === 0) keep.delete(node.id);
  }
  return {
    nodes: [...nodes.values()].filter((node) => keep.has(node.id)),
    edges: [...edges.values()].filter((edge) => keep.has(edge.source) && keep.has(edge.target)),
  };
}
