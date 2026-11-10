import { useStoreQuery } from "@/lib/db/live";
import { store } from "@/lib/db/store";
import { studioToolIds, type StudioToolId } from "@/studio/tools";

/** Settings → Studio: which tools the Studio sheet offers. Kept on this device. */
export interface StudioSettings {
  /** Tools turned off; they leave the Studio sheet, their outputs stay. */
  hidden: StudioToolId[];
  /** Whether chat answers may show diagrams, tables and charts (generative UI). */
  visuals: boolean;
}

const key = "studio";

export async function getStudioSettings(): Promise<StudioSettings> {
  const saved = (await store().getSetting(key)) as Partial<StudioSettings> | undefined;
  const hidden = (saved?.hidden ?? []).filter((id): id is StudioToolId =>
    (studioToolIds as readonly string[]).includes(id),
  );
  return { hidden, visuals: saved?.visuals ?? true };
}

/** Turns one tool on or off. The last tool left on stays on. */
export async function setStudioToolShown(id: StudioToolId, shown: boolean): Promise<void> {
  const current = await getStudioSettings();
  const next = shown
    ? current.hidden.filter((each) => each !== id)
    : [...new Set([...current.hidden, id])];
  if (next.length >= studioToolIds.length) return;
  await store().putSetting(key, { ...current, hidden: next } satisfies StudioSettings);
}

export async function setChatVisuals(visuals: boolean): Promise<void> {
  const current = await getStudioSettings();
  await store().putSetting(key, { ...current, visuals } satisfies StudioSettings);
}

export function useStudioSettings(): StudioSettings | undefined {
  return useStoreQuery(() => getStudioSettings(), [], ["settings"]);
}
