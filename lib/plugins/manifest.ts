import { z } from "zod";
import { unsafeCss } from "./css";

/**
 * A plugin: panels and themes that run inside better-vault. It follows
 * DeepSeek Harness's "everything is a plugin" idea, safely: a plugin is a
 * manifest (what it is, what it may read or change, where it shows) and a
 * few files (HTML, CSS, JavaScript as text). Its panels run in a sandboxed
 * frame with no network and no access to the app's storage; they reach the
 * user's data only through the bridge (`lib/plugins/bridge.ts`), and only
 * as far as the permissions the user granted. A theme changes only the
 * app's colour tokens and runs no code.
 *
 * Agents build plugins through the desktop app's MCP server
 * (`describe_app`, then `install_plugin`); people install them from a
 * `.bvplugin.json` file. Either way they arrive turned off.
 */

/** The newest manifest format. Version 1 manifests (panels and themes only) still install. */
export const MANIFEST_VERSION = 2;

/** What a plugin may ask for. Reads are of the user's data; writes change it. */
export const pluginPermissions = [
  "read:notebooks",
  "read:sources",
  "read:notes",
  "read:skills",
  "read:calendar",
  "write:notes",
  "write:calendar",
  "use:ai",
] as const;
export type PluginPermission = (typeof pluginPermissions)[number];

/**
 * Where a plugin's panel shows. `studio`: in the Studio sheet's Plugins
 * group, opened in the Studio tab with the notebook as context.
 * `studio-tool`: a tool of its own in the Studio sheet's grid, beside the
 * built-in ones, with its description, opened full size in the Studio tab.
 */
export const pluginSlots = ["studio", "studio-tool"] as const;
export type PluginSlot = (typeof pluginSlots)[number];

/** The colour tokens a theme may set (src/styles/tokens.css). */
export const themeTokens = [
  "background",
  "foreground",
  "card",
  "card-foreground",
  "popover",
  "popover-foreground",
  "primary",
  "primary-foreground",
  "secondary",
  "secondary-foreground",
  "muted",
  "muted-foreground",
  "accent",
  "accent-foreground",
  "destructive",
  "border",
  "input",
  "ring",
  "info",
  "info-foreground",
  "success",
  "warning",
  "chart-1",
  "chart-2",
  "chart-3",
  "chart-4",
  "chart-5",
] as const;
export type ThemeToken = (typeof themeTokens)[number];

/** Icons a plugin can pick (components/plugins/plugin-icons.ts draws them). */
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
export type PluginIcon = (typeof pluginIcons)[number];

/**
 * A colour a theme may use: hex, rgb(), hsl(), oklch() or oklab(), with
 * nothing else in it, so a value can't escape its CSS declaration.
 */
