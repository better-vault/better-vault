import {
  Add01Icon,
  Book02Icon,
  PencilEdit02Icon,
  FileAddIcon,
  Globe02Icon,
} from "@hugeicons/core-free-icons";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Segmented } from "@/components/common/segmented";
import { Icon } from "@/components/icon";
import { ProviderIcon } from "@/components/provider-icon";
import { Menu } from "@/components/panelui/menu";
import { ModelPicker } from "@/components/panelui/model-picker";
import { Prompt, type PromptState } from "@/components/panelui/prompt";
import { useWorkspace } from "@/components/workspace/workspace-context";
import { chatProviderIds, modelKey, parseModelKey, providers } from "@/lib/ai/catalog";
import type { ChatMode } from "@/lib/chat/types";
import {
  activeModel,
  availableModels,
  updateSettings,
  usesChatGPT,
  useSettings,
} from "@/lib/db/settings";
import { useSources } from "@/lib/db/sources";
import { useChatSession } from "./chat-provider";
import { EffortMenu } from "./effort-menu";
import { UsageRing } from "./usage-ring";

/** The prompt at the bottom of the notebook: question, mode, model and send. */
export function PromptBar() {
  const { t } = useTranslation("chat");
  const { t: tCommon } = useTranslation();
  const { t: tSettings } = useTranslation("settings");
  const { notebook, setTab, setSettingsOpen, setAddSourceOpen } = useWorkspace();
  const chat = useChatSession();
  const settings = useSettings();
  const sources = useSources(notebook.id);
  const [draft, setDraft] = useState("");
  // Set while a send is refused, so the prompt does not clear what was written.
  const keepDraft = useRef(false);

  const models = settings ? availableModels(settings) : [];
  const model = settings ? activeModel(settings) : null;
  const webAvailable = model ? providers[model.provider].webSearch : false;
  const mode: ChatMode = chat.mode === "web" && webAvailable ? "web" : "sources";
  const selected = sources?.filter((source) => source.selected).length ?? 0;
  const needsSource = mode === "sources" && selected === 0;
  const status: PromptState = chat.status === "ready" ? "idle" : chat.status;

  const modelItems = models.map((ref) => {
    const info = providers[ref.provider];
    const listed = settings?.providers[ref.provider].contextTokens[ref.modelId];
    return {
      value: modelKey(ref),
      label: ref.modelId,
      provider: ref.provider,
      note:
        settings && usesChatGPT(settings, ref.provider)
          ? tSettings("chatgpt.planLabel")
          : undefined,
      contextWindow: listed,
      tags: [
        ...(info.webSearch ? [t("modelTags.web")] : []),
        ...(info.local ? [t("modelTags.local")] : []),
      ],
    };
  });
  const pickerProviders = chatProviderIds
    .filter((id) => models.some((ref) => ref.provider === id))
    .map((id) => ({
      value: id,
      label: providers[id].name,
      icon: <ProviderIcon provider={id} size={20} />,
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
                  <Menu.Item disabled={chat.messages.length === 0} onClick={() => chat.startNew()}>
                    <Icon icon={PencilEdit02Icon} />
                    {t("newChat")}
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
                {modelItems.length > 0 && model && settings ? (
                  <>
                    <ModelPicker
                      variant="rail"
                      items={modelItems}
                      providers={pickerProviders}
                      value={modelKey(model)}
                      label={t("model")}
                      favorites={settings.favoriteModels}
                      onFavoritesChange={(favorites) =>
                        void updateSettings((saved) => void (saved.favoriteModels = favorites))
                      }
                      onValueChange={(key) => {
                        const next = parseModelKey(key);
                        if (next) void updateSettings((saved) => void (saved.model = next));
                      }}
                    >
                      <ModelPicker.Trigger
                        appearance="ghost"
                        className="max-w-48"
                        placeholder={t("chooseModel")}
                      />
                      <ModelPicker.Content
                        side="top"
                        placeholder={t("searchModels")}
                        emptyText={t("noModels")}
                      />
                    </ModelPicker>
                    <EffortMenu settings={settings} provider={model.provider} />
                  </>
                ) : null}
              </Prompt.Tools>
              <Prompt.Submit sendLabel={t("send")} stopLabel={t("stop")} />
            </Prompt.Footer>
          </Prompt.Field>
          <Prompt.Context
            open={
              (sources !== undefined && sources.length > 0 && mode === "sources") ||
              (model !== null && chat.messages.length > 0)
            }
          >
            {mode === "sources" && sources && sources.length > 0 ? (
              <Prompt.ContextItem onSelect={() => setTab("sources")}>
                <Icon icon={Book02Icon} size={14} />
                {tCommon("sourceCount", { count: selected })}
              </Prompt.ContextItem>
            ) : null}
            {model && settings ? (
              <span className="ms-auto flex items-center">
                <UsageRing
                  messages={chat.messages}
                  settings={settings}
                  model={model}
                  busy={chat.status === "streaming" || chat.status === "submitted"}
                />
              </span>
            ) : null}
          </Prompt.Context>
        </Prompt>
      </div>
    </div>
  );
}
