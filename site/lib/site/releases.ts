import { cacheLife } from "next/cache";
import { site } from "@/lib/site/config";
import { installersFrom, type GithubAsset, type Installer } from "@/lib/site/installers";

/**
 * The desktop installers of the latest GitHub release, for the download page.
 * The release is looked up at most once an hour, so a new release appears on
 * the site without a redeploy.
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
  cacheLife("hours");
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
    if (!response.ok) return null;
    const release = (await response.json()) as GithubRelease;
    if (release.draft) return null;
    return {
      version: release.tag_name.replace(/^v/, ""),
      publishedAt: release.published_at,
      notesUrl: release.html_url,
      installers: installersFrom(release.assets),
    };
  } catch {
    return null;
  }
}
