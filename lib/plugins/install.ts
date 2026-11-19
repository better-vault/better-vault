import type { Plugin } from "@/lib/db/types";
import type { PluginBundle } from "./manifest";

/**
 * The row for a plugin being installed or updated. A new plugin is off. An
 * update keeps what was granted that it still asks for, and stays on only
 * when it asks for nothing more; `turnOff` (agents' installs) always turns it
 * off, so the user looks at code an agent wrote before it runs.
 */
export function pluginRow(
  existing: Plugin | undefined,
  bundle: PluginBundle,
  updatedBy: string,
  now: number,
  { turnOff = false }: { turnOff?: boolean } = {},
): Plugin {
  const asked = new Set(bundle.manifest.permissions);
  const granted = (existing?.granted ?? []).filter((permission) => asked.has(permission));
  const wantsMore = bundle.manifest.permissions.some((permission) => !granted.includes(permission));
  return {
    id: bundle.manifest.id,
    manifest: bundle.manifest,
    files: bundle.files,
    enabled: !turnOff && Boolean(existing?.enabled) && !wantsMore,
    granted,
    updatedBy,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
}
