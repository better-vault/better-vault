import { store } from "@/lib/db/store";
import type { Plugin, Skill } from "@/lib/db/types";
import { createVault, DEFAULT_VAULT, listVaults } from "@/lib/db/vaults";
import { useStoreQuery } from "@/lib/db/live";
import { pluginRow } from "@/lib/plugins/install";
import { parsePluginBundle } from "@/lib/plugins/manifest";
import { getAccount } from "./account";
import { BACKEND_URL } from "./config";

/**
 * Sync of a subscriber's skills and plugins through the backend
 * (/v1/sync/:type), so signing in on another device brings them back. It is
 * on while a plan is active, unless turned off in Settings → Subscription.
 * Notebooks, notes and keys never leave the device.
 *
 * Each device keeps what it last synced (`known`: id → updatedAt). A sync
 * pulls what changed elsewhere since the last pull (the newer row wins, a
 * tombstone deletes), then pushes what changed here, including deletes.
 * Plugins from elsewhere are checked like any plugin from outside and keep
 * this device's on/off and grants (new ones arrive turned off).
 */

export type SyncType = "skill" | "plugin";
const types: SyncType[] = ["skill", "plugin"];

export interface CloudSyncState {
  /** The user's choice; on by default for subscribers. */
  enabled: boolean;
  lastPulled: Record<SyncType, number>;
  known: Record<SyncType, Record<string, number>>;
  syncedAt: number | null;
  error: string | null;
}

const KEY = "cloudSync";
const empty = (): CloudSyncState => ({
  enabled: true,
  lastPulled: { skill: 0, plugin: 0 },
  known: { skill: {}, plugin: {} },
  syncedAt: null,
  error: null,
});

export async function getCloudSync(): Promise<CloudSyncState> {
  const saved = (await store().getSetting(KEY)) as Partial<CloudSyncState> | undefined;
  return { ...empty(), ...saved };
}

export function useCloudSync(): CloudSyncState | undefined {
  return useStoreQuery(getCloudSync, [], ["settings"]);
}

const save = (state: CloudSyncState) => store().putSetting(KEY, state);

export async function setCloudSyncEnabled(enabled: boolean) {
  await save({ ...(await getCloudSync()), enabled, error: null });
}

/** Forgets what was synced (on sign-out), so another account starts clean. */
export async function resetCloudSync() {
  const state = await getCloudSync();
  await save({ ...empty(), enabled: state.enabled });
}

interface RemoteRecord {
  id: string;
  updatedAt: number;
  deleted?: boolean;
  data?: unknown;
}

/** What a skill's record holds: the skill, and its vault's name to find it on another device. */
type SkillData = Skill & { vaultName?: string };
/** What a plugin's record holds: the plugin without this device's on/off and grants. */
type PluginData = Pick<
  Plugin,
  "id" | "manifest" | "files" | "updatedBy" | "createdAt" | "updatedAt"
>;

