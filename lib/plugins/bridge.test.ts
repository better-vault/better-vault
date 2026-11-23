import { describe, expect, it } from "vitest";
import type { Plugin } from "@/lib/db/types";
import { handleBridgeCall, type PluginContext } from "./bridge";

const context: PluginContext = { notebook: null, theme: "light", tokens: {}, language: "en" };
const plugin = (overrides: Partial<Plugin>): Plugin => ({
  id: "p",
  manifest: {
    manifestVersion: 1,
    id: "p",
    name: "P",
    version: "1.0.0",
    description: "",
    icon: "puzzle",
    permissions: ["read:notes", "write:notes"],
    contributes: { panels: [], mods: [], graph: [] },
    tags: [],
  },
  files: {},
  enabled: true,
  granted: ["read:notes"],
  updatedBy: "you",
  createdAt: 0,
  updatedAt: 0,
  ...overrides,
});

describe("handleBridgeCall", () => {
  it("refuses methods the user didn't grant, unknown methods and plugins that are off", async () => {
    await expect(
      handleBridgeCall(plugin({}), "notes.create", { title: "x", body: "y" }, context),
    ).rejects.toThrow(/wasn't allowed write:notes/);
    await expect(handleBridgeCall(plugin({}), "settings.read", {}, context)).rejects.toThrow(
      /Unknown method/,
    );
    await expect(handleBridgeCall(plugin({}), "__proto__", {}, context)).rejects.toThrow(
      /Unknown method/,
    );
    await expect(
      handleBridgeCall(plugin({ enabled: false }), "notes.list", {}, context),
    ).rejects.toThrow(/turned off/);
  });
});
