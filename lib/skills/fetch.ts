import type { SkillFile } from "./format";

/** A skill read from GitHub, with where it lives in its repository. */
export interface RemoteSkill extends SkillFile {
  path: string;
}

export interface RemoteSkills {
  repo: string;
  ref: string;
  skills: RemoteSkill[];
  truncated: boolean;
}

/**
 * Reads the skills a source points at (an `npx skills add …` command, a
 * skills.sh or GitHub link, `owner/repo`) through the app's API. Throws with
 * a message the user can read.
 */
export async function fetchRemoteSkills(source: string, names?: string[]): Promise<RemoteSkills> {
  const response = await fetch("/api/skills/fetch", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ source, ...(names?.length ? { names } : {}) }),
  });
  const data = (await response.json().catch(() => null)) as
    (RemoteSkills & { error?: undefined }) | { error: string } | null;
  if (!response.ok || !data || ("error" in data && data.error))
    throw new Error(
      (data && "error" in data && data.error) || `The request failed (${response.status}).`,
    );
  return data as RemoteSkills;
}
