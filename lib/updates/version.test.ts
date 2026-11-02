import { describe, expect, it } from "vitest";
import { compareVersions, releaseNotesUrl } from "./version";

describe("compareVersions", () => {
  it("orders versions by number, not text", () => {
    expect(compareVersions("0.10.0", "0.9.9")).toBeGreaterThan(0);
    expect(compareVersions("v0.4.2", "0.4.2")).toBe(0);
    expect(compareVersions("0.4.1", "0.5.0")).toBeLessThan(0);
  });
  it("links to a release's notes", () => {
    expect(releaseNotesUrl("v0.5.0")).toBe(
      "https://github.com/better-vault/better-vault/releases/tag/v0.5.0",
    );
  });
});
