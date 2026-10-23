import { useLiveQuery } from "dexie-react-hooks";
import {
  providerIds,
  providers,
  type ModelRef,
  type ProviderCredentials,
  type ProviderId,
} from "@/lib/ai/catalog";
import { db } from "./database";

export interface ProviderSettings {
  enabled: boolean;
  apiKey: string;
  baseURL: string;
  /** The provider's models, as last fetched. Empty until fetched. */
  models: string[];
  /** Overrides the provider's default context size (characters of source text). */
  contextChars: number | null;
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
  const row = await db.settings.get(SETTINGS_KEY);
  return withDefaults(row?.value as Partial<AppSettings> | undefined);
}

/** Applies a change to the saved settings. */
export async function updateSettings(change: (settings: AppSettings) => void): Promise<void> {
  await db.transaction("rw", db.settings, async () => {
    const settings = await getSettings();
    change(settings);
    await db.settings.put({ key: SETTINGS_KEY, value: settings });
  });
}

export async function updateProvider(id: ProviderId, patch: Partial<ProviderSettings>) {
  await updateSettings((settings) => {
    settings.providers[id] = { ...settings.providers[id], ...patch };
  });
}

/** The saved settings, live. `undefined` while loading. */
export function useSettings(): AppSettings | undefined {
  return useLiveQuery(getSettings, []);
}

/** A provider can be used once it is enabled and has a key (cloud) or an address (local). */
export function isProviderReady(settings: AppSettings, id: ProviderId): boolean {
  const saved = settings.providers[id];
  if (!saved.enabled) return false;
  return providers[id].needsKey ? saved.apiKey.trim() !== "" : saved.baseURL.trim() !== "";
}

export function credentialsFor(settings: AppSettings, id: ProviderId): ProviderCredentials {
  const saved = settings.providers[id];
  return providers[id].needsKey
    ? { apiKey: saved.apiKey.trim() }
    : { baseURL: saved.baseURL.trim() || providers[id].defaultBaseURL };
}

export function contextCharsFor(settings: AppSettings, id: ProviderId): number {
  return settings.providers[id].contextChars ?? providers[id].contextChars;
}

/** Every model the user can pick: the fetched list, or the suggestions until then. */
export function availableModels(settings: AppSettings): ModelRef[] {
  return providerIds
    .filter((id) => isProviderReady(settings, id))
    .flatMap((id) => {
      const saved = settings.providers[id].models;
      const list = saved.length > 0 ? saved : providers[id].suggestedModels;
      return list.map((modelId) => ({ provider: id, modelId }));
    });
}

/** The chosen model if it is still available, else the first one that is. */
export function activeModel(settings: AppSettings): ModelRef | null {
  const models = availableModels(settings);
  const chosen = settings.model;
  if (chosen && models.some((m) => m.provider === chosen.provider && m.modelId === chosen.modelId)) {
    return chosen;
  }
  return models[0] ?? null;
}
