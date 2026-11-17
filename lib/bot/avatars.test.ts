import { validateAvatar } from "open-bot-avatar";
import { describe, expect, it } from "vitest";
import { botShape, botShapes } from "./avatars";

describe("bot shapes", () => {
  it.each(botShapes.map((shape) => [shape.id, shape] as const))(
    "%s is a valid avatar",
    (_, shape) => {
      const result = validateAvatar(shape);
      expect(result.ok ? [] : result.errors).toEqual([]);
    },
  );

  it("have unique ids and fall back to the first", () => {
    expect(new Set(botShapes.map((shape) => shape.id)).size).toBe(botShapes.length);
    expect(botShape("nope").id).toBe(botShapes[0].id);
  });
});
