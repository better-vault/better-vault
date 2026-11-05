import {
  chatProviderIds,
  providerIds,
  providers,
  type Effort,
  type ModelRef,
  type ProviderCredentials,
  type ProviderId,
} from "@/lib/ai/catalog";
import { useStoreQuery } from "./live";
import { store } from "./store";

export interface ProviderSettings {
  enabled: boolean;
  apiKey: string;
  baseURL: string;
  /** The provider's models, as last fetched. Empty until fetched. */
  models: string[];
  /** Overrides the provider's default context size (characters of source text). */
  contextChars: number | null;
  /**
   * OpenAI only: the ChatGPT account signed in on the local server, whose
   * plan then pays for text. Only who it is; the tokens stay on the server.
   */
  chatgpt: ChatGPTAccountLabel | null;
  /** How much its models think before answering, in chat and in the Studio. */
  effort: Effort;
}

export interface ChatGPTAccountLabel {
  email: string;
  name: string;
}

export interface AppSettings {
  providers: Record<ProviderId, ProviderSettings>;
  /** The model chosen in the prompt bar. */
  model: ModelRef | null;
}

const SETTINGS_KEY = "app";

export function defaultSettings(): AppSettings {
  const entries = providerIds.map((id) => [
    id,
    {
      enabled: false,
      apiKey: "",
      baseURL: providers[id].defaultBaseURL ?? "",
      models: [],
      contextChars: null,
      chatgpt: null,
      effort: "provider-default",
    } satisfies ProviderSettings,
  ]);
  return {
    providers: Object.fromEntries(entries) as Record<ProviderId, ProviderSettings>,
    model: null,
  };
}

/** Fills in anything missing, so settings saved by an older version still work. */
function withDefaults(saved: Partial<AppSettings> | undefined): AppSettings {
  const base = defaultSettings();
  if (!saved) return base;
  for (const id of providerIds) {
    base.providers[id] = { ...base.providers[id], ...saved.providers?.[id] };
  }
  base.model = saved.model ?? null;
  return base;
}

export async function getSettings(): Promise<AppSettings> {
  const value = await store().getSetting(SETTINGS_KEY);
  return withDefaults(value as Partial<AppSettings> | undefined);
}

/** Applies a change to the saved settings. */
export async function updateSettings(change: (settings: AppSettings) => void): Promise<void> {
  const settings = await getSettings();
  change(settings);
  await store().putSetting(SETTINGS_KEY, settings);
}

export async function updateProvider(id: ProviderId, patch: Partial<ProviderSettings>) {
  await updateSettings((settings) => {
    settings.providers[id] = { ...settings.providers[id], ...patch };
  });
}

/** The saved settings, live. `undefined` while loading. */
export function useSettings(): AppSettings | undefined {
  return useStoreQuery(getSettings, [], ["settings"]);
}

/**
 * A provider can be used once it is enabled and has a key (cloud) or an
 * address (local). OpenAI can use a ChatGPT sign-in instead of a key.
 */
export function isProviderReady(settings: AppSettings, id: ProviderId): boolean {
  const saved = settings.providers[id];
  if (!saved.enabled) return false;
  if (usesChatGPT(settings, id)) return true;
  return providers[id].needsKey ? saved.apiKey.trim() !== "" : saved.baseURL.trim() !== "";
}

/** Text requests to OpenAI go through the signed-in ChatGPT plan rather than the key. */
export function usesChatGPT(settings: AppSettings, id: ProviderId): boolean {
  return id === "openai" && settings.providers.openai.chatgpt !== null;
}

/** The credentials for text requests (chat, Studio). */
export function credentialsFor(settings: AppSettings, id: ProviderId): ProviderCredentials {
  const saved = settings.providers[id];
  if (usesChatGPT(settings, id)) return { chatgpt: true };
  if (!providers[id].needsKey)
    return { baseURL: saved.baseURL.trim() || providers[id].defaultBaseURL };
  // OpenCode's address picks the plan (Zen or Go); the server only accepts those two.
  if (id === "opencode")
    return { apiKey: saved.apiKey.trim(), baseURL: saved.baseURL || providers[id].defaultBaseURL };
  return { apiKey: saved.apiKey.trim() };
}

/** Pictures always need an API key: a ChatGPT plan cannot generate images here. */
function canDrawPictures(settings: AppSettings, id: ProviderId): boolean {
  const saved = settings.providers[id];
  return saved.enabled && saved.apiKey.trim() !== "" && providers[id].imageModels.length > 0;
}

/** The credentials for an image model: its API key. */
export function imageCredentialsFrom(
  settings: AppSettings,
  id: ProviderId,
): ProviderCredentials | null {
  return canDrawPictures(settings, id) ? { apiKey: settings.providers[id].apiKey.trim() } : null;
}

/** The credentials for a speech model: its provider's API key, when it is on. */
export function speechCredentialsFrom(
  settings: AppSettings,
  id: ProviderId,
): ProviderCredentials | null {
  const saved = settings.providers[id];
  return providers[id].kind === "audio" && saved.enabled && saved.apiKey.trim()
    ? { apiKey: saved.apiKey.trim() }
    : null;
}

/** The effort for text requests to this provider; `provider-default` when it has no levels. */
export function effortFor(settings: AppSettings, id: ProviderId): Effort {
  const effort = settings.providers[id].effort;
  return providers[id].efforts.includes(effort) ? effort : "provider-default";
}

export function contextCharsFor(settings: AppSettings, id: ProviderId): number {
  return settings.providers[id].contextChars ?? providers[id].contextChars;
}

/** Every model the user can pick: the fetched list, or the suggestions until then. */
export function availableModels(settings: AppSettings): ModelRef[] {
  return chatProviderIds
    .filter((id) => isProviderReady(settings, id))
    .flatMap((id) => {
      const saved = settings.providers[id].models;
      const list = saved.length > 0 ? saved : providers[id].suggestedModels;
      return list.map((modelId) => ({ provider: id, modelId }));
    });
}

/** Every image model the user can pick: those of providers with a key that draw pictures. */
export function availableImageModels(settings: AppSettings): ModelRef[] {
  return providerIds
    .filter((id) => canDrawPictures(settings, id))
    .flatMap((id) => providers[id].imageModels.map((modelId) => ({ provider: id, modelId })));
}

/** The chosen model if it is still available, else the first one that is. */
export function activeModel(settings: AppSettings): ModelRef | null {
  const models = availableModels(settings);
  const chosen = settings.model;
  if (
    chosen &&
    models.some((m) => m.provider === chosen.provider && m.modelId === chosen.modelId)
  ) {
    return chosen;
  }
  return models[0] ?? null;
}
