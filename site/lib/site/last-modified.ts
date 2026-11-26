import { execFileSync } from "node:child_process";

/**
 * When each file last changed, from one `git log` over the paths given
 * (relative to this project, since it sits in site/ of the repository). Real
 * dates help crawlers decide what to revisit, and answer engines prefer pages
 * that say when they were updated. Without git history (a tarball build) a
 * page simply has no date, rather than claiming it changed today.
 */
export function lastModifiedByFile(paths: string[]): Map<string, Date> {
  const dates = new Map<string, Date>();
  try {
    const log = execFileSync(
      "git",
      ["log", "--name-only", "--relative", "--pretty=format:%cI", "--", ...paths],
      { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
    );
    let commitDate: Date | null = null;
    for (const line of log.split("\n")) {
      if (!line) continue;
      if (/^\d{4}-\d{2}-\d{2}T/.test(line)) commitDate = new Date(line);
      else if (commitDate && !dates.has(line)) dates.set(line, commitDate);
    }
  } catch {
    // No git history: pages are listed without a date.
  }
  return dates;
}

let docsDates: Map<string, Date> | null = null;

/** When a docs page (its path under content/docs) last changed, read once per build. */
export function docsLastModified(pagePath: string): Date | undefined {
  docsDates ??= lastModifiedByFile(["content/docs"]);
  return docsDates.get(`content/docs/${pagePath}`);
}
