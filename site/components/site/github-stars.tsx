import { GithubIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { fetchRepositoryInfo } from "fumadocs-ui/components/github-info";

/**
 * The GitHub mark with the repository's star count. The count is cached for
 * good (`force-cache`) so the pages stay static; without a count the mark is
 * shown alone.
 */
export async function GithubStars() {
  let stars: number | null = null;
  try {
    const info = await fetchRepositoryInfo({
      owner: "better-vault",
      repo: "better-vault",
      token: process.env.GITHUB_TOKEN,
      fetchOptions: { cache: "force-cache" },
    });
    stars = info.stars;
  } catch {
    stars = null;
  }

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
