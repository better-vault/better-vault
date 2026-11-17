import { GithubIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cacheLife } from "next/cache";
import { fetchRepositoryInfo } from "fumadocs-ui/components/github-info";

/**
 * The repository's star count, looked up at most once an hour. It is a
 * cached function (`"use cache"`), so a slow or failed request never makes a
 * page dynamic: with cacheComponents, a plain `fetch` during prerendering does.
 */
async function starCount(): Promise<number | null> {
  "use cache";
  cacheLife("hours");
  try {
    const info = await fetchRepositoryInfo({
      owner: "better-vault",
      repo: "better-vault",
      token: process.env.GITHUB_TOKEN,
    });
    return info.stars;
  } catch {
    return null;
  }
}

/** The GitHub mark with the repository's star count; without a count the mark is shown alone. */
export async function GithubStars() {
  const stars = await starCount();

  return (
    <span className="inline-flex items-center gap-1.5">
      <HugeiconsIcon icon={GithubIcon} className="size-4" aria-hidden="true" />
      <span className="sr-only">GitHub repository</span>
      {stars === null ? null : (
        <span className="tabular-nums" aria-label={`${stars} stars`}>
          {stars < 1000 ? stars : `${(stars / 1000).toFixed(1).replace(/\.0$/, "")}k`}
        </span>
      )}
    </span>
  );
}
