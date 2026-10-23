"use client";

import {
  Cancel01Icon,
  Globe02Icon,
  Loading03Icon,
  ViewIcon,
  ViewOffIcon,
} from "@hugeicons/core-free-icons";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Field } from "@/components/common/field";
import { Icon } from "@/components/icon";
import { Button } from "@/components/panelui/button";
import { Input } from "@/components/panelui/input";
import { Label } from "@/components/panelui/label";
import { Sheet } from "@/components/panelui/sheet";
import { Switch } from "@/components/panelui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { providerIds, providers, type ProviderId } from "@/lib/ai/catalog";
import { providerIcons } from "@/lib/ai/provider-icons";
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

function statusOf(settings: AppSettings, id: ProviderId): Status {
  if (isProviderReady(settings, id)) return "ready";
  return settings.providers[id].enabled && providers[id].needsKey ? "needsKey" : "off";
}

/** The list of providers; each opens its own sheet. */
export function ProvidersPanel() {
  const { t } = useTranslation("settings");
  const { t: tCommon } = useTranslation();
  const settings = useSettings();

  return (
    <>
      <Sheet.Header title={t("providers.title")} description={t("providers.description")} />
      <Sheet.Body>
        <div className="-mx-2 flex flex-col gap-0.5">
          {providerIds.map((id) => {
            const status = settings ? statusOf(settings, id) : "off";
            return (
              <SettingsRow
                key={id}
                to="provider"
                payload={id}
                icon={providerIcons[id]}
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
      </Sheet.Body>
      <Sheet.Next name="provider" closeLabel={tCommon("actions.close")}>
        {(id: ProviderId) => <ProviderDetail id={id} />}
      </Sheet.Next>
    </>
  );
}

function ProviderDetail({ id }: { id: ProviderId }) {
  const settings = useSettings();
  if (!settings) return null;
  return <ProviderForm id={id} saved={settings.providers[id]} />;
}

function ProviderForm({ id, saved }: { id: ProviderId; saved: ProviderSettings }) {
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

  async function loadModels() {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await fetch("/api/models", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider: id,
          credentials: info.needsKey ? { apiKey: apiKey.trim() } : { baseURL: baseURL.trim() },
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
  const canLoad = info.needsKey ? apiKey.trim() !== "" : baseURL.trim() !== "";

  return (
    <>
      <Sheet.Header
        title={info.name}
        description={info.local ? t("providers.localHint") : undefined}
      />
      <Sheet.Body>
        <div className="flex flex-col gap-5 pb-4">
          <Label className="justify-between gap-4 rounded-2xl bg-muted/60 px-4 py-3">
            <Label.Text>{t("providers.enable", { name: info.name })}</Label.Text>
            <Switch checked={saved.enabled} onCheckedChange={(enabled) => save({ enabled })} />
          </Label>

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
                {loading ? <Icon icon={Loading03Icon} size={14} className="animate-spin" /> : null}
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
                          onClick={() => save({ models: saved.models.filter((m) => m !== model) })}
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
