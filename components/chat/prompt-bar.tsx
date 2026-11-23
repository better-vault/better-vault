import {
  Add01Icon,
  Book02Icon,
  PencilEdit02Icon,
  FileAddIcon,
  Globe02Icon,
  Cancel01Icon,
  MagicWand01Icon,
} from "@hugeicons/core-free-icons";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Segmented } from "@/components/common/segmented";
import { Icon } from "@/components/icon";
import { Menu } from "@/components/panelui/menu";
import { Prompt, type PromptState } from "@/components/panelui/prompt";
import { useWorkspace } from "@/components/workspace/workspace-context";
import { providers } from "@/lib/ai/catalog";
import type { ChatMode } from "@/lib/chat/types";
import { activeModel, updateSettings, useSettings } from "@/lib/db/settings";
import { useSources } from "@/lib/db/sources";
import { useSkills } from "@/lib/db/skills";
import { useNavigate } from "react-router";
import { useChatSession } from "./chat-provider";
import { ComposerModelPicker } from "./composer-model-picker";
import { EffortMenu } from "./effort-menu";
import { UsageRing } from "./usage-ring";

/** The prompt at the bottom of the notebook: question, mode, model and send. */
export function PromptBar() {
  const { t } = useTranslation("chat");
  const { t: tCommon } = useTranslation();
  const { notebook, setTab, setSettingsOpen, setAddSourceOpen } = useWorkspace();
  const chat = useChatSession();
  const navigate = useNavigate();
  const allSkills = useSkills();
  const vaultSkills = (allSkills ?? []).filter(
    (skill) => skill.vaultId === (notebook.vaultId ?? "default"),
  );
  const attachedSkills = chat.skills.filter((id) =>
    vaultSkills.some((skill) => skill.id === id),
  ).length;
  const settings = useSettings();
  const sources = useSources(notebook.id);
  const [draft, setDraft] = useState("");
  // Set while a send is refused, so the prompt does not clear what was written.
  const keepDraft = useRef(false);

  const model = settings ? activeModel(settings) : null;
  const webAvailable = model ? providers[model.provider].webSearch : false;
  const mode: ChatMode = chat.mode === "web" && webAvailable ? "web" : "sources";
  const selected = sources?.filter((source) => source.selected).length ?? 0;
  const needsSource = mode === "sources" && selected === 0;
  const status: PromptState = chat.status === "ready" ? "idle" : chat.status;

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
                  <Menu.Sub>
                    <Menu.SubTrigger>
                      <Icon icon={MagicWand01Icon} />
                      {t("skills.menu")}
                    </Menu.SubTrigger>
                    <Menu.SubContent>
                      {vaultSkills.length === 0 ? (
                        <Menu.Item disabled>{t("skills.none")}</Menu.Item>
                      ) : (
                        vaultSkills.map((skill) => (
                          <Menu.CheckboxItem
                            key={skill.id}
                            checked={chat.skills.includes(skill.id)}
                            onCheckedChange={(on) =>
                              chat.setSkills(
                                on
                                  ? [...chat.skills, skill.id]
                                  : chat.skills.filter((id) => id !== skill.id),
                              )
                            }
                          >
                            <span className="font-mono text-xs">{skill.name}</span>
                          </Menu.CheckboxItem>
                        ))
                      )}
                      <Menu.Separator />
                      <Menu.Item onClick={() => navigate("/?view=skills")}>
                        {t("skills.manage")}
                      </Menu.Item>
                    </Menu.SubContent>
                  </Menu.Sub>
                </Prompt.Menu>
                {attachedSkills > 0 ? (
                  <button
                    type="button"
                    onClick={() => chat.setSkills([])}
                    title={t("skills.clear")}
                    className="flex h-7 cursor-pointer items-center gap-1 rounded-full bg-primary/10 px-2 text-xs text-primary outline-none hover:bg-primary/20 focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Icon icon={MagicWand01Icon} size={12} />
                    {t("skills.attached", { count: attachedSkills })}
                    <Icon icon={Cancel01Icon} size={11} />
                  </button>
                ) : null}
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
                {model && settings ? (
                  <ComposerModelPicker
                    settings={settings}
                    model={model}
                    onChange={(next) => void updateSettings((saved) => void (saved.model = next))}
                  />
                ) : null}
              </Prompt.Tools>
              <Prompt.Submit sendLabel={t("send")} stopLabel={t("stop")} />
            </Prompt.Footer>
          </Prompt.Field>
          <Prompt.Context
            open={
              (sources !== undefined && sources.length > 0 && mode === "sources") || model !== null
            }
          >
            {mode === "sources" && sources && sources.length > 0 ? (
              <Prompt.ContextItem onSelect={() => setTab("sources")}>
                <Icon icon={Book02Icon} size={14} />
                {tCommon("sourceCount", { count: selected })}
              </Prompt.ContextItem>
            ) : null}
            {model && settings ? (
              <span className="ms-auto flex items-center gap-3">
                <EffortMenu settings={settings} provider={model.provider} />
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