async function call<T>(
  token: string,
  type: SyncType,
  init?: RequestInit,
  since?: number,
): Promise<T> {
  const query = since !== undefined ? `?since=${since}` : "";
  const response = await fetch(`${BACKEND_URL}/v1/sync/${type}${query}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
  });
  const body = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? `Sync answered ${response.status}.`);
  return body;
}

/** The vault for a synced skill: the same id, else the same name, else a new vault with that name. */
async function vaultFor(data: SkillData): Promise<string> {
  const vaults = await listVaults();
  if (vaults.some((vault) => vault.id === data.vaultId) || data.vaultId === DEFAULT_VAULT)
    return data.vaultId;
  const name = data.vaultName?.trim();
  if (!name) return DEFAULT_VAULT;
  const named = vaults.find((vault) => vault.name.trim().toLowerCase() === name.toLowerCase());
  return named?.id ?? (await createVault({ name }));
}

async function localRows(type: SyncType): Promise<{ id: string; updatedAt: number }[]> {
  return type === "skill" ? store().listSkills() : store().listPlugins();
}

async function apply(type: SyncType, record: RemoteRecord): Promise<boolean> {
  if (type === "skill") {
    const local = await store().getSkill(record.id);
    if (record.deleted) {
      if (local && local.updatedAt <= record.updatedAt) await store().deleteSkill(record.id);
      return true;
    }
    if (local && local.updatedAt >= record.updatedAt) return false;
    const data = record.data as SkillData;
    if (!data || typeof data.name !== "string" || typeof data.body !== "string") return false;
    const { vaultName: _vaultName, ...skill } = data;
    void _vaultName;
    await store().putSkill({
      ...skill,
      id: record.id,
      vaultId: await vaultFor(data),
      updatedAt: record.updatedAt,
    });
    return true;
  }
  const local = await store().getPlugin(record.id);
  if (record.deleted) {
    if (local && local.updatedAt <= record.updatedAt) await store().deletePlugin(record.id);
    return true;
  }
  if (local && local.updatedAt >= record.updatedAt) return false;
  const data = record.data as Partial<PluginData>;
  const parsed = parsePluginBundle({ manifest: data?.manifest, files: data?.files });
  if (!parsed.ok || parsed.bundle.manifest.id !== record.id) return false;
  const row = pluginRow(local, parsed.bundle, data.updatedBy ?? "you", record.updatedAt);
  await store().putPlugin({ ...row, createdAt: data.createdAt ?? row.createdAt });
  return true;
}

async function outgoing(type: SyncType, row: { id: string }): Promise<unknown> {
  if (type === "skill") {
    const skill = row as Skill;
    const vault = (await listVaults()).find((each) => each.id === skill.vaultId);
    return { ...skill, vaultName: vault?.name ?? "" } satisfies SkillData;
  }
  const { id, manifest, files, updatedBy, createdAt, updatedAt } = row as Plugin;
  return { id, manifest, files, updatedBy, createdAt, updatedAt } satisfies PluginData;
}

let running: Promise<void> | null = null;

/** Syncs now, unless a sync is running (then waits for it). Does nothing without a plan or with sync off. */
export function syncNow(): Promise<void> {
  running ??= run().finally(() => {
    running = null;
  });
  return running;
}

async function run() {
  const account = await getAccount();
  let state = await getCloudSync();
  if (!account?.account.plan || !state.enabled) return;
  try {
    for (const type of types) {
      // Pull what changed elsewhere.
      const pulled = await call<{ records: RemoteRecord[]; now: number }>(
        account.token,
        type,
        undefined,
        state.lastPulled[type],
      );
      const known = { ...state.known[type] };
      for (const record of pulled.records) {
        await apply(type, record);
        if (record.deleted) delete known[record.id];
        else known[record.id] = Math.max(known[record.id] ?? 0, record.updatedAt);
      }

      // Push what changed here: new or newer rows, and deletes.
      const rows = await localRows(type);
      const changed = rows.filter((row) => (known[row.id] ?? -1) < row.updatedAt);
      const present = new Set(rows.map((row) => row.id));
      const deleted = Object.keys(known).filter((id) => !present.has(id));
      const now = Date.now();
      const records = [
        ...(await Promise.all(
          changed.map(async (row) => ({
            id: row.id,
            updatedAt: row.updatedAt,
            data: await outgoing(type, row),
          })),
        )),
        ...deleted.map((id) => ({ id, updatedAt: now, deleted: true })),
      ];
      for (let at = 0; at < records.length; at += 200)
        await call(account.token, type, {
          method: "PUT",
          body: JSON.stringify({ records: records.slice(at, at + 200) }),
        });
      for (const row of changed) known[row.id] = row.updatedAt;
      for (const id of deleted) delete known[id];

      state = {
        ...state,
        lastPulled: { ...state.lastPulled, [type]: pulled.now },
        known: { ...state.known, [type]: known },
      };
    }
    await save({ ...state, syncedAt: Date.now(), error: null });
  } catch (error) {
    await save({
      ...(await getCloudSync()),
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
