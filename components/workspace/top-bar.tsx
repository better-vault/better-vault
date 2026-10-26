"use client";

import {
  Add01Icon,
  Book02Icon,
  BubbleChatIcon,
  DashboardSquare01Icon,
  Settings01Icon,
} from "@hugeicons/core-free-icons";
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/icon";
import { Tabs } from "@/components/panelui/tabs";
import { SettingsSheet } from "@/components/settings/settings-sheet";
import { StudioSheet } from "@/components/studio/studio-sheet";
import { Button } from "@/components/panelui/button";
import { ButtonGroup } from "@/components/panelui/button-group";
import { HistorySheet } from "@/components/chat/history-sheet";
import { useSources } from "@/lib/db/sources";
import { NotebookMenu } from "./notebook-menu";
import { useWorkspace } from "./workspace-context";

/**
 * Top left: Settings and Create (which opens the Studio sheet), and on the
 * Chat tab, History; then the notebook's name. Top right: the tabs that
 * switch the main view.
 */
export function TopBar() {
  const { t } = useTranslation("workspace");
  const { t: tSettings } = useTranslation("settings");
  const { t: tChat } = useTranslation("chat");
  const { notebook, tab, studioOpen, setStudioOpen, settingsOpen, setSettingsOpen } =
    useWorkspace();
  const sources = useSources(notebook.id);
  const selected = sources?.filter((source) => source.selected).length ?? 0;

  return (
    <header className="flex items-center gap-3 px-3 pt-3 pb-2 sm:px-4">
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        {/* Panel's ButtonGroup: Settings and Create share a track; on the Chat
            tab, History follows, split off and filled. */}
        <ButtonGroup aria-label={t("toolbar")}>
          <ButtonGroup aria-label={t("toolbar")}>
            <SettingsSheet
              open={settingsOpen}
              onOpenChange={setSettingsOpen}
              trigger={
                <Button variant="outline" size="sm" title={tSettings("title")}>
                  <Icon icon={Settings01Icon} size={16} />
                  <span className="max-sm:sr-only">{tSettings("title")}</span>
                </Button>
              }
            />
            <StudioSheet
              open={studioOpen}
              onOpenChange={setStudioOpen}
              trigger={
                <Button variant="outline" size="sm" title={t("openStudio")}>
                  <Icon icon={Add01Icon} size={16} />
                  <span className="max-sm:sr-only">{t("create")}</span>
                </Button>
              }
            />
          </ButtonGroup>
          {tab === "chat" ? (
            // A track of its own, so it lines up with the one beside it.
            <ButtonGroup aria-label={tChat("history.title")}>
              <HistorySheet
                trigger={
                  <Button size="sm" title={tChat("history.title")}>
                    <Icon icon={BubbleChatIcon} size={16} />
                    <span className="max-sm:sr-only">{tChat("history.open")}</span>
                  </Button>
                }
              />
            </ButtonGroup>
          ) : null}
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
