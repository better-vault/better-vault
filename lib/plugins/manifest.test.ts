import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { pluginPage } from "./bridge";
import { parsePluginBundle, themeCss } from "./manifest";

const example = JSON.parse(
  readFileSync(
    new URL("../../plugins/examples/notebook-stats.bvplugin.json", import.meta.url),
    "utf8",
  ),
);

describe("plugin bundles", () => {
  it("accepts the example plugin", () => {
    const parsed = parsePluginBundle(example);
    expect(parsed.ok).toBe(true);
  });

  it("refuses bad ids, unknown permissions, missing entries and unsafe paths", () => {
    const bad = (change: (bundle: typeof example) => void) => {
      const copy = structuredClone(example);
      change(copy);
      return parsePluginBundle(copy);
    };
    expect(bad((b) => (b.manifest.id = "Not Valid")).ok).toBe(false);
    expect(bad((b) => b.manifest.permissions.push("read:settings")).ok).toBe(false);
    expect(bad((b) => delete b.files["index.html"]).ok).toBe(false);
    expect(bad((b) => (b.files["../evil.js"] = "x")).ok).toBe(false);
    expect(bad((b) => (b.files["big.txt"] = "x".repeat(2 * 1024 * 1024))).ok).toBe(false);
  });

  it("lets a theme set only colour tokens, to plain colours", () => {
    const parsed = parsePluginBundle({
      manifest: {
        manifestVersion: 1,
        id: "sunset",
        name: "Sunset",
        version: "1.0.0",
        contributes: {
          theme: { light: { primary: "oklch(0.7 0.18 40)" }, dark: { background: "#101010" } },
        },
      },
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(themeCss(parsed.bundle.manifest.contributes.theme!)).toBe(
      ":root:not(.dark) {\n  --primary: oklch(0.7 0.18 40);\n}\n:root.dark {\n  --background: #101010;\n}",
    );
    for (const value of [
      "red; } body { display:none",
      "url(https://x)",
      "var(--x)",
      "expression(1)",
    ]) {
      const result = parsePluginBundle({
        manifest: {
          manifestVersion: 1,
          id: "bad",
          name: "Bad",
          version: "1.0.0",
          contributes: { theme: { light: { primary: value } } },
        },
      });
      expect(result.ok, value).toBe(false);
    }
  });

  it("puts the SDK first and the plugin's files inline", () => {
    const parsed = parsePluginBundle(example);
    if (!parsed.ok) throw new Error(parsed.error);
    const page = pluginPage(parsed.bundle, "index.html");
    expect(page.indexOf("window.betterVault")).toBeLessThan(page.indexOf("betterVault.onContext"));
    expect(page).toContain("<style>main{padding:24px");
    expect(page).not.toContain('src="app.js"');
    expect(page).not.toContain('href="style.css"');
  });
});
