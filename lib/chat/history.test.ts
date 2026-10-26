import { describe, expect, it } from "vitest";
import type { Conversation } from "@/lib/db/database";
import { groupByDay } from "./history";

const at = (id: string, updatedAt: number): Conversation => ({
  id,
  notebookId: "n",
  title: id,
  createdAt: updatedAt,
  updatedAt,
});

describe("groupByDay", () => {
  it("groups by local day and keeps the order", () => {
    const now = new Date(2026, 9, 27, 15, 0).getTime();
    const groups = groupByDay(
      [
        at("a", new Date(2026, 9, 27, 9, 0).getTime()),
        at("b", new Date(2026, 9, 27, 0, 30).getTime()),
        at("c", new Date(2026, 9, 26, 23, 0).getTime()),
        at("d", new Date(2026, 9, 22, 12, 0).getTime()),
        at("e", new Date(2026, 8, 1).getTime()),
      ],
      now,
    );
    expect(groups.map((group) => [group.group, group.conversations.map((c) => c.id)])).toEqual([
      ["today", ["a", "b"]],
      ["yesterday", ["c"]],
      ["week", ["d"]],
      ["older", ["e"]],
    ]);
  });

  it("leaves out empty groups", () => {
    expect(groupByDay([], 0)).toEqual([]);
  });
});
