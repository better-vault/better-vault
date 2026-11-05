import { afterEach, describe, expect, it, vi } from "vitest";
import { shortcutKeys } from "./platform";

describe("shortcut labels", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("writes ⌘ on a Mac", () => {
    vi.stubGlobal("navigator", { platform: "MacIntel", userAgent: "" });
    expect(shortcutKeys("k")).toEqual(["⌘", "K"]);
  });

  it("writes Ctrl on Windows and Linux", () => {
    vi.stubGlobal("navigator", { platform: "Win32", userAgent: "" });
    expect(shortcutKeys("k")).toEqual(["Ctrl", "K"]);
    vi.stubGlobal("navigator", { platform: "Linux x86_64", userAgent: "" });
    expect(shortcutKeys("k")).toEqual(["Ctrl", "K"]);
  });

  it("asks the desktop app which system it runs on", () => {
    vi.stubGlobal("navigator", { platform: "MacIntel", userAgent: "" });
    vi.stubGlobal("window", { betterVault: { platform: "win32" } });
    expect(shortcutKeys("k")).toEqual(["Ctrl", "K"]);
  });
});
