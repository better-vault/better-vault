import { z } from "zod";

/**
 * The plugin directory's shared pieces: the entry shape and words for
 * permissions and contributions, used by server pages and the search alike.
 */
export const pluginsRepo = "https://github.com/better-vault/better-vault-plugins";
export const RAW = "https://raw.githubusercontent.com/better-vault/better-vault-plugins/main/";

export const pluginIcons = [
  "puzzle",
  "chart",
  "table",
  "book",
  "calendar",
  "note",
  "palette",
  "sparkles",
  "code",
  "globe",
  "image",
  "music",
  "video",
  "brain",
  "clock",
  "target",
] as const;

export const entry = z.object({
  id: z.string().regex(/^[a-z0-9-]{1,64}$/),
  name: z.string().max(60),
  version: z.string().max(40),
  description: z.string().max(500).default(""),
  author: z.string().max(100).default(""),
  icon: z.enum(pluginIcons).catch("puzzle"),
  tags: z.array(z.string().max(30)).max(8).default([]),
  permissions: z.array(z.string().max(40)).default([]),
  adds: z
    .object({
      studioTools: z.number().default(0),
      panels: z.number().default(0),
      mods: z.number().default(0),
      theme: z.boolean().default(false),
    })
    .default({ studioTools: 0, panels: 0, mods: 0, theme: false }),
  screenshots: z.array(z.string().max(200)).max(6).default([]),
  size: z.number().default(0),
  updatedAt: z.string().default(""),
});
export type PluginEntry = z.infer<typeof entry>;

/** A picture in the plugin repo, as a URL. */
export const rawUrl = (path: string) => `${RAW}${path}`;

/** What each permission lets a plugin do, as the app says it. */
export const permissionLabels: Record<string, string> = {
  "read:notebooks": "Read your notebooks",
  "read:sources": "Read notebooks' sources",
  "read:notes": "Read your notes",
  "read:skills": "Read your skills",
  "read:calendar": "Read your calendar",
  "write:notes": "Create notes",
  "write:calendar": "Add calendar events",
  "use:ai": "Use your AI model (it never sees your key)",
};

/** What a plugin adds, in words. */
export function describeAdds(adds: PluginEntry["adds"]): string[] {
  const plural = (count: number, one: string, many: string) =>
    `${count} ${count === 1 ? one : many}`;
  return [
    ...(adds.studioTools ? [plural(adds.studioTools, "Studio tool", "Studio tools")] : []),
    ...(adds.panels ? [plural(adds.panels, "Studio panel", "Studio panels")] : []),
    ...(adds.mods ? [plural(adds.mods, "mod", "mods")] : []),
    ...(adds.theme ? ["Theme"] : []),
  ];
}
