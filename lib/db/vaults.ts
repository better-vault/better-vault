import { generateId } from "ai";
import { useSyncExternalStore } from "react";
import { useStoreQuery } from "./live";
import { store } from "./store";
import type { Folder, Notebook, Vault } from "./types";

/** The vault notebooks and folders saved before vaults belong to. It can't be deleted. */
export const DEFAULT_VAULT = "default";

const defaultVault = (): Vault => ({
  id: DEFAULT_VAULT,
  name: "",
  icon: undefined,
  color: undefined,
  order: 0,
  createdAt: 0,
  updatedAt: 0,
});

/** The vault a notebook or folder is in. */
export const vaultOf = (item: Pick<Notebook | Folder, "vaultId">) => item.vaultId ?? DEFAULT_VAULT;

/** Every vault in switcher order, the default one included even before it is saved. */
export async function listVaults(): Promise<Vault[]> {
  const saved = await store().listVaults();
  const all = saved.some((vault) => vault.id === DEFAULT_VAULT)
    ? saved
    : [defaultVault(), ...saved];
  return all.sort((a, b) => a.order - b.order || a.createdAt - b.createdAt);
}

export function useVaults(): Vault[] | undefined {
  return useStoreQuery(listVaults, [], ["vaults"]);
}

export type VaultLook = Partial<Pick<Vault, "name" | "icon" | "color">>;

export async function createVault(look: VaultLook): Promise<string> {
  const vaults = await listVaults();
  const now = Date.now();
  const id = generateId();
  await store().putVault({
    id,
    name: look.name?.trim() ?? "",
    ...(look.icon ? { icon: look.icon } : {}),
    ...(look.color ? { color: look.color } : {}),
    order: Math.max(0, ...vaults.map((vault) => vault.order)) + 1,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

export async function updateVault(id: string, look: VaultLook) {
  const current = (await listVaults()).find((vault) => vault.id === id);
  if (!current) return;
  const next: Vault = { ...current, ...look, updatedAt: Date.now() };
  if (look.name !== undefined) next.name = look.name.trim();
  await store().putVault(next);
}

/**
 * Deletes a vault with every notebook and folder in it, and everything in
 * those. The default vault stays.
 */
export async function deleteVault(id: string) {
  if (id === DEFAULT_VAULT) return;
  const notebooks = (await store().listNotebooks()).filter((item) => vaultOf(item) === id);
  for (const notebook of notebooks) await store().deleteNotebook(notebook.id);
  const folders = (await store().listFolders()).filter((item) => vaultOf(item) === id);
  for (const folder of folders) await store().deleteFolder(folder.id);
  await store().deleteVault(id);
  if (currentVaultId() === id) setCurrentVault(DEFAULT_VAULT);
}

/* The vault shown on the notebooks page, remembered on this device. */

const CURRENT_KEY = "better-vault:vault";
const CHANGE = "better-vault:vault-change";

function currentVaultId(): string {
  try {
    return window.localStorage.getItem(CURRENT_KEY) ?? DEFAULT_VAULT;
  } catch {
    return DEFAULT_VAULT;
  }
}

export function setCurrentVault(id: string) {
  try {
    window.localStorage.setItem(CURRENT_KEY, id);
  } catch {
    // Storage can be blocked; the choice then lasts for this page only.
  }
  window.dispatchEvent(new Event(CHANGE));
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** The current vault's id; the default one when the saved vault is gone. */
export function useCurrentVault(vaults: Vault[] | undefined): string {
  const id = useSyncExternalStore(subscribe, currentVaultId, () => DEFAULT_VAULT);
  if (!vaults) return id;
  return vaults.some((vault) => vault.id === id) ? id : DEFAULT_VAULT;
}
