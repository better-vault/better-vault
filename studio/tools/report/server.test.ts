import { describe, expect, it } from "vitest";
import { splitTitle } from "./server";

describe("splitTitle", () => {
  it("takes the first heading as the title", () => {
    expect(splitTitle("# The Startup Blueprint\n\n## Ideas\nText [1].", "Report")).toEqual({
      title: "The Startup Blueprint",
      body: "## Ideas\nText [1].",
    });
  });

  it("falls back when there is no heading", () => {
    expect(splitTitle("Just text.", "Report")).toEqual({ title: "Report", body: "Just text." });
  });

  it("unwraps a fenced answer", () => {
    expect(splitTitle("```markdown\n# T\nBody\n```", "R")).toEqual({ title: "T", body: "Body" });
  });
});
