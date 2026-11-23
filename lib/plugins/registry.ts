import { z } from "zod";
import { PLUGIN_ID, pluginIcons, pluginPermissions } from "./manifest";

/**
 * The plugin directory: github.com/better-vault/better-vault-plugins. Each
 * plugin there was reviewed before it was merged ("verified"); the repo's
 * workflow writes `registry.json` from them on every merge, so the app and
 * the website list a new plugin as soon as it lands, with no release.
 */
export const REGISTRY_REPO = "better-vault/better-vault-plugins";
export const REGISTRY_RAW = `https://raw.githubusercontent.com/${REGISTRY_REPO}/main/`;
export const REGISTRY_URL = `${REGISTRY_RAW}registry.json`;
export const REGISTRY_WEB = `https://github.com/${REGISTRY_REPO}`;

export const registryEntrySchema = z.object({
  id: z.string().regex(PLUGIN_ID),
  name: z.string().max(60),
  version: z.string().max(40),
  description: z.string().max(500).default(""),
  author: z.string().max(100).default(""),
  icon: z.enum(pluginIcons).catch("puzzle"),
  tags: z.array(z.string().max(30)).max(8).default([]),
  permissions: z.array(z.enum(pluginPermissions)).default([]),
  /** What it adds, counted. */
  adds: z
    .object({
      studioTools: z.number().int().default(0),
      panels: z.number().int().default(0),
      mods: z.number().int().default(0),
      theme: z.boolean().default(false),
    })
    .default({ studioTools: 0, panels: 0, mods: 0, theme: false }),
  /** The bundle's path in the repo, and its SHA-256, checked before it installs. */
  bundle: z.string().regex(/^dist\/[a-z0-9-]+-[\w.-]+\.bvplugin\.json$/),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  size: z.number().int().nonnegative(),
  /** Pictures in the repo (paths), shown in the details. */
  screenshots: z.array(z.string().max(200)).max(6).default([]),
  updatedAt: z.string().max(40).default(""),
});
export type RegistryEntry = z.infer<typeof registryEntrySchema>;

export const registrySchema = z.object({
  version: z.literal(1),
  updatedAt: z.string().max(40).default(""),
  plugins: z
    .array(z.unknown())
    .max(2000)
    .transform((items) =>
      items.flatMap((item) => {
        const parsed = registryEntrySchema.safeParse(item);
        return parsed.success ? [parsed.data] : [];
      }),
    ),
});
export type Registry = z.infer<typeof registrySchema>;

/** Whether a plugin matches a search, by its name, description, author, tags and id. */
export function matchesSearch(
  entry: Pick<RegistryEntry, "id" | "name" | "description" | "author" | "tags">,
  query: string,
) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const haystack = [entry.id, entry.name, entry.description, entry.author, ...entry.tags]
    .join(" ")
    .toLowerCase();
  return words.every((word) => haystack.includes(word));
}
