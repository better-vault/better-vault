/**
 * Desktop installers as the download page shows them. Pure code, used by the
 * server lookup in ./releases and the browser's download button.
 */

export type Platform = "mac" | "windows" | "linux";

export interface Installer {
  platform: Platform;
  /** What the file is for, such as "Apple silicon" or "Debian, Ubuntu (x64)". */
  label: string;
  /** The file's kind, shown beside the label: "DMG", "Installer", "AppImage", "deb". */
  kind: string;
  /** The CPU it runs on. */
  arch: "arm64" | "x64";
  name: string;
  url: string;
  bytes: number;
}

export interface GithubAsset {
  name: string;
  size: number;
  browser_download_url: string;
}

/**
 * Sorts a release's files into installers, by the names electron-builder
 * gives them (`better-vault-<version>-<os>-<arch>.<ext>`, see
 * desktop/electron-builder.config.mjs). Update files (.zip, .blockmap, .yml)
 * are left out.
 */
export function installersFrom(assets: GithubAsset[]): Installer[] {
  const installers: Installer[] = [];
  for (const asset of assets) {
    const name = asset.name;
    const arch = /arm64|aarch64/i.test(name) ? "arm64" : "x64";
    const base = { name, url: asset.browser_download_url, bytes: asset.size, arch } as const;
    if (name.endsWith(".dmg"))
      installers.push({
        ...base,
        platform: "mac",
        kind: "DMG",
        label: arch === "arm64" ? "Apple silicon" : "Intel",
      });
    else if (name.endsWith(".exe"))
      installers.push({
        ...base,
        platform: "windows",
        kind: "Installer",
        label: "Windows 10 and 11",
      });
    else if (name.endsWith(".AppImage"))
      installers.push({
        ...base,
        platform: "linux",
        kind: "AppImage",
        label: `Most distributions (${arch})`,
      });
    else if (name.endsWith(".deb"))
      installers.push({
        ...base,
        platform: "linux",
        kind: "deb",
        label: `Debian, Ubuntu (${arch})`,
      });
  }
  const order = [
    "DMG-arm64",
    "DMG-x64",
    "Installer-x64",
    "Installer-arm64",
    "AppImage-x64",
    "AppImage-arm64",
    "deb-x64",
    "deb-arm64",
  ];
  const rank = (installer: Installer) => order.indexOf(`${installer.kind}-${installer.arch}`);
  return installers.sort((a, b) => rank(a) - rank(b));
}

/** A file size in megabytes, as shown beside each download. */
export function formatSize(bytes: number): string {
  return `${(bytes / 1_000_000).toFixed(0)} MB`;
}
