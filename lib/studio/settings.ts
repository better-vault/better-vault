import { useStoreQuery } from "@/lib/db/live";
import { store } from "@/lib/db/store";
import { studioToolIds, type StudioToolId } from "@/studio/tools";

/** Settings → Studio: which tools the Studio sheet offers. Kept on this device. */
export interface StudioSettings {
  /** Tools turned off; they leave the Studio sheet, their outputs stay. */
  hidden: StudioToolId[];
}

const key = "studio";

export async function getStudioSettings(): Promise<StudioSettings> {
  const saved = (await store().getSetting(key)) as Partial<StudioSettings> | undefined;
  const hidden = (saved?.hidden ?? []).filter((id): id is StudioToolId =>
    (studioToolIds as readonly string[]).includes(id),
  );
  return { hidden };
}

/** Turns one tool on or off. The last tool left on stays on. */
export async function setStudioToolShown(id: StudioToolId, shown: boolean): Promise<void> {
  const { hidden } = await getStudioSettings();
  const next = shown ? hidden.filter((each) => each !== id) : [...new Set([...hidden, id])];
  if (next.length >= studioToolIds.length) return;
  await store().putSetting(key, { hidden: next } satisfies StudioSettings);
}

export function useStudioSettings(): StudioSettings | undefined {
  return useStoreQuery(() => getStudioSettings(), [], ["settings"]);
}
