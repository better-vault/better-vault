import { useStoreQuery } from "./live";
import { store } from "./store";

/**
 * The person using better-vault, as they describe themselves. It lives on
 * this device with the other settings; there is no account on a server.
 */
export interface Profile {
  name: string;
  /** A small square picture, as a data URL (made by `lib/profile/avatar.ts`). */
  avatar: string | null;
}

const key = "profile";

export function emptyProfile(): Profile {
  return { name: "", avatar: null };
}

export async function getProfile(): Promise<Profile> {
  const saved = (await store().getSetting(key)) as Partial<Profile> | undefined;
  return { ...emptyProfile(), ...saved };
}

export async function updateProfile(patch: Partial<Profile>) {
  await store().putSetting(key, { ...(await getProfile()), ...patch });
}

/** The profile; `undefined` while loading. */
export function useProfile(): Profile | undefined {
  return useStoreQuery(() => getProfile(), [], ["settings"]);
}

/** Up to two letters for an avatar without a picture. */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  const letters =
    words.length === 1 ? [...words[0]].slice(0, 1) : [[...words[0]][0], [...words.at(-1)!][0]];
  return letters.join("").toLocaleUpperCase();
}