const COLOUR =
  /^(#[0-9a-f]{3,8}|(?:rgb|rgba|hsl|hsla|oklch|oklab|lab|lch)\(\s*[-0-9.%\s,/a-z]*\))$/i;
export const colourSchema = z
  .string()
  .max(80)
  .regex(COLOUR, "Use a colour: #hex, rgb(), hsl() or oklch().")
  .refine((value) => !/url|var|expression|[;{}<>\\]/i.test(value), "Not a plain colour.");

const palette = z.partialRecord(z.enum(themeTokens), colourSchema);

/**
 * How the Notes graph view looks (lib/notes/graph-style.ts): its layout, and
 * how nodes, links and labels are drawn. Colours are theme token names (such
 * as "chart-4") or plain colours.
 */
const graphColour = z.union([z.string().regex(/^[a-z][a-z0-9-]{0,40}$/), colourSchema]);
export const graphStyleSchema = z.object({
  layout: z.enum(["force", "radial"]).default("force"),
  /** Behind the graph; the page's own background when left out. */
  background: graphColour.optional(),
  node: z
    .object({
      /** One colour for every node, or "vault" for each vault's colour. */
      color: z.union([z.literal("vault"), graphColour]).default("vault"),
      size: z.number().min(0.4).max(3).default(1),
      /** A soft ring around the hub (the open note, or the most linked one). */
      hubRing: z.boolean().default(false),
    })
    .default({ color: "vault", size: 1, hubRing: false }),
  link: z
    .object({
      color: graphColour.default("border"),
      width: z.number().min(0.25).max(4).default(1),
      opacity: z.number().min(0.05).max(1).default(1),
      curved: z.boolean().default(false),
    })
    .default({ color: "border", width: 1, opacity: 1, curved: false }),
  label: z
    .object({
      font: z.enum(["sans", "mono", "serif"]).default("sans"),
      color: graphColour.default("foreground"),
      uppercase: z.boolean().default(false),
      size: z.number().min(8).max(18).default(12),
    })
    .default({ font: "sans", color: "foreground", uppercase: false, size: 12 }),
});
export type GraphStyle = z.infer<typeof graphStyleSchema>;

/** Plugin ids: lowercase words joined by hyphens, as in `notebook-stats`. */
export const PLUGIN_ID = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;

export const panelSchema = z.object({
  id: z.string().regex(PLUGIN_ID),
  title: z.string().min(1).max(60),
  slot: z.enum(pluginSlots),
  /** The file the panel opens: one of the plugin's `files`. */
  entry: z.string().max(200).default("index.html"),
  /** One line under a Studio tool's name. */
  description: z.string().max(140).optional(),
});

/**
 * A mod: CSS for the whole app (as Zen Browser's mods are), to reshape its
 * layout, spacing, corners and type, or hide parts. It can load nothing:
 * `@import` and links to anything but `data:` are refused (lib/plugins/css.ts),
 * and the app's Content-Security-Policy blocks other hosts as well. It targets
 * the stable `data-bv` hooks on the app's main surfaces.
 */
export const modSchema = z.object({
  id: z.string().regex(PLUGIN_ID),
  title: z.string().min(1).max(60),
  /** A CSS file among the plugin's `files`. */
  file: z.string().max(200),
});

export const manifestSchema = z.object({
  manifestVersion: z.union([z.literal(1), z.literal(MANIFEST_VERSION)]),
  id: z.string().regex(PLUGIN_ID, "Use lowercase words joined by hyphens."),
  name: z.string().min(1).max(60),
  version: z.string().regex(/^\d+\.\d+\.\d+(?:-[\w.]+)?$/, "Use a version like 1.0.0."),
  description: z.string().max(500).default(""),
  author: z.string().max(100).optional(),
  icon: z.enum(pluginIcons).default("puzzle"),
  permissions: z.array(z.enum(pluginPermissions)).max(pluginPermissions.length).default([]),
  contributes: z
    .object({
      panels: z.array(panelSchema).max(10).default([]),
      theme: z.object({ light: palette.optional(), dark: palette.optional() }).optional(),
      mods: z.array(modSchema).max(10).default([]),
      /** Looks for the Notes graph view, offered beside the built-in ones. */
      graph: z
        .array(
          z.object({
            id: z.string().regex(PLUGIN_ID),
            title: z.string().min(1).max(60),
            style: graphStyleSchema,
          }),
        )
        .max(5)
        .default([]),
    })
    .refine(
      (value) =>
        value.panels.length > 0 || value.theme || value.mods.length > 0 || value.graph.length > 0,
      "Add a panel, a theme, a mod or a graph style.",
    ),
  /** Words to find it by in the plugin directory. */
  tags: z.array(z.string().max(30)).max(8).default([]),
});
export type PluginManifest = z.infer<typeof manifestSchema>;

/** A file's path in a plugin: letters, digits, dots, hyphens and folders, no "..". */
const FILE_PATH = /^(?!.*\.\.)[\w-][\w./-]{0,199}$/;
export const MAX_PLUGIN_BYTES = 2 * 1024 * 1024;

/** A plugin as it is installed and shared: its manifest and its files. */
export const pluginBundleSchema = z
  .object({
    manifest: manifestSchema,
    files: z.record(z.string().regex(FILE_PATH, "Bad file path."), z.string()).default({}),
  })
  .superRefine((bundle, ctx) => {
    const size = Object.entries(bundle.files).reduce(
      (sum, [path, body]) => sum + path.length + body.length,
      0,
    );
    if (size > MAX_PLUGIN_BYTES)
      ctx.addIssue({ code: "custom", message: "A plugin's files may be 2 MB at most." });
    for (const panel of bundle.manifest.contributes.panels)
      if (!(panel.entry in bundle.files))
        ctx.addIssue({
          code: "custom",
          message: `Panel "${panel.id}" opens ${panel.entry}, which is not among the files.`,
        });
    for (const mod of bundle.manifest.contributes.mods) {
      const css = bundle.files[mod.file];
      if (css === undefined)
        ctx.addIssue({
          code: "custom",
          message: `Mod "${mod.id}" uses ${mod.file}, which is not among the files.`,
        });
      else {
        const problem = unsafeCss(css);
        if (problem) ctx.addIssue({ code: "custom", message: `Mod "${mod.id}": ${problem}` });
      }
    }
  });
export type PluginBundle = z.infer<typeof pluginBundleSchema>;

/** Reads a bundle from untrusted JSON (a file, an agent), or says what is wrong with it. */
export function parsePluginBundle(
  value: unknown,
): { ok: true; bundle: PluginBundle } | { ok: false; error: string } {
  const result = pluginBundleSchema.safeParse(value);
  if (result.success) return { ok: true, bundle: result.data };
  const issue = result.error.issues[0];
  const where = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
  return { ok: false, error: `${where}${issue.message}` };
}

/** The CSS a theme plugin adds: its colours for light mode and for dark mode. */
export function themeCss(theme: NonNullable<PluginManifest["contributes"]["theme"]>): string {
  const block = (selector: string, values: Partial<Record<ThemeToken, string>> | undefined) => {
    const lines = Object.entries(values ?? {})
      .filter(
        ([token, value]) =>
          (themeTokens as readonly string[]).includes(token) &&
          colourSchema.safeParse(value).success,
      )
      .map(([token, value]) => `  --${token}: ${value};`);
    return lines.length > 0 ? `${selector} {\n${lines.join("\n")}\n}` : "";
  };
  return [block(":root:not(.dark)", theme.light), block(":root.dark", theme.dark)]
    .filter(Boolean)
    .join("\n");
}
