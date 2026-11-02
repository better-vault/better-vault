/** Compares two "x.y.z" versions (a leading "v" is ignored): negative, zero or positive. */
export function compareVersions(a: string, b: string): number {
  const parts = (version: string) =>
    version
      .replace(/^v/, "")
      .split(/[.+-]/)
      .slice(0, 3)
      .map((part) => Number.parseInt(part, 10) || 0);
  const [x, y] = [parts(a), parts(b)];
  for (let i = 0; i < 3; i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) - (y[i] ?? 0);
  return 0;
}

export const releasesUrl = "https://github.com/better-vault/better-vault/releases";

/** The release notes of one version on GitHub. */
export function releaseNotesUrl(version: string) {
  return `${releasesUrl}/tag/v${version.replace(/^v/, "")}`;
}
