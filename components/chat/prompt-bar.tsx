"use client";

import {
  Add01Icon,
  Book02Icon,
  Delete02Icon,
  FileAddIcon,
  Globe02Icon,
} from "@hugeicons/core-free-icons";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Segmented } from "@/components/common/segmented";
import { Icon } from "@/components/icon";
import { Menu } from "@/components/panelui/menu";
import { Prompt, type PromptState } from "@/components/panelui/prompt";
import { useWorkspace } from "@/components/workspace/workspace-context";
import { modelKey, parseModelKey, providers } from "@/lib/ai/catalog";
import { providerIcons } from "@/lib/ai/provider-icons";
import type { ChatMode } from "@/lib/chat/types";
import { activeModel, availableModels, updateSettings, useSettings } from "@/lib/db/settings";
import { useSources } from "@/lib/db/sources";
import { useChatSession } from "./chat-provider";

/** The prompt at the bottom of the notebook: question, mode, model and send. */
export function PromptBar() {
  const { t } = useTranslation("chat");
  const { t: tCommon } = useTranslation();
  const { notebook, setTab, setSettingsOpen, setAddSourceOpen } = useWorkspace();
  const chat = useChatSession();
  const settings = useSettings();
  const sources = useSources(notebook.id);
  const [draft, setDraft] = useState("");
  const [clearing, setClearing] = useState(false);
  // Set while a send is refused, so the prompt does not clear what was written.
  const keepDraft = useRef(false);

  const models = settings ? availableModels(settings) : [];
  const model = settings ? activeModel(settings) : null;
  const webAvailable = model ? providers[model.provider].webSearch : false;
  const mode: ChatMode = chat.mode === "web" && webAvailable ? "web" : "sources";
  const selected = sources?.filter((source) => source.selected).length ?? 0;
  const needsSource = mode === "sources" && selected === 0;
  const status: PromptState = chat.status === "ready" ? "idle" : chat.status;

  const modelItems = models.map((ref) => ({
    value: modelKey(ref),
    label: ref.modelId,
    icon: <Icon icon={providerIcons[ref.provider]} size={16} />,
    description: providers[ref.provider].name,
  }));

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-background via-background/80 to-transparent px-3 pt-8 pb-3 sm:px-4 sm:pb-4">
      <div className="pointer-events-auto mx-auto w-full max-w-3xl">
        <Prompt
          value={draft}
          onValueChange={(next) => {
            if (keepDraft.current) {
              keepDraft.current = false;
              return;
            }
            setDraft(next);
          }}
          status={status}
          disabled={!model}
          onStop={chat.stop}
          onSubmit={({ text }) => {
            if (needsSource) {
              keepDraft.current = true;
              toast(t("noSources"));
              return;
            }
            setTab("chat");
            chat.send(text).catch((error: unknown) => {
              toast.error(
                t("error", { error: error instanceof Error ? error.message : String(error) }),
              );
            });
          }}
        >
          <Prompt.Banner open={settings !== undefined && !model}>
            {t("setup.banner")}
            <Prompt.BannerAction onClick={() => setSettingsOpen(true)}>
              {t("setup.action")}
            </Prompt.BannerAction>
          </Prompt.Banner>
          <Prompt.Field>
            <Prompt.Textarea
              placeholder={t(`placeholder.${mode}`)}
              aria-label={t(`placeholder.${mode}`)}
            />
            <Prompt.Footer>
              <Prompt.Tools>
                <Prompt.Menu label={t("menu")} icon={<Icon icon={Add01Icon} />}>
                  <Menu.Item onClick={() => setAddSourceOpen(true)}>
                    <Icon icon={FileAddIcon} />
                    {t("addSource")}
                  </Menu.Item>
                  <Menu.Item
                    disabled={chat.messages.length === 0}
                    onClick={() => setClearing(true)}
                  >
                    <Icon icon={Delete02Icon} />
                    {t("clearChat")}
                  </Menu.Item>
                </Prompt.Menu>
                <Segmented<ChatMode>
                  size="sm"
                  aria-label={t("mode.label")}
                  value={mode}
                  onValueChange={chat.setMode}
                  options={[
                    {
                      value: "sources",
                      label: t("mode.sources"),
                      icon: <Icon icon={Book02Icon} size={14} />,
                      title: t("mode.sourcesHint"),
                    },
                    {
                      value: "web",
                      label: t("mode.web"),
                      icon: <Icon icon={Globe02Icon} size={14} />,
                      disabled: !webAvailable,
                      title:
                        !webAvailable && model
                          ? t("mode.webUnavailable", { name: providers[model.provider].name })
                          : t("mode.webHint"),
                    },
                  ]}
                />
                {modelItems.length > 0 && model ? (
                  <Prompt.Model
                    items={modelItems}
                    value={modelKey(model)}
                    variant="ghost"
                    label={t("model")}
                    className="max-w-48"
                    onValueChange={(key) => {
                      const next = parseModelKey(key);
                      if (next) void updateSettings((saved) => void (saved.model = next));
                    }}
                  />
                ) : null}
              </Prompt.Tools>
              <Prompt.Submit sendLabel={t("send")} stopLabel={t("stop")} />
            </Prompt.Footer>
          </Prompt.Field>
          <Prompt.Context open={sources !== undefined && sources.length > 0 && mode === "sources"}>
            <Prompt.ContextItem onSelect={() => setTab("sources")}>
              <Icon icon={Book02Icon} size={14} />
              {tCommon("sourceCount", { count: selected })}
            </Prompt.ContextItem>
          </Prompt.Context>
        </Prompt>
      </div>
      <ConfirmDialog
        open={clearing}
        onOpenChange={setClearing}
        title={t("clear.title")}
        body={t("clear.body")}
        confirmLabel={t("clear.confirm")}
        onConfirm={() => chat.clear()}
      />
    </div>
  );
}
