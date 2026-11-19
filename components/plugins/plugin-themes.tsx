import { usePlugins } from "@/lib/db/plugins";
import { themeCss } from "@/lib/plugins/manifest";

/**
 * The colours of the theme plugins that are turned on, as one stylesheet.
 * A theme may set only the app's colour tokens (checked as plain colours
 * again here), so it can recolour the app but run nothing.
 */
export function PluginThemes() {
  const plugins = usePlugins();
  const css = (plugins ?? [])
    .filter((plugin) => plugin.enabled && plugin.manifest.contributes.theme)
    .map((plugin) => themeCss(plugin.manifest.contributes.theme!))
    .filter(Boolean)
    .join("\n");
  return css ? <style data-plugin-themes>{css}</style> : null;
}
