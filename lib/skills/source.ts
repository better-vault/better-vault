/**
 * Where to fetch skills from: a GitHub repository, optionally a branch, tag
 * or commit, a folder in it and the skill names wanted. Read from what people
 * paste: an `npx skills add …` command from skills.sh, a skills.sh page, a
 * GitHub link or `owner/repo`.
 */
export interface SkillSource {
  owner: string;
  repo: string;
  /** Branch, tag or commit; the repository's default branch when missing. */
  ref?: string;
  /** A folder (or a SKILL.md file) in the repository to look in. */
  path?: string;
  /** Only these skills, by folder name or frontmatter name. */
  skills?: string[];
}

export class SkillSourceError extends Error {
  constructor(
    readonly code: "empty" | "not-github" | "unreadable",
    message: string,
  ) {
    super(message);
  }
}

const NAME = /^[A-Za-z0-9_.-]+$/;

/** Splits a command line into words, keeping quoted words together. */
function words(text: string): string[] {
  const out: string[] = [];
  for (const match of text.matchAll(/"([^"]*)"|'([^']*)'|(\S+)/g))
    out.push(match[1] ?? match[2] ?? match[3]);
  return out;
}

/** Flags of `skills add` that take a value we don't use. */
const VALUE_FLAGS = new Set(["-a", "--agent", "--agents"]);

/** Reads what was pasted into a source. Throws `SkillSourceError` when it isn't one. */
export function parseSkillSource(input: string): SkillSource {
  const text = input.trim().replace(/^\$\s*/, "");
  if (!text) throw new SkillSourceError("empty", "Paste an npx skills add command or a link.");

  const parts = words(text);
  // `npx skills add …`, `npx -y skills@latest add …`, `pnpm dlx skills add …`, `skills add …`,
  // and `npx skills use owner/repo@skill`, where the part after @ is a skill, not a ref.
  const add = parts.findIndex(
    (word, at) =>
      (word === "add" || word === "install" || word === "use") &&
      /^skills(@.*)?$/.test(parts[at - 1] ?? ""),
  );
  const using = add !== -1 && parts[add] === "use";
  if (add === -1) return parseLocation(text, []);

  const rest = parts.slice(add + 1);
  let location: string | undefined;
  const skills: string[] = [];
  for (let at = 0; at < rest.length; at++) {
    const word = rest[at];
    if (word === "-s" || word === "--skill" || word === "--skills") {
      while (at + 1 < rest.length && !rest[at + 1].startsWith("-")) skills.push(rest[++at]);
    } else if (word.startsWith("--skill=")) {
      skills.push(...word.slice(8).split(","));
    } else if (VALUE_FLAGS.has(word)) {
      while (at + 1 < rest.length && !rest[at + 1].startsWith("-")) at++;
    } else if (!word.startsWith("-") && !location) {
      location = word;
    }
  }
  if (!location)
    throw new SkillSourceError("unreadable", "The command doesn't say which repository to add.");
  if (using && /^[^/:]+\/[^/@:]+@[^/]+$/.test(location)) {
    const [repoPart, skill] = location.split("@");
    skills.push(skill);
    location = repoPart;
  }
  return parseLocation(
    location,
    skills.filter((name) => name && name !== "*"),
  );
}

function withSkills(source: SkillSource, skills: string[]): SkillSource {
  return skills.length
    ? { ...source, skills: [...new Set([...(source.skills ?? []), ...skills])] }
    : source;
}

function parseLocation(location: string, skills: string[]): SkillSource {
  // owner/repo, or owner/repo@ref
  const short = /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?(?:@([^\s/]+))?$/.exec(location);
  if (short && !location.includes(":")) {
    return withSkills(
      { owner: short[1], repo: short[2], ...(short[3] ? { ref: short[3] } : {}) },
      skills,
    );
  }

  const ssh = /^git@github\.com:([^/]+)\/(.+?)(?:\.git)?$/.exec(location);
  if (ssh) return withSkills({ owner: ssh[1], repo: ssh[2] }, skills);

  let url: URL;
  try {
    url = new URL(/^[a-z]+:\/\//i.test(location) ? location : `https://${location}`);
  } catch {
    throw new SkillSourceError("unreadable", "That isn't a GitHub repository or a skills.sh link.");
  }
  const host = url.hostname.replace(/^www\./, "");
  const segments = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);

  if (host === "skills.sh") {
    const [owner, repo, skill] = segments;
    if (!owner || !repo || !NAME.test(owner) || !NAME.test(repo))
      throw new SkillSourceError(
        "unreadable",
        "Open a skill or a repository on skills.sh and copy its link.",
      );
    return withSkills({ owner, repo }, skill ? [skill, ...skills] : skills);
  }

  if (host === "github.com") {
    const [owner, rawRepo, kind, ref, ...path] = segments;
    const repo = rawRepo?.replace(/\.git$/, "");
    if (!owner || !repo || !NAME.test(owner) || !NAME.test(repo))
      throw new SkillSourceError("unreadable", "That GitHub link doesn't point at a repository.");
    const source: SkillSource = { owner, repo };
    if ((kind === "tree" || kind === "blob") && ref) {
      source.ref = ref;
      const folder = path.join("/");
      if (folder) source.path = folder;
    }
    return withSkills(source, skills);
  }

  if (host === "raw.githubusercontent.com") {
    const [owner, repo, ref, ...path] = segments;
    if (!owner || !repo || !ref)
      throw new SkillSourceError("unreadable", "That link doesn't point at a file.");
    return withSkills({ owner, repo, ref, path: path.join("/") }, skills);
  }

  throw new SkillSourceError(
    "not-github",
    "Only skills on GitHub can be fetched for now. Paste an npx skills add command, a skills.sh link or a GitHub link.",
  );
}

/** How a source is shown: `owner/repo`, with its ref and folder. */
export function describeSkillSource(source: SkillSource): string {
  return `${source.owner}/${source.repo}${source.ref ? `@${source.ref}` : ""}${source.path ? `/${source.path}` : ""}`;
}
