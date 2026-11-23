import { useEffect, useState } from "react";
import { installPlugin, setPluginEnabled } from "@/lib/db/plugins";
import type { Plugin } from "@/lib/db/types";
import { parsePluginBundle, type PluginBundle, type PluginPermission } from "./manifest";
import { registrySchema, type Registry, type RegistryEntry } from "./registry";

/**
 * The plugin directory in the app: the list, read through the app's API
 * (server/routes/plugins-registry.ts), and installing from it.
 */

let cache: { at: number; registry: Registry } | null = null;

export async function loadRegistry(fresh = false): Promise<Registry> {
  if (!fresh && cache && Date.now() - cache.at < 5 * 60 * 1000) return cache.registry;
  const response = await fetch(`/api/plugins/registry${fresh ? "?fresh" : ""}`);
  const body = (await response.json()) as unknown;
  if (!response.ok) throw new Error((body as { error?: string }).error ?? response.statusText);
  const registry = registrySchema.parse(body);
  cache = { at: Date.now(), registry };
  return registry;
}

/** The directory, loaded once; `error` when it can't be reached. */
export function useRegistry() {
  const [state, setState] = useState<{
    registry: Registry | null;
    error: string | null;
    loading: boolean;
  }>({ registry: cache?.registry ?? null, error: null, loading: !cache });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    loadRegistry(attempt > 0)
      .then((registry) => alive && setState({ registry, error: null, loading: false }))
      .catch(
        (error: unknown) =>
          alive &&
          setState({
            registry: null,
            error: error instanceof Error ? error.message : String(error),
            loading: false,
          }),
      );
    return () => {
      alive = false;
    };
  }, [attempt]);
  return {
    ...state,
    retry: () => {
      setState((current) => ({ ...current, loading: true, error: null }));
      setAttempt((value) => value + 1);
    },
  };
}

/** Downloads a plugin from the directory, checked against its SHA-256 on the way. */
export async function fetchBundle(entry: RegistryEntry): Promise<PluginBundle> {
  const response = await fetch("/api/plugins/bundle", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: entry.id }),
  });
  const body = (await response.json()) as { bundle?: unknown; error?: string };
  if (!response.ok) throw new Error(body.error ?? response.statusText);
  const parsed = parsePluginBundle(body.bundle);
  if (!parsed.ok) throw new Error(parsed.error);
  if (parsed.bundle.manifest.id !== entry.id)
    throw new Error("The download is a different plugin.");
  return parsed.bundle;
}

/** Installs a bundle the user confirmed, turned on with the permissions they kept if asked. */
export async function installConfirmed(
  bundle: PluginBundle,
  { turnOn, granted }: { turnOn: boolean; granted: PluginPermission[] },
): Promise<Plugin> {
  const plugin = await installPlugin(bundle);
  if (turnOn) await setPluginEnabled(plugin.id, true, granted);
  return plugin;
}
