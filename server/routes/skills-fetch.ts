import { z } from "zod";
import { describeError } from "@/lib/ai/errors";
import { parseSkillFile } from "@/lib/skills/format";
import {
  describeSkillSource,
  parseSkillSource,
  SkillSourceError,
  type SkillSource,
} from "@/lib/skills/source";

const bodySchema = z.object({
  /** What the user pasted: an `npx skills add …` command, a skills.sh or GitHub link, `owner/repo`. */
  source: z.string().min(1).max(2000),
  /** Only these skills, on top of any the source names. */
  names: z.array(z.string().max(200)).max(50).optional(),
});

/** The most skills one fetch reads, and the size of each. */
export const MAX_SKILLS = 50;
const MAX_FILE = 256 * 1024;
const MAX_TREE = 8 * 1024 * 1024;

export interface FetchedSkill {
  name: string;
  description: string;
  body: string;
  /** Where its SKILL.md is in the repository. */
  path: string;
}

export interface SkillsFetchResult {
  repo: string;
  ref: string;
  skills: FetchedSkill[];
  /** More SKILL.md files were found than one fetch reads. */
  truncated: boolean;
}

class GithubError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Fetches from GitHub's API or its raw file host. The hosts are fixed, so no
 * address the user typed is ever fetched; the user's own GitHub token, when
 * the server has one (`GITHUB_TOKEN`), raises the rate limit and is never logged.
 */
async function github(url: string, maxBytes: number): Promise<string> {
  const host = new URL(url).hostname;
  if (host !== "api.github.com" && host !== "raw.githubusercontent.com")
    throw new Error("Only GitHub is fetched.");
  const token = process.env.GITHUB_TOKEN;
  const response = await fetch(url, {
    signal: AbortSignal.timeout(15_000),
    headers: {
      "user-agent": "better-vault (+https://github.com/better-vault/better-vault)",
      ...(host === "api.github.com" ? { accept: "application/vnd.github+json" } : {}),
      ...(token && host === "api.github.com" ? { authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!response.ok) {
    const limited =
      response.status === 429 ||
      (response.status === 403 && response.headers.get("x-ratelimit-remaining") === "0");
    throw new GithubError(
      response.status,
      limited
        ? "GitHub's limit for requests without an account was reached. Try again in a while."
        : response.status === 404
          ? "GitHub has no public repository, branch or folder by that name."
          : `GitHub answered ${response.status}.`,
    );
  }
  const declared = Number(response.headers.get("content-length") ?? 0);
  if (declared > maxBytes) throw new Error("A file is too large to fetch.");
  const text = await response.text();
  if (text.length > maxBytes) throw new Error("A file is too large to fetch.");
  return text;
}

const encodePath = (path: string) => path.split("/").map(encodeURIComponent).join("/");

/**
 * Whether a SKILL.md is where the skills CLI looks: the repository's root, or
 * a folder inside a `skills` folder (`skills/<name>`, `skills/<category>/<name>`,
 * `.claude/skills/<name>`, `.agents/skills/<name>`, …).
 */
export function isDiscoverable(path: string): boolean {
  if (path === "SKILL.md") return true;
  const folders = path.split("/").slice(0, -1);
  const at = folders.lastIndexOf("skills");
  return at !== -1 && folders.length - at - 1 >= 1 && folders.length - at - 1 <= 3;
}

/** The skill folder's own name, which is how the skills CLI names a skill. */
const folderName = (path: string, repo: string) => path.split("/").at(-2) ?? repo;

/** Finds the SKILL.md files a source points at and reads them. */
export async function fetchSkills(source: SkillSource): Promise<SkillsFetchResult> {
  const api = `https://api.github.com/repos/${encodeURIComponent(source.owner)}/${encodeURIComponent(source.repo)}`;
  const ref =
    source.ref ??
    (JSON.parse(await github(api, 1024 * 1024)) as { default_branch: string }).default_branch;
  const tree = JSON.parse(
    await github(`${api}/git/trees/${encodeURIComponent(ref)}?recursive=1`, MAX_TREE),
  ) as { tree: { path: string; type: string }[] };
  const files = tree.tree
    .filter((entry) => entry.type === "blob" && /(^|\/)SKILL\.md$/.test(entry.path))
    .map((entry) => entry.path);

  const prefix = source.path?.replace(/\/SKILL\.md$/, "").replace(/\/+$/, "");
  const inPrefix = prefix
    ? files.filter((path) => path === `${prefix}/SKILL.md` || path.startsWith(`${prefix}/`))
    : files;
  // Inside a folder the user pointed at, every SKILL.md counts.
  let candidates = prefix ? inPrefix : inPrefix.filter(isDiscoverable);

  const wanted = (source.skills ?? []).map((name) => name.toLowerCase());
  if (wanted.length) {
    const byFolder = candidates.filter((path) =>
      wanted.includes(folderName(path, source.repo).toLowerCase()),
    );
    // The names may be frontmatter names; then every candidate is read and filtered below.
    if (byFolder.length >= wanted.length) candidates = byFolder;
  }

  const truncated = candidates.length > MAX_SKILLS;
  const read = await Promise.all(
    candidates.slice(0, MAX_SKILLS).map(async (path): Promise<FetchedSkill> => {
      const text = await github(
        `https://raw.githubusercontent.com/${encodeURIComponent(source.owner)}/${encodeURIComponent(source.repo)}/${encodeURIComponent(ref)}/${encodePath(path)}`,
        MAX_FILE,
      );
      return { ...parseSkillFile(text, folderName(path, source.repo)), path };
    }),
  );
  const skills = wanted.length
    ? read.filter(
        (skill) =>
          wanted.includes(skill.name.toLowerCase()) ||
          wanted.includes(folderName(skill.path, source.repo).toLowerCase()),
      )
    : read;
  return { repo: `${source.owner}/${source.repo}`, ref, skills, truncated };
}

/**
 * Reads skills from GitHub for the Skills page's Fetch tab and for bots:
 * what `npx skills add` would install, as SKILL.md files. Nothing is stored
 * on the server; the page saves the skills the user picks.
 */
export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request." }, { status: 400 });
  let source: SkillSource;
  try {
    source = parseSkillSource(parsed.data.source);
  } catch (error) {
    return Response.json(
      { error: error instanceof SkillSourceError ? error.message : "That source can't be read." },
      { status: 400 },
    );
  }
  if (parsed.data.names?.length)
    source = { ...source, skills: [...(source.skills ?? []), ...parsed.data.names] };
  try {
    const result = await fetchSkills(source);
    if (result.skills.length === 0)
      return Response.json(
        { error: `No skills (SKILL.md files) were found in ${describeSkillSource(source)}.` },
        { status: 404 },
      );
    return Response.json(result);
  } catch (error) {
    const status = error instanceof GithubError ? (error.status === 404 ? 404 : 502) : 502;
    return Response.json({ error: describeError(error) }, { status });
  }
}
