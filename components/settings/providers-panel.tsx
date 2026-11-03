import {
  AudioWave01Icon,
  Cancel01Icon,
  Globe02Icon,
  Loading03Icon,
  ViewIcon,
  ViewOffIcon,
} from "@hugeicons/core-free-icons";
import { useEffect, useId, useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Field } from "@/components/common/field";
import { Icon } from "@/components/icon";
import { ProviderIcon } from "@/components/provider-icon";
import { Button, buttonVariants } from "@/components/panelui/button";
import { Alert } from "@/components/panelui/alert";
import { Input } from "@/components/panelui/input";
import { Label } from "@/components/panelui/label";
import { Sheet } from "@/components/panelui/sheet";
import { Switch } from "@/components/panelui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Segmented } from "@/components/common/segmented";
import { chatProviderIds, providers, speechProviderIds, type ProviderId } from "@/lib/ai/catalog";
import { desktopBridge } from "@/lib/desktop/bridge";
import { accountLabel, chatGPTStatus, chatGPTUsageUrl, signOutChatGPT } from "@/lib/chatgpt/client";
import {
  isProviderReady,
  updateProvider,
  useSettings,
  type AppSettings,
  type ProviderSettings,
} from "@/lib/db/settings";
import { cn } from "@/lib/utils";
import { SettingsRow } from "./settings-row";

type Status = "ready" | "needsKey" | "off";

/** OpenCode's plans and the addresses that choose them (lib/ai/opencode.ts). */
const openCodeAddress = {
  zen: "https://opencode.ai/inference",
  go: "https://opencode.ai/inference/go",
} as const;

function statusOf(settings: AppSettings, id: ProviderId): Status {
  if (isProviderReady(settings, id)) return "ready";
  return settings.providers[id].enabled && providers[id].needsKey ? "needsKey" : "off";
}

interface ProvidersPanelProps {
  /** Continue with ChatGPT: the settings sheet closes and opens its dialog. */
  onChatGPTSignIn: () => void;
}

/** The list of providers; each opens its own sheet. */
export function ProvidersPanel({ onChatGPTSignIn }: ProvidersPanelProps) {
  const { t } = useTranslation("settings");
  const { t: tCommon } = useTranslation();
  const settings = useSettings();

  return (
    <>
      <Sheet.Header title={t("providers.title")} description={t("providers.description")} />
      <Sheet.Body>
        <ProviderList ids={chatProviderIds} settings={settings} />
        <h3 className="mt-5 mb-1 px-0.5 text-xs font-medium text-muted-foreground">
          {t("providers.speech")}
        </h3>
        <ProviderList ids={speechProviderIds} settings={settings} />
      </Sheet.Body>
      <Sheet.Next name="provider" closeLabel={tCommon("actions.close")}>
        {(id: ProviderId) => <ProviderDetail id={id} onChatGPTSignIn={onChatGPTSignIn} />}
      </Sheet.Next>
    </>
  );
}

function ProviderList({
  ids,
  settings,
}: {
  ids: readonly ProviderId[];
  settings: AppSettings | undefined;
}) {
  const { t } = useTranslation("settings");
  return (
    <div className="-mx-2 flex flex-col gap-0.5">
      {ids.map((id) => {
        const status = settings ? statusOf(settings, id) : "off";
        return (
          <SettingsRow
            key={id}
            to="provider"
            payload={id}
            icon={<ProviderIcon provider={id} />}
            label={providers[id].name}
            hint={t(`providers.${status}`)}
            end={
              <span
                aria-hidden
                className={cn(
                  "size-2 rounded-full",
                  status === "ready"
                    ? "bg-success"
                    : status === "needsKey"
                      ? "bg-warning"
                      : "bg-muted-foreground/30",
                )}
              />
            }
          />
        );
      })}
    </div>
  );
}

function ProviderDetail({ id, onChatGPTSignIn }: { id: ProviderId; onChatGPTSignIn: () => void }) {
  const settings = useSettings();
  if (!settings) return null;
  return <ProviderForm id={id} saved={settings.providers[id]} onChatGPTSignIn={onChatGPTSignIn} />;
}

