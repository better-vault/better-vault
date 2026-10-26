import { describe, expect, it } from "vitest";
import { seededRandom } from "@/studio/server/shared";
import { shuffleOptions } from "./server";

describe("shuffleOptions", () => {
  it("keeps the right answer pointing at the same text", () => {
    const random = seededRandom("seed");
    for (let i = 0; i < 20; i++) {
      const shuffled = shuffleOptions(
        { question: "q", options: ["right", "a", "b", "c"], answer: 0, explanation: "", hint: "" },
        random,
      );
      expect(shuffled.options[shuffled.answer]).toBe("right");
      expect([...shuffled.options].sort()).toEqual(["a", "b", "c", "right"]);
    }
  });

  it("does not always leave the answer first", () => {
    const random = seededRandom("spread");
    const places = new Set(
      Array.from(
        { length: 30 },
        () =>
          shuffleOptions(
            { question: "q", options: ["r", "a", "b", "c"], answer: 0, explanation: "", hint: "" },
            random,
          ).answer,
      ),
    );
    expect(places.size).toBeGreaterThan(1);
  });
});
