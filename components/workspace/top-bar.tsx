"use client";

import {
  Add01Icon,
  Book02Icon,
  BubbleChatIcon,
  DashboardSquare01Icon,
} from "@hugeicons/core-free-icons";
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/icon";
import { Button } from "@/components/panelui/button";
import { Tabs } from "@/components/panelui/tabs";
import { SettingsSheet } from "@/components/settings/settings-sheet";
import { StudioSheet } from "@/components/studio/studio-sheet";
import { useSources } from "@/lib/db/sources";
import { NotebookMenu } from "./notebook-menu";
import { useWorkspace } from "./workspace-context";

/**
 * Top left: `+` opens the Studio, the gear opens Settings, then the notebook's
 * name. Top right: the tabs that switch the main view.
 */
export function TopBar() {
  const { t } = useTranslation("workspace");
  const { notebook, studioOpen, setStudioOpen, settingsOpen, setSettingsOpen } = useWorkspace();
  const sources = useSources(notebook.id);
  const selected = sources?.filter((source) => source.selected).length ?? 0;

  return (
    <header className="flex items-center gap-3 px-3 pt-3 pb-2 sm:px-4">
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <StudioSheet
          open={studioOpen}
          onOpenChange={setStudioOpen}
          trigger={
            <Button variant="default" shape="pill" size="icon" aria-label={t("openStudio")}>
              <Icon icon={Add01Icon} strokeWidth={2.2} />
            </Button>
          }
        />
        <SettingsSheet open={settingsOpen} onOpenChange={setSettingsOpen} />
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
