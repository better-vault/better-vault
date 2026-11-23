import { useTranslation } from "react-i18next";
import { usePlugins } from "@/lib/db/plugins";
import {
  builtInGraphStyles,
  setGraphStyle,
  useGraphStyleId,
  type BuiltInGraphStyle,
  type GraphStyle,
} from "./graph-style";

export interface GraphStyleOption {
  id: string;
  title: string;
  /** The plugin that adds it, for plugin styles. */
  plugin?: string;
  style: GraphStyle;
}

/**
 * The graph looks to choose from (the built-in ones, then those added by
 * plugins that are on) and the chosen one. A style whose plugin was turned
 * off or removed falls back to Classic.
 */
export function useGraphStyle() {
  const { t } = useTranslation("notes");
  const plugins = usePlugins() ?? [];
  const chosen = useGraphStyleId();
  const options: GraphStyleOption[] = [
    ...(Object.keys(builtInGraphStyles) as BuiltInGraphStyle[]).map((id) => ({
      id,
      title: t(`graph.styles.${id}`),
      style: builtInGraphStyles[id],
    })),
    ...plugins
      .filter((plugin) => plugin.enabled)
      .flatMap((plugin) =>
        (plugin.manifest.contributes.graph ?? []).map((entry) => ({
          id: `${plugin.id}/${entry.id}`,
          title: entry.title,
          plugin: plugin.manifest.name,
          style: entry.style,
        })),
      ),
  ];
  const current = options.find((option) => option.id === chosen) ?? options[0];
  return { options, current, choose: setGraphStyle };
}
