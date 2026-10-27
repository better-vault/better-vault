import { describe, expect, it } from "vitest";
import { createHistory } from "./history";

describe("history", () => {
  it("undoes and redoes", () => {
    const history = createHistory<number>();
    history.record(1);
    expect(history.undo(2)).toBe(1);
    expect(history.redo(1)).toBe(2);
  });

  it("clears redo after a new change, and merges changes with one key", () => {
    const history = createHistory<number>();
    history.record(1);
    history.undo(2);
    history.record(5);
    expect(history.canRedo()).toBe(false);
    history.record(10, "slider", 0);
    history.record(11, "slider", 500);
    expect(history.undo(12)).toBe(10);
    expect(history.undo(10)).toBe(5);
  });

  it("keeps at most `limit` steps", () => {
    const history = createHistory<number>(2);
    [1, 2, 3].forEach((value) => history.record(value));
    expect(history.undo(4)).toBe(3);
    expect(history.undo(3)).toBe(2);
    expect(history.undo(2)).toBeNull();
  });
});
