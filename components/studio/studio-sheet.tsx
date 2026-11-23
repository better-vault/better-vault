import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { Sheet } from "@/components/panelui/sheet";
import { useWorkspace } from "@/components/workspace/workspace-context";
import { availableImageModels, useSettings } from "@/lib/db/settings";
import { useStudioSettings } from "@/lib/studio/settings";
import { toolDefinitions } from "@/studio/definitions";
import { studioToolIds, studioTools, type StudioToolId } from "@/studio/tools";
import { Icon } from "@/components/icon";
import { pluginIconSet } from "@/components/plugins/plugin-icons";
import { usePlugins } from "@/lib/db/plugins";
import { OutputList } from "./output-list";
import { useStudioRunner } from "./studio-runner";
import { ToolTile } from "./tool-tile";

interface StudioSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: ReactElement;
}

/**
 * The Studio sheet, opened by "Add": the Studio's tools, and under them what has been created.
 * Choosing a tool closes the sheet and opens the tool's dialog; choosing an
 * output closes it and opens the output in the Studio tab.
 */
export function StudioSheet({ open, onOpenChange, trigger }: StudioSheetProps) {
  const { t } = useTranslation("studio");
  const { t: tCommon } = useTranslation();
  const { notebook, openOutput, openTool, openPluginPanel } = useWorkspace();
  const enabledPlugins = (usePlugins() ?? []).filter((plugin) => plugin.enabled);
  const panelsIn = (slot: "studio" | "studio-tool") =>
    enabledPlugins.flatMap((plugin) =>
      plugin.manifest.contributes.panels
        .filter((panel) => panel.slot === slot)
        .map((panel) => ({ plugin, panel })),
    );
  const panels = panelsIn("studio");
  // Plugin Studio tools sit in the grid beside the built-in ones.
  const pluginTools = panelsIn("studio-tool");
  const runner = useStudioRunner();
  const navigate = useNavigate();
  const settings = useSettings();
  const noImageModel = settings ? availableImageModels(settings).length === 0 : false;
  const studioSettings = useStudioSettings();
  // Tools turned off in Settings → Studio leave the sheet; their outputs stay listed below.
  const shownTools = studioToolIds.filter((id) => !studioSettings?.hidden.includes(id));

  // Notes live in the vault, not in the notebook: the tile opens the notes
  // page showing this notebook's notes. A local tool (the whiteboard, the
  // canvas) has no dialog: it is made at once and opened.
  async function choose(id: StudioToolId) {
    if (id === "notes") {
      onOpenChange(false);
      navigate(`/?view=notes&notebook=${encodeURIComponent(notebook.id)}`);
      return;
    }
    const local = toolDefinitions[id]?.local;
    if (!local) {
      openTool(id);
      return;
    }
    try {
      const outputId = await runner.createLocal(id, {
        title: t(`tools.${id}.name`),
        data: local.blank(),
      });
      openOutput(outputId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <Sheet side="left" open={open} onOpenChange={onOpenChange}>
      <Sheet.Trigger render={trigger} />
      <Sheet.Content
        closeLabel={tCommon("actions.close")}
        className="w-[min(26rem,calc(100vw-2*var(--sheet-gap)))]"
      >
        <Sheet.Header title={t("title")} description={t("description")} />
        <Sheet.Body>
          {shownTools.length === 0 ? (
            <p className="rounded-2xl bg-muted px-4 py-3 text-sm text-muted-foreground">
              {t("allHidden")}
            </p>
          ) : null}
          <div data-bv="studio-tools" className="grid grid-cols-2 gap-2">
            {shownTools.map((id) => (
              <ToolTile
                key={id}
                tool={studioTools[id]}
                onSelect={() => void choose(id)}
                badge={toolDefinitions[id]?.imageModel && noImageModel ? t("needsKey") : undefined}
                // An odd one out spans the whole row.
                className={
                  (shownTools.length + pluginTools.length) % 2 === 1 &&
                  pluginTools.length === 0 &&
                  id === shownTools.at(-1)
                    ? "col-span-2"
                    : undefined
                }
              />
            ))}
            {pluginTools.map(({ plugin, panel }, at) => (
              <button
                key={`${plugin.id}:${panel.id}`}
                type="button"
                onClick={() => openPluginPanel(plugin.id, panel.id)}
                title={panel.description || plugin.manifest.description || panel.title}
                data-bv="plugin-tool"
                className={cn(
                  "group relative flex h-14 cursor-pointer items-center gap-2.5 rounded-2xl bg-muted/70 px-3 text-start transition-[background-color,scale] duration-150 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]",
                  (shownTools.length + pluginTools.length) % 2 === 1 &&
                    at === pluginTools.length - 1 &&
                    "col-span-2",
                )}
              >
                <Icon
                  icon={pluginIconSet[plugin.manifest.icon]}
                  size={20}
                  className="shrink-0 text-chart-5"
                />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{panel.title}</span>
                <span className="shrink-0 rounded-full bg-chart-5/15 px-1.5 py-0.5 text-[0.6875rem] font-medium text-chart-5">
                  {t("plugins.tag")}
                </span>
              </button>
            ))}
          </div>
          {panels.length > 0 ? (
            <section className="mt-6">
              <h3 className="mb-2 px-1 text-xs font-medium text-muted-foreground">
                {t("plugins.title")}
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {panels.map(({ plugin, panel }) => (
                  <button
                    key={`${plugin.id}:${panel.id}`}
                    type="button"
                    onClick={() => openPluginPanel(plugin.id, panel.id)}
                    title={plugin.manifest.description || plugin.manifest.name}
                    className="flex h-14 cursor-pointer items-center gap-2.5 rounded-2xl bg-muted/70 px-3 text-start transition-[background-color,scale] duration-150 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]"
                  >
                    <Icon
                      icon={pluginIconSet[plugin.manifest.icon]}
                      size={20}
                      className="shrink-0"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{panel.title}</span>
                      <span className="block truncate text-[0.6875rem] text-muted-foreground">
                        {plugin.manifest.name}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ) : null}
          <section className="mt-6 pb-4">
            <h3 className="mb-1 px-1 text-xs font-medium text-muted-foreground">{t("created")}</h3>
            <OutputList notebookId={notebook.id} onOpen={(output) => openOutput(output.id)} />
          </section>
        </Sheet.Body>
      </Sheet.Content>
    </Sheet>
  );
}
