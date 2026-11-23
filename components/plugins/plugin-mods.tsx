import { usePlugins } from "@/lib/db/plugins";
import { safeModCss } from "@/lib/plugins/css";

/**
 * The CSS of the mods that are turned on, Zen-style: plugins that reshape
 * the app. Each is checked again here (it can load nothing and run nothing),
 * and goes away the moment its plugin is turned off or removed, which puts
 * the app back as it was.
 */
export function PluginMods() {
  const plugins = usePlugins();
  const css = (plugins ?? [])
    .filter((plugin) => plugin.enabled)
    .flatMap((plugin) =>
      (plugin.manifest.contributes.mods ?? []).map((mod) => {
        const body = safeModCss(plugin.files[mod.file]);
        return body ? `/* ${plugin.id}/${mod.id} */\n${body}` : "";
      }),
    )
    .filter(Boolean)
    .join("\n\n");
  return css ? <style data-plugin-mods>{css}</style> : null;
}
