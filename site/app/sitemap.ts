import { execFileSync } from "node:child_process";
import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site/config";
import { source } from "@/lib/source";

/**
 * When each file last changed, from one `git log` over the paths given
 * (relative to this project, since it sits in site/ of the repository). Real
 * dates help crawlers decide what to revisit. Without git history (a tarball
 * build) a page simply has no date, rather than claiming it changed today.
 */
function lastModifiedByFile(paths: string[]): Map<string, Date> {
  const dates = new Map<string, Date>();
  try {
    const log = execFileSync("git", ["log", "--name-only", "--relative", "--pretty=format:%cI", "--", ...paths], {
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
    });
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

/** The landing page and every docs page. Canonical URLs only; the app is not listed. */
export default function sitemap(): MetadataRoute.Sitemap {
  const home = "app/(home)/page.tsx";
  const download = "app/(home)/download/page.tsx";
  const dates = lastModifiedByFile(["content/docs", home, download]);
  const entry = (url: string, file: string) => {
    const lastModified = dates.get(file);
    return lastModified ? { url: absoluteUrl(url), lastModified } : { url: absoluteUrl(url) };
  };

  return [
    entry("/", home),
    entry("/download", download),
    ...source.getPages().map((page) => entry(page.url, `content/docs/${page.path}`)),
  ];
}
