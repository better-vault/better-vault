import { useTranslation } from "react-i18next";
import { Icon } from "@/components/icon";
import { Sheet } from "@/components/panelui/sheet";
import { Switch } from "@/components/panelui/switch";
import { setChatVisuals, setStudioToolShown, useStudioSettings } from "@/lib/studio/settings";
import { cn } from "@/lib/utils";
import { studioToolIds, studioTools } from "@/studio/tools";

/**
 * Settings → Studio: a switch per tool. A tool turned off leaves the Studio
 * sheet; what it already made stays in the notebook. One tool always stays on.
 */
export function StudioPanel() {
  const { t } = useTranslation("settings");
  const { t: tStudio } = useTranslation("studio");
  const settings = useStudioSettings();
  if (!settings) return null;
  const shownCount = studioToolIds.length - settings.hidden.length;

  return (
    <>
      <Sheet.Header title={t("studio.title")} description={t("studio.description")} />
      <Sheet.Body>
        <label className="mb-4 flex cursor-pointer items-center gap-3 rounded-2xl bg-muted/50 px-3 py-2.5">
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium">{t("studio.visuals")}</span>
            <span className="block text-xs text-muted-foreground">{t("studio.visualsHint")}</span>
          </span>
          <Switch
            checked={settings.visuals}
            onCheckedChange={(next) => void setChatVisuals(next)}
          />
        </label>
        <h3 className="pb-1 text-xs font-medium text-muted-foreground">{t("studio.tools")}</h3>
        <ul className="-mx-2 flex flex-col gap-0.5 pb-4">
          {studioToolIds.map((id) => {
            const tool = studioTools[id];
            const shown = !settings.hidden.includes(id);
            const last = shown && shownCount === 1;
            return (
              <li key={id}>
                <label
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-2xl px-2.5 py-2 hover:bg-accent",
                    last && "cursor-default",
                  )}
                  title={last ? t("studio.lastOne") : undefined}
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted">
                    <Icon icon={tool.icon} size={18} className={tool.tint} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{tStudio(`tools.${id}.name`)}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {tStudio(`tools.${id}.description`)}
                    </span>
                  </span>
                  <Switch
                    checked={shown}
                    disabled={last}
                    onCheckedChange={(next) => void setStudioToolShown(id, next)}
                  />
                </label>
              </li>
            );
          })}
        </ul>
      </Sheet.Body>
    </>
  );
}
