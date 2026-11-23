import { z } from "zod";
import { bridgeApi, sdkGuide } from "../../../lib/plugins/api";
import { pluginRow } from "../../../lib/plugins/install";
import {
  MAX_PLUGIN_BYTES,
  parsePluginBundle,
  pluginIcons,
  pluginPermissions,
  pluginSlots,
  themeTokens,
} from "../../../lib/plugins/manifest";
import type { Plugin } from "../../../lib/db/types";
import { failure, guarded, text, turnedOff, type ToolContext } from "./context";

/**
 * Creator mode through MCP: an agent reads `describe_app` (which includes
 * `pluginGuide` below), writes a plugin and installs it here. It always
 * arrives turned off; the user reviews what it asks for in Settings →
 * Plugins and turns it on.
 */
export function registerPluginTools(ctx: ToolContext) {
  const { mcp, store, log, changed, canWrite, client } = ctx;

  const pluginOut = (plugin: Plugin) => ({
    id: plugin.id,
    name: plugin.manifest.name,
    version: plugin.manifest.version,
    description: plugin.manifest.description,
    enabled: plugin.enabled,
    asks: plugin.manifest.permissions,
    granted: plugin.granted,
    panels: plugin.manifest.contributes.panels,
    theme: Boolean(plugin.manifest.contributes.theme),
    updatedBy: plugin.updatedBy,
  });

  mcp.registerTool(
    "list_plugins",
    {
      description:
        "List the installed plugins: whether each is on, and what it asks for and was granted.",
      annotations: { readOnlyHint: true },
    },
    async () => {
      log("list_plugins");
      return text(store.listPlugins().map(pluginOut));
    },
  );

  mcp.registerTool(
    "read_plugin",
    {
      description: "Read a plugin's manifest and files, to change it with update_plugin.",
      inputSchema: { id: z.string() },
      annotations: { readOnlyHint: true },
    },
    async ({ id }) => {
      log("read_plugin");
      const plugin = store.getPlugin(id);
      return plugin
        ? text({ manifest: plugin.manifest, files: plugin.files, enabled: plugin.enabled })
        : failure("No plugin with that id.");
    },
  );

  const install = (bundle: unknown, mode: "install" | "update") =>
    guarded(() => {
      if (!canWrite("plugins")) return turnedOff("plugins");
      log(mode === "install" ? "install_plugin" : "update_plugin");
      const parsed = parsePluginBundle(bundle);
      if (!parsed.ok) return failure(`The plugin isn't valid: ${parsed.error}`);
      const existing = store.getPlugin(parsed.bundle.manifest.id);
      if (mode === "install" && existing)
        return failure(`A plugin "${existing.id}" is installed already. Use update_plugin.`);
      if (mode === "update" && !existing)
        return failure("No plugin with that id. Use install_plugin.");
      const plugin = pluginRow(existing, parsed.bundle, client, Date.now(), { turnOff: true });
      store.putPlugin(plugin);
      changed(["plugins"]);
      return text({
        saved: pluginOut(plugin),
        next: "It is turned off. Ask the user to turn it on in Settings → Plugins, where they see what it asks for.",
      });
    });

  const bundleInput = {
    manifest: z
      .record(z.string(), z.unknown())
      .describe("The plugin's manifest (see describe_app → plugins.manifest)"),
    files: z
      .record(z.string(), z.string())
      .describe('Its files as text by path, e.g. { "index.html": "…", "app.js": "…" }'),
  };

  mcp.registerTool(
    "install_plugin",
    {
      description:
        "Install a new plugin: a manifest and its files. It is checked, and installed turned off for the user to review. Call describe_app first for the manifest, the bridge methods and the limits.",
      inputSchema: bundleInput,
    },
    async (bundle) => install(bundle, "install"),
  );

  mcp.registerTool(
    "update_plugin",
    {
      description:
        "Replace an installed plugin's manifest and files (same id). It is turned off again for the user to review.",
      inputSchema: bundleInput,
    },
    async (bundle) => install(bundle, "update"),
  );

  mcp.registerTool(
    "remove_plugin",
    {
      description: "Remove a plugin.",
      inputSchema: { id: z.string() },
      annotations: { destructiveHint: true },
    },
    async ({ id }) =>
      guarded(() => {
        if (!canWrite("plugins")) return turnedOff("plugins");
        log("remove_plugin");
        const plugin = store.getPlugin(id);
        if (!plugin) return failure("No plugin with that id.");
        store.deletePlugin(id);
        changed(["plugins"]);
        return text({ removed: plugin.manifest.name });
      }),
  );
}

/** How to build a plugin, for `describe_app`. */
export function pluginGuide() {
  return {
    plugins: {
      about:
        "Plugins add Studio tools and panels (sandboxed HTML pages), mods (CSS for the whole app) and themes to better-vault. Describe where a panel goes, what it shows, exact numbers and defaults, and what to leave out; use the user's real data through the bridge, never placeholders. A Studio tool can ask the user's AI model with ai.generate (permission use:ai) and keep its own data with storage.get/set.",
      manifest: {
        manifestVersion: 2,
        id: "lowercase-words-joined-by-hyphens",
        name: "Shown name (60 characters at most)",
        version: "1.0.0",
        description: "One or two sentences",
        icon: pluginIcons,
        permissions: pluginPermissions,
        contributes: {
          panels: [
            {
              id: "panel-id",
              title: "Panel title",
              slot: pluginSlots,
              entry: "index.html",
              description: "One line under a Studio tool's name (studio-tool slot)",
            },
          ],
          mods: [{ id: "mod-id", title: "What it changes", file: "mod.css" }],
          theme: {
            light:
              "{ token: colour } with tokens from `themeTokens`; colours as #hex, rgb(), hsl() or oklch()",
            dark: "the same, for dark mode",
          },
        },
      },
      slots: {
        studio:
          "The Studio sheet's Plugins group; opens in the Studio tab with the open notebook as context.",
        "studio-tool":
          "A tool of its own in the Studio sheet's grid, beside the built-in tools; opens full size in the Studio tab.",
      },
      mods: "CSS applied to the whole app while the plugin is on. It may not @import or load anything but data: pictures and fonts. Target the stable hooks: [data-bv=sidebar], [data-bv=notebook-topbar], [data-bv=notebook], [data-bv=prompt], [data-bv=chat], [data-bv=studio-tools], [data-bv=vault-toolbar], [data-bv=vault-grid], [data-bv=note-tabs], and the tokens (--background, --primary, --radius, and --font-geist-sans for the app's font).",
      themeTokens,
      bridge: bridgeApi,
      sdk: sdkGuide,
      maxBytes: MAX_PLUGIN_BYTES,
      install:
        "install_plugin({ manifest, files }) → turned off until the user turns it on in Settings → Plugins.",
    },
  };
}
