import { describe, expect, it } from "vitest";
import { arrow, rect } from "./fixtures";
import { duplicate, fitPoints, group, reorder, ungroup, withGroups } from "./scene";

describe("scene", () => {
  it("duplicates with new ids and new, shared groups", () => {
    const elements = [
      rect("a", 0, 0, 10, 10, { groupIds: ["g"] }),
      rect("b", 20, 0, 10, 10, { groupIds: ["g"] }),
    ];
    const result = duplicate(elements, new Set(["a", "b"]));
    expect(result.elements).toHaveLength(4);
    const copies = result.elements.slice(2);
    expect(copies.every((copy) => !["a", "b"].includes(copy.id))).toBe(true);
    expect(copies[0].groupIds[0]).toBe(copies[1].groupIds[0]);
    expect(copies[0].groupIds[0]).not.toBe("g");
    expect(copies[0]).toMatchObject({ x: 12, y: 12 });
  });

  it("moves elements up and down the stack, keeping their order", () => {
    const elements = ["a", "b", "c", "d"].map((id) => rect(id, 0, 0, 1, 1));
    const ids = (list: { id: string }[]) => list.map((e) => e.id).join("");
    expect(ids(reorder(elements, new Set(["a", "b"]), "front"))).toBe("cdab");
    expect(ids(reorder(elements, new Set(["c"]), "back"))).toBe("cabd");
    expect(ids(reorder(elements, new Set(["b"]), "forward"))).toBe("acbd");
    expect(ids(reorder(elements, new Set(["c"]), "backward"))).toBe("acbd");
  });

  it("groups, selects whole groups, and ungroups", () => {
    const elements = group(
      [rect("a", 0, 0, 1, 1), rect("b", 0, 0, 1, 1), rect("c", 0, 0, 1, 1)],
      new Set(["a", "b"]),
    );
    expect([...withGroups(elements, ["a"])].sort()).toEqual(["a", "b"]);
    expect(ungroup(elements, new Set(["a", "b"])).every((e) => e.groupIds.length === 0)).toBe(true);
  });

  it("fits a line's box to its points", () => {
    const line = fitPoints(
      arrow("l", 100, 100, [
        [0, 0],
        [-40, 30],
      ]),
    );
    expect(line).toMatchObject({ x: 60, y: 100, width: 40, height: 30 });
    expect(line.points).toEqual([
      [40, 0],
      [0, 30],
    ]);
  });
});
