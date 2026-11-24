import { z } from "zod";
import { PLUGIN_ID, pluginIcons, pluginPermissions } from "./manifest";

/**
 * The plugin directory: github.com/better-vault/better-vault-plugins. Each
 * plugin lives in its creator's own public repository; the directory lists
 * it at a reviewed commit ("verified"), and only the repository's owner can
 * list or update it. The directory's workflow writes `registry.json` (with
 * each repository's stars) on every merge and every few hours, so the app
 * and the website show a new plugin or update as soon as it lands, with no
 * release.
 */
export const REGISTRY_REPO = "better-vault/better-vault-plugins";
export const REGISTRY_RAW = `https://raw.githubusercontent.com/${REGISTRY_REPO}/main/`;
export const REGISTRY_URL = `${REGISTRY_RAW}registry.json`;
export const REGISTRY_WEB = `https://github.com/${REGISTRY_REPO}`;

/** A picture in the directory repo: a plugin's cover or one of its screenshots. */
export const PICTURE_PATH =
  /^assets\/[a-z0-9-]+\/(?:cover|screenshots\/[\w.-]+)\.(?:png|jpe?g|webp)$/;

/** A GitHub login, as GitHub allows them. */
export const GITHUB_LOGIN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;

/** A creator's GitHub avatar (img-src allows https:). */
export const avatarUrl = (login: string, size = 96) =>
  `https://github.com/${encodeURIComponent(login)}.png?size=${size}`;

/** A directory picture as the app loads it: through its own API, so the page's CSP is unchanged. */
export const pictureUrl = (path: string) => `/api/plugins/picture?path=${encodeURIComponent(path)}`;

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
      graphStyles: z.number().int().default(0),
    })
    .default({ studioTools: 0, panels: 0, mods: 0, theme: false, graphStyles: 0 }),
  /** The creator's repository and the reviewed commit the bundle was built from. */
  repo: z
    .string()
    .regex(/^[A-Za-z0-9-]{1,39}\/[\w.-]{1,100}$/)
    .optional(),
  commit: z
    .string()
    .regex(/^[0-9a-f]{40}$/)
    .optional(),
  /** Who owns that repository: their avatar is the plugin's face. */
  owner: z.string().regex(GITHUB_LOGIN).optional(),
  /** The repository's GitHub stars. */
  stars: z.number().int().nonnegative().default(0),
  /** The bundle's path in the repo, and its SHA-256, checked before it installs. */
  bundle: z.string().regex(/^dist\/[a-z0-9-]+-[\w.-]+\.bvplugin\.json$/),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  size: z.number().int().nonnegative(),
  /** The card's header picture, a path in the repo. */
  cover: z.string().regex(PICTURE_PATH).optional(),
  /** Pictures of the plugin at work (paths in the repo), shown in its dialog. */
  screenshots: z.array(z.string().regex(PICTURE_PATH)).max(6).default([]),
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

/** Whether version `a` is above version `b` (major.minor.patch). */
export function isNewerVersion(a: string, b: string): boolean {
  const parts = (version: string) =>
    version
      .split(/[.-]/)
      .slice(0, 3)
      .map((part) => Number.parseInt(part, 10) || 0);
  const [x, y] = [parts(a), parts(b)];
  for (let at = 0; at < 3; at++) if (x[at] !== y[at]) return x[at] > y[at];
  return false;
}
