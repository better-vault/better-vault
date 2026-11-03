import { useStoreQuery } from "@/lib/db/live";
import { store } from "@/lib/db/store";
import { storageIds, storages, type StorageId } from "./catalog";

/**
 * What the person set up for each storage service, kept with the other
 * settings on this device and never in backups. Keys for S3 and R2 are sent
 * with each request to this app's API, like the AI providers' keys.
 */
export interface StorageSettings {
  fields: Partial<Record<string, string>>;
  /** Who is signed in to an OAuth service, for display. */
  account: { name: string; email: string } | null;
  /**
   * Web app, Microsoft only: the rotating refresh token of the sign-in.
   * The desktop app keeps sign-ins in its main process instead.
   */
  refreshToken?: string;
}

const key = "storage";

function empty(): Record<StorageId, StorageSettings> {
  return Object.fromEntries(storageIds.map((id) => [id, { fields: {}, account: null }])) as Record<
    StorageId,
    StorageSettings
  >;
}

export async function getStorageSettings(): Promise<Record<StorageId, StorageSettings>> {
  const saved = (await store().getSetting(key)) as
    Partial<Record<StorageId, StorageSettings>> | undefined;
  const base = empty();
  for (const id of storageIds) base[id] = { ...base[id], ...saved?.[id] };
  return base;
}

export async function updateStorage(id: StorageId, patch: Partial<StorageSettings>) {
  const all = await getStorageSettings();
  all[id] = { ...all[id], ...patch };
  await store().putSetting(key, all);
}

export function useStorageSettings(): Record<StorageId, StorageSettings> | undefined {
  return useStoreQuery(() => getStorageSettings(), [], ["settings"]);
}

/** A service is ready once its keys are filled in, or someone is signed in. */
export function isStorageReady(
  settings: Record<StorageId, StorageSettings>,
  id: StorageId,
): boolean {
  const info = storages[id];
  const saved = settings[id];
  if (info.soon) return false;
  if (info.auth === "oauth") return saved.account !== null;
  return info.fields.every(
    (field) => field.optional || (saved.fields[field.key] ?? "").trim() !== "",
  );
}
