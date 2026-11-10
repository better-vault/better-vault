import { describe, expect, it } from "vitest";
import type { Note, Vault } from "@/lib/db/types";
import { analyse } from "./syntax";
import { buildGraph } from "./graph";
import type { LinkWorld } from "./resolve";

const note = (id: string, title: string, body: string, vaultId = "default"): Note => ({
  id,
  vaultId,
  title,
  body,
  folder: "",
  ...analyse(body),
  createdAt: 0,
  updatedAt: 0,
});
const vault = (id: string, name: string): Vault => ({
  id,
  name,
  order: 0,
  createdAt: 0,
  updatedAt: 0,
});

const world: LinkWorld = {
  notes: [
    note("a", "A", "[[B]] [[Ghost]] #topic"),
    note("b", "B", "[[Work/C]]"),
    note("c", "C", "", "work"),
    note("d", "Lonely", ""),
  ],
  notebooks: [],
  sources: [],
  vaults: [vault("default", "Personal"), vault("work", "Work")],
  vaultName: (each) => each.name,
};

describe("notes graph", () => {
  it("links notes across vaults and drops orphans unless asked", () => {
    const graph = buildGraph(world, {
      vaults: null,
      showTags: false,
      showOrphans: false,
      showSources: false,
      around: null,
    });
    expect(graph.nodes.map((node) => node.id).sort()).toEqual([
      "missing:ghost",
      "note:a",
      "note:b",
      "note:c",
    ]);
    expect(graph.edges).toHaveLength(3);
    const withAll = buildGraph(world, {
      vaults: null,
      showTags: true,
      showOrphans: true,
      showSources: false,
      around: null,
    });
    expect(withAll.nodes.some((node) => node.id === "tag:topic")).toBe(true);
    expect(withAll.nodes.some((node) => node.id === "note:d")).toBe(true);
  });

  it("builds a local graph to a depth", () => {
    const one = buildGraph(world, {
      vaults: null,
      showTags: false,
      showOrphans: false,
      showSources: false,
      around: { noteId: "c", depth: 1 },
    });
    expect(one.nodes.map((node) => node.id).sort()).toEqual(["note:b", "note:c"]);
    const two = buildGraph(world, {
      vaults: null,
      showTags: false,
      showOrphans: false,
      showSources: false,
      around: { noteId: "c", depth: 2 },
    });
    expect(two.nodes.map((node) => node.id).sort()).toEqual(["note:a", "note:b", "note:c"]);
  });
});
