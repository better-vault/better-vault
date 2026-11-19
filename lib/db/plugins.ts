import { pluginRow } from "@/lib/plugins/install";
import type { PluginBundle, PluginPermission } from "@/lib/plugins/manifest";
import { useStoreQuery } from "./live";
import { store } from "./store";
import type { Plugin } from "./types";

/** Every installed plugin, by name. */
export async function listPlugins(): Promise<Plugin[]> {
  return (await store().listPlugins()).sort((a, b) =>
    a.manifest.name.localeCompare(b.manifest.name),
  );
}

export function usePlugins(): Plugin[] | undefined {
  return useStoreQuery(listPlugins, [], ["plugins"]);
}

/**
 * Installs a checked bundle (`parsePluginBundle`), or updates the plugin
 * with its id (see `pluginRow`).
 */
export async function installPlugin(bundle: PluginBundle, updatedBy = "you"): Promise<Plugin> {
  const plugin = pluginRow(
    await store().getPlugin(bundle.manifest.id),
    bundle,
    updatedBy,
    Date.now(),
  );
  await store().putPlugin(plugin);
  return plugin;
}

/** Turns a plugin on with the permissions the user allowed, or off. */
export async function setPluginEnabled(
  id: string,
  enabled: boolean,
  granted: readonly PluginPermission[] = [],
): Promise<void> {
  const plugin = await store().getPlugin(id);
  if (!plugin) return;
  const allowed = granted.filter((permission) => plugin.manifest.permissions.includes(permission));
  await store().putPlugin({
    ...plugin,
    enabled,
    granted: enabled ? allowed : plugin.granted,
    updatedAt: Date.now(),
  });
}

export async function removePlugin(id: string): Promise<void> {
  await store().deletePlugin(id);
}
