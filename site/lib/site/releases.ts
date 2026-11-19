import { cacheLife } from "next/cache";
import { site } from "@/lib/site/config";
import { installersFrom, type GithubAsset, type Installer } from "@/lib/site/installers";

/**
 * The desktop installers of the latest GitHub release, for the download page.
 * A release with its installers is looked up at most once an hour, so a new
 * release appears on the site without a redeploy. A release whose installers
 * are still being built (the Desktop workflow attaches them after it is
 * published), or a failed lookup, is kept only for minutes, so the page never
 * stays on "coming with the next release" once the files are there.
 */

export interface LatestRelease {
  version: string;
  publishedAt: string;
  notesUrl: string;
  installers: Installer[];
}

export const releasesUrl = `${site.repo}/releases`;

interface GithubRelease {
  tag_name: string;
  published_at: string;
  html_url: string;
  draft: boolean;
  assets: GithubAsset[];
}

/** The latest published release, or `null` when GitHub can't be reached. */
export async function latestRelease(): Promise<LatestRelease | null> {
  "use cache";
  try {
    const response = await fetch(
      "https://api.github.com/repos/better-vault/better-vault/releases/latest",
      {
        headers: {
          Accept: "application/vnd.github+json",
          ...(process.env.GITHUB_TOKEN
            ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
            : {}),
        },
      },
    );
    if (!response.ok) {
      cacheLife("minutes");
      return null;
    }
    const release = (await response.json()) as GithubRelease;
    const installers = release.draft ? [] : installersFrom(release.assets);
    if (release.draft || installers.length === 0) {
      // Not ready yet: ask again soon.
      cacheLife("minutes");
      return release.draft
        ? null
        : {
            version: release.tag_name.replace(/^v/, ""),
            publishedAt: release.published_at,
            notesUrl: release.html_url,
            installers,
          };
    }
    cacheLife("hours");
    return {
      version: release.tag_name.replace(/^v/, ""),
      publishedAt: release.published_at,
      notesUrl: release.html_url,
      installers,
    };
  } catch {
    cacheLife("minutes");
    return null;
  }
}
