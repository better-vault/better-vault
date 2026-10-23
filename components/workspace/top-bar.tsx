"use client";

import { Book02Icon, BubbleChatIcon, DashboardSquare01Icon } from "@hugeicons/core-free-icons";
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/icon";
import { Tabs } from "@/components/panelui/tabs";
import { SettingsSheet } from "@/components/settings/settings-sheet";
import { StudioSheet } from "@/components/studio/studio-sheet";
import { Button } from "@/components/panelui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { useSources } from "@/lib/db/sources";
import { NotebookMenu } from "./notebook-menu";
import { useWorkspace } from "./workspace-context";

/**
 * Top left: a button group with Settings, then "Add", which opens the
 * Studio; then the notebook's name. Top right: the tabs that switch the main
 * view.
 */
export function TopBar() {
  const { t } = useTranslation("workspace");
  const { t: tSettings } = useTranslation("settings");
  const { notebook, studioOpen, setStudioOpen, settingsOpen, setSettingsOpen } = useWorkspace();
  const sources = useSources(notebook.id);
  const selected = sources?.filter((source) => source.selected).length ?? 0;

  return (
    <header className="flex items-center gap-3 px-3 pt-3 pb-2 sm:px-4">
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        {/* shadcn's ButtonGroup holding Panel buttons: Panel's outline look,
            with the group's two ends rounded into one pill. */}
        <ButtonGroup aria-label={t("toolbar")}>
          <SettingsSheet
            open={settingsOpen}
            onOpenChange={setSettingsOpen}
            trigger={
              <Button
                variant="outline"
                size="icon"
                aria-label={tSettings("title")}
                title={tSettings("title")}
                className="w-10 rounded-s-full! ps-0.5"
              />
            }
          />
          <StudioSheet
            open={studioOpen}
            onOpenChange={setStudioOpen}
            trigger={
              <Button variant="outline" size="md" title={t("openStudio")} className="rounded-e-full! ps-3 pe-4">
                {t("add")}
              </Button>
            }
          />
        </ButtonGroup>
        <NotebookMenu />
      </div>
      <Tabs.List aria-label={t("tabs.label")} className="shrink-0">
        <Tabs.Trigger value="chat">
          <Icon icon={BubbleChatIcon} size={16} />
          <span className="max-sm:sr-only">{t("tabs.chat")}</span>
        </Tabs.Trigger>
        <Tabs.Trigger value="sources">
          <Icon icon={Book02Icon} size={16} />
          <span className="max-sm:sr-only">{t("tabs.sources")}</span>
          {sources && sources.length > 0 ? <Tabs.Badge>{selected}</Tabs.Badge> : null}
        </Tabs.Trigger>
        <Tabs.Trigger value="studio">
          <Icon icon={DashboardSquare01Icon} size={16} />
          <span className="max-sm:sr-only">{t("tabs.studio")}</span>
        </Tabs.Trigger>
      </Tabs.List>
    </header>
  );
}
