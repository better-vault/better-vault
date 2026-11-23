import { describe, expect, it } from "vitest";
import { unsafeCss } from "./css";
import { parsePluginBundle } from "./manifest";

describe("mod CSS", () => {
  it("allows CSS that only restyles", () => {
    expect(unsafeCss("[data-bv=sidebar] { border-radius: 0; font-family: serif; }")).toBeNull();
    expect(unsafeCss("body { background: url(data:image/png;base64,AAAA) }")).toBeNull();
  });

  it("refuses CSS that loads or runs anything", () => {
    for (const css of [
      "@import url(https://evil.example/x.css);",
      "body { background: url(https://evil.example/track.png) }",
      "body { background: url('//evil.example/a') }",
      "a { behavior: url(x.htc) }",
      "a { width: expression(alert(1)) }",
      "</style><script>alert(1)</script>",
      "body { background: u\\72l(https://x) }",
    ])
      expect(unsafeCss(css), css).not.toBeNull();
  });

  it("installs a mod and a Studio tool, and refuses an unsafe mod", () => {
    const bundle = (css: string) => ({
      manifest: {
        manifestVersion: 2,
        id: "terminal",
        name: "Terminal",
        version: "1.0.0",
        contributes: {
          panels: [{ id: "piano", title: "Piano", slot: "studio-tool", entry: "index.html" }],
          mods: [{ id: "mono", title: "Monospace", file: "mod.css" }],
        },
      },
      files: { "index.html": "<p>hi</p>", "mod.css": css },
    });
    expect(parsePluginBundle(bundle("body { font-family: monospace }")).ok).toBe(true);
    const refused = parsePluginBundle(bundle("@import 'x.css';"));
    expect(refused.ok).toBe(false);
  });
});