function ProviderForm({
  id,
  saved,
  onChatGPTSignIn,
}: {
  id: ProviderId;
  saved: ProviderSettings;
  onChatGPTSignIn: () => void;
}) {
  const { t } = useTranslation("settings");
  const info = providers[id];
  const keyId = useId();
  const urlId = useId();
  const contextId = useId();
  const modelId = useId();
  // Fields keep their own state while typing; every change is saved at once.
  const [apiKey, setApiKey] = useState(saved.apiKey);
  const [baseURL, setBaseURL] = useState(saved.baseURL);
  const [context, setContext] = useState(String(saved.contextChars ?? info.contextChars));
  const [showKey, setShowKey] = useState(false);
  const [newModel, setNewModel] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const save = (patch: Partial<ProviderSettings>) => void updateProvider(id, patch);
  const openCodePlan = baseURL === openCodeAddress.go ? "go" : "zen";

  async function loadModels() {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await fetch("/api/models", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider: id,
          credentials: saved.chatgpt
            ? { chatgpt: true }
            : id === "opencode"
              ? { apiKey: apiKey.trim(), baseURL: baseURL || info.defaultBaseURL }
              : info.needsKey
                ? { apiKey: apiKey.trim() }
                : { baseURL: baseURL.trim() },
        }),
      });
      const body = (await response.json()) as { models?: string[]; error?: string };
      if (!response.ok || !body.models) throw new Error(body.error ?? response.statusText);
      await updateProvider(id, { models: body.models });
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }

  function addModel() {
    const value = newModel.trim();
    if (!value) return;
    const current = saved.models.length > 0 ? saved.models : [...info.suggestedModels];
    if (!current.includes(value)) save({ models: [value, ...current] });
    setNewModel("");
  }

  const models = saved.models.length > 0 ? saved.models : info.suggestedModels;
  const canLoad =
    saved.chatgpt !== null || (info.needsKey ? apiKey.trim() !== "" : baseURL.trim() !== "");

  return (
    <>
      <Sheet.Header
        title={info.name}
        description={info.local ? t("providers.localHint") : undefined}
      />
      <Sheet.Body>
        <div className="flex flex-col gap-5 pb-4">
          {/* OpenCode is on while it has a key; its sheet checks for OpenCode instead. */}
          {id === "opencode" ? (
            <OpenCodeCheck />
          ) : (
            <Label className="justify-between gap-4 rounded-2xl bg-muted/60 px-4 py-3">
              <Label.Text>{t("providers.enable", { name: info.name })}</Label.Text>
              <Switch checked={saved.enabled} onCheckedChange={(enabled) => save({ enabled })} />
            </Label>
          )}

          {id === "openai" ? (
            <ChatGPTCard account={saved.chatgpt} onSignIn={onChatGPTSignIn} />
          ) : null}

          {id === "opencode" ? (
            <Field
              label={t("providers.opencodePlan")}
              hint={t(`providers.opencodePlanHint.${openCodePlan}`)}
            >
              <Segmented<"zen" | "go">
                aria-label={t("providers.opencodePlan")}
                value={openCodePlan}
                onValueChange={(plan) => {
                  const next = openCodeAddress[plan];
                  setBaseURL(next);
                  save({ baseURL: next, models: [] });
                }}
                options={[
                  { value: "zen", label: "Zen" },
                  { value: "go", label: "Go" },
                ]}
              />
            </Field>
          ) : null}

          {info.kind === "audio" ? (
            <p className="flex items-start gap-2 rounded-2xl bg-muted/60 px-4 py-3 text-sm text-muted-foreground">
              <Icon icon={AudioWave01Icon} size={16} className="mt-0.5 shrink-0 text-info" />
              {t("providers.audioOnly", { name: info.name })}
            </p>
          ) : null}

          {info.needsKey ? (
            <Field
              label={t("providers.apiKey")}
              htmlFor={keyId}
              action={
                info.keyUrl ? (
                  <a href={info.keyUrl} target="_blank" rel="noreferrer">
                    {t("providers.getKey")}
                  </a>
                ) : null
              }
            >
              <Input.Group>
                <Input
                  id={keyId}
                  type={showKey ? "text" : "password"}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder={t("providers.apiKeyPlaceholder")}
                  value={apiKey}
                  onChange={(event) => {
                    const value = event.target.value;
                    setApiKey(value);
                    // A key being entered means the provider should be used.
                    save({
                      apiKey: value.trim(),
                      ...(value.trim() && !saved.enabled ? { enabled: true } : {}),
                      // With no switch, OpenCode is off once its key is removed.
                      ...(id === "opencode" && !value.trim() ? { enabled: false } : {}),
                    });
                  }}
                />
                <Input.Addon align="end">
                  <button
                    type="button"
                    onClick={() => setShowKey((shown) => !shown)}
                    aria-label={showKey ? t("providers.hideKey") : t("providers.showKey")}
                    className="cursor-pointer rounded p-0.5 hover:text-foreground"
                  >
                    <Icon icon={showKey ? ViewOffIcon : ViewIcon} size={16} />
                  </button>
                </Input.Addon>
              </Input.Group>
            </Field>
          ) : (
            <Field label={t("providers.baseURL")} htmlFor={urlId}>
              <Input
                id={urlId}
                type="url"
                spellCheck={false}
                placeholder={info.defaultBaseURL}
                value={baseURL}
                onChange={(event) => {
                  setBaseURL(event.target.value);
                  save({ baseURL: event.target.value.trim() });
                }}
              />
            </Field>
          )}

          {info.kind === "audio" ? null : (
            <>
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Icon
                  icon={Globe02Icon}
                  size={16}
                  className={info.webSearch ? "text-info" : undefined}
                />
                {info.webSearch ? t("providers.webSearch") : t("providers.noWebSearch")}
              </p>

              <Field
                label={t("providers.models")}
                action={
                  <button
                    type="button"
                    disabled={!canLoad || loading}
                    onClick={loadModels}
                    className="inline-flex cursor-pointer items-center gap-1 text-foreground underline-offset-4 hover:underline disabled:cursor-default disabled:no-underline disabled:opacity-50"
                  >
                    {loading ? (
                      <Icon icon={Loading03Icon} size={14} className="animate-spin" />
                    ) : null}
                    {loading ? t("providers.refreshing") : t("providers.refresh")}
                  </button>
                }
                hint={
                  loadError
                    ? t("providers.loadFailed", { error: loadError })
                    : saved.models.length > 0
                      ? t("providers.modelsLoaded", { count: saved.models.length })
                      : info.local
                        ? t("providers.modelsEmptyLocal", { name: info.name })
                        : t("providers.modelsSuggested", { name: info.name })
                }
              >
                {models.length > 0 ? (
                  <ScrollArea className="rounded-xl border" viewportClassName="max-h-48">
                    <ul className="flex flex-wrap gap-1.5 p-2">
                      {models.map((model) => (
                        <li
                          key={model}
                          className="flex items-center gap-1 rounded-full bg-muted py-0.5 ps-2.5 pe-1 font-mono text-xs"
                        >
                          {model}
                          {saved.models.length > 0 ? (
                            <button
                              type="button"
                              aria-label={t("providers.removeModel", { model })}
                              onClick={() =>
                                save({ models: saved.models.filter((m) => m !== model) })
                              }
                              className="cursor-pointer rounded-full p-0.5 text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
                            >
                              <Icon icon={Cancel01Icon} size={12} />
                            </button>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </ScrollArea>
                ) : null}
                <form
                  className="flex gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    addModel();
                  }}
                >
                  <Input
                    id={modelId}
                    size="sm"
                    aria-label={t("providers.addModel")}
                    placeholder={t("providers.addModelPlaceholder")}
                    value={newModel}
                    spellCheck={false}
                    onChange={(event) => setNewModel(event.target.value)}
                    className="font-mono"
                  />
                  <Button type="submit" size="sm" variant="secondary" disabled={!newModel.trim()}>
                    {t("providers.addModel")}
                  </Button>
                </form>
              </Field>
            </>
          )}

          {info.local ? (
            <Field
              label={t("providers.context")}
              htmlFor={contextId}
              hint={t("providers.contextHint")}
            >
              <Input
                id={contextId}
                type="number"
                inputMode="numeric"
                min={2000}
                step={1000}
                value={context}
                onChange={(event) => {
                  setContext(event.target.value);
                  const value = Number.parseInt(event.target.value, 10);
                  if (Number.isFinite(value) && value >= 2000) save({ contextChars: value });
                }}
              />
            </Field>
          ) : null}
        </div>
      </Sheet.Body>
    </>
  );
}

/**
 * Use your ChatGPT plan instead of a key (OpenAI only). Who is signed in is
 * checked with the local server, which holds the tokens.
 */
function ChatGPTCard({
  account,
  onSignIn,
}: {
  account: ProviderSettings["chatgpt"];
  onSignIn: () => void;
}) {
  const { t } = useTranslation("settings");
  const [signingOut, setSigningOut] = useState(false);
  const [unavailable, setUnavailable] = useState<"desktopOnly" | "off" | null>(null);

  // Keep the saved label in step with the server (signed out elsewhere, a backup from another computer).
  useEffect(() => {
    let cancelled = false;
    chatGPTStatus()
      .then(({ account: server, available, reason }) => {
        if (cancelled) return;
        setUnavailable(available ? null : (reason ?? "off"));
        if (!server && account) void updateProvider("openai", { chatgpt: null });
        if (server && (!account || server.email !== account.email))
          void updateProvider("openai", { chatgpt: { email: server.email, name: server.name } });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // Checked once each time the sheet opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function signOut() {
    setSigningOut(true);
    try {
      const revoked = await signOutChatGPT();
      await updateProvider("openai", { chatgpt: null });
      toast(revoked ? t("chatgpt.signedOut") : t("chatgpt.signedOutUnconfirmed"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setSigningOut(false);
    }
  }

  if (unavailable === "off") return null;
  if (unavailable === "desktopOnly")
    return (
      <section className="flex flex-col gap-2 rounded-2xl bg-muted/60 p-4">
        <h3 className="text-sm font-medium">{t("chatgpt.title")}</h3>
        <p className="text-sm text-muted-foreground">{t("chatgpt.desktopOnly")}</p>
        <a
          href="https://better-vault.dev/download"
          target="_blank"
          rel="noreferrer"
          className="self-start text-sm font-medium underline underline-offset-4"
        >
          {t("chatgpt.getDesktop")}
        </a>
      </section>
    );
  return (
    <section className="flex flex-col gap-3 rounded-2xl bg-muted/60 p-4">
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-medium">{t("chatgpt.title")}</h3>
        <p className="text-sm text-muted-foreground">
          {account ? t("chatgpt.inUse") : t("chatgpt.description")}
        </p>
      </div>
      {account ? (
        <>
          <p className="truncate text-sm">
            {t("chatgpt.signedInAs", { account: accountLabel(account) })}
          </p>
          <div className="flex flex-wrap gap-2">
            <a
              href={chatGPTUsageUrl}
              target="_blank"
              rel="noreferrer"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              {t("chatgpt.manageUsage")}
            </a>
            <Button variant="ghost" size="sm" disabled={signingOut} onClick={signOut}>
              {signingOut ? <Icon icon={Loading03Icon} size={14} className="animate-spin" /> : null}
              {t("chatgpt.signOut")}
            </Button>
          </div>
        </>
      ) : (
        <Button onClick={onSignIn} className="self-start">
          <ProviderIcon provider="openai" size={16} />
          {t("chatgpt.continue")}
        </Button>
      )}
    </section>
  );
}

/**
 * Desktop app: checks whether OpenCode is installed on this computer, with a
 * spinner while it looks, and says what to do when it isn't.
 */
function OpenCodeCheck() {
  const { t } = useTranslation("settings");
  const [state, setState] = useState<
    | { status: "idle" | "checking" }
    | { status: "found"; version: string }
    | { status: "missing" }
    | { status: "failed"; error: string }
  >({ status: "idle" });
  if (!desktopBridge()) return null;

  async function check() {
    setState({ status: "checking" });
    try {
      const response = await fetch("/api/opencode/detect", { method: "POST" });
      const body = (await response.json()) as {
        install?: { version: string } | null;
        error?: string;
      };
      if (!response.ok) throw new Error(body.error ?? response.statusText);
      setState(
        body.install ? { status: "found", version: body.install.version } : { status: "missing" },
      );
    } catch (error) {
      setState({ status: "failed", error: error instanceof Error ? error.message : String(error) });
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Button
        variant="secondary"
        className="self-start"
        disabled={state.status === "checking"}
        aria-busy={state.status === "checking"}
        onClick={() => void check()}
      >
        {state.status === "checking" ? (
          <Icon icon={Loading03Icon} size={16} className="animate-spin" />
        ) : null}
        {state.status === "checking"
          ? t("providers.opencodeChecking")
          : t("providers.opencodeCheck")}
      </Button>
      {state.status === "found" ? (
        <Alert tone="success" variant="plain">
          <Alert.Title>{t("providers.opencodeFound", { version: state.version })}</Alert.Title>
          <Alert.Description>{t("providers.opencodeFoundBody")}</Alert.Description>
        </Alert>
      ) : state.status === "missing" ? (
        <Alert tone="warning" variant="plain">
          <Alert.Title>{t("providers.opencodeMissing")}</Alert.Title>
          <Alert.Description>{t("providers.opencodeMissingBody")}</Alert.Description>
          <Alert.Actions>
            <a
              href="https://opencode.ai/download"
              target="_blank"
              rel="noreferrer"
              className={buttonVariants({ size: "sm" })}
            >
              {t("providers.opencodeDownload")}
            </a>
          </Alert.Actions>
        </Alert>
      ) : state.status === "failed" ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}
    </div>
  );
}
