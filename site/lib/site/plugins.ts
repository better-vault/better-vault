import { cacheLife } from "next/cache";
import { entry, RAW, type PluginEntry } from "./plugin-info";

/**
 * The plugin directory, read from github.com/better-vault/better-vault-plugins.
 * Its workflow rewrites registry.json on every merge; the site asks again at
 * most once an hour (minutes after a failure), so a newly verified plugin
 * shows up here without a redeploy.
 */
export {
  avatarUrl,
  describeAdds,
  permissionLabels,
  pluginsRepo,
  rawUrl,
  type PluginEntry,
} from "./plugin-info";

/** Every listed plugin, by name; empty when GitHub can't be reached. */
export async function listPlugins(): Promise<PluginEntry[]> {
  "use cache";
  try {
    const response = await fetch(`${RAW}registry.json`);
    if (!response.ok) {
      cacheLife("minutes");
      return [];
    }
    const body = (await response.json()) as { plugins?: unknown[] };
    const plugins = (body.plugins ?? []).flatMap((item) => {
      const parsed = entry.safeParse(item);
      return parsed.success ? [parsed.data] : [];
    });
    cacheLife("hours");
    return plugins;
  } catch {
    cacheLife("minutes");
    return [];
  }
}

export async function getPlugin(id: string): Promise<PluginEntry | null> {
  return (await listPlugins()).find((plugin) => plugin.id === id) ?? null;
}
