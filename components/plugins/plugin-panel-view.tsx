import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/icon";
import { Button } from "@/components/panelui/button";
import { useWorkspace } from "@/components/workspace/workspace-context";
import { usePlugins } from "@/lib/db/plugins";
import { PluginFrame } from "./plugin-frame";
import { pluginIconSet } from "./plugin-icons";

/** A plugin's panel in the Studio tab, with the notebook as its context. */
export function PluginPanelView({ pluginId, panelId }: { pluginId: string; panelId: string }) {
  const { t } = useTranslation("studio");
  const { notebook, closePluginPanel } = useWorkspace();
  const plugins = usePlugins();
  const plugin = plugins?.find((each) => each.id === pluginId);
  const panel = plugin?.manifest.contributes.panels.find((each) => each.id === panelId);
  const gone = plugins !== undefined && (!plugin || !plugin.enabled || !panel);

  // A plugin turned off or removed takes its panel with it.
  useEffect(() => {
    if (gone) closePluginPanel();
  }, [gone, closePluginPanel]);
  if (!plugin || !panel || !plugin.enabled) return null;

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 px-4 pt-3 pb-2 sm:px-6">
        <Button variant="ghost" size="sm" className="-ms-2" onClick={closePluginPanel}>
          <Icon icon={ArrowLeft01Icon} size={16} className="rtl:rotate-180" />
          {t("viewer.back")}
        </Button>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-muted">
          <Icon icon={pluginIconSet[plugin.manifest.icon]} size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold">{panel.title}</h2>
          <p className="truncate text-xs text-muted-foreground">
            {t("plugins.byline", { name: plugin.manifest.name, version: plugin.manifest.version })}
          </p>
        </div>
      </header>
      {/* The plugin's area: its own space, clipped to it, with no frame drawn around it. */}
      <div className="min-h-0 flex-1 px-2 pb-2 sm:px-4 sm:pb-4">
        <div className="size-full overflow-hidden rounded-2xl">
          <PluginFrame
            plugin={plugin}
            panelId={panel.id}
            notebook={{ id: notebook.id, title: notebook.title }}
          />
        </div>
      </div>
    </div>
  );
}
