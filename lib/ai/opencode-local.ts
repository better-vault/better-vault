import { execFile } from "node:child_process";
import { access } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

/**
 * Looks for the OpenCode program on this computer (desktop app only). Apps
 * started from the Dock or Start menu don't get the shell's PATH, so the
 * places OpenCode's installers use are checked too.
 */
export interface OpenCodeInstall {
  path: string;
  version: string;
}

const windows = process.platform === "win32";
const binary = windows ? "opencode.exe" : "opencode";

function candidates(): string[] {
  const home = os.homedir();
  const fromPath = (process.env.PATH ?? "").split(path.delimiter).filter(Boolean);
  const known = windows
    ? [
        path.join(home, "AppData", "Local", "Programs", "opencode"),
        path.join(home, "AppData", "Roaming", "npm"),
        path.join(home, "scoop", "shims"),
        path.join(home, ".opencode", "bin"),
      ]
    : [
        path.join(home, ".opencode", "bin"),
        path.join(home, ".local", "bin"),
        path.join(home, ".bun", "bin"),
        path.join(home, ".npm-global", "bin"),
        "/opt/homebrew/bin",
        "/usr/local/bin",
        "/usr/bin",
      ];
  return [...new Set([...known, ...fromPath])].map((folder) => path.join(folder, binary));
}

function version(file: string): Promise<string | null> {
  return new Promise((resolve) => {
    execFile(file, ["--version"], { timeout: 5_000, windowsHide: true }, (error, stdout) =>
      resolve(error ? null : stdout.toString().trim().split("\n")[0] || "unknown"),
    );
  });
}

export async function findOpenCode(): Promise<OpenCodeInstall | null> {
  for (const file of candidates()) {
    try {
      await access(file);
    } catch {
      continue;
    }
    const found = await version(file);
    if (found) return { path: file, version: found.replace(/^opencode\s*/i, "") };
  }
  return null;
}
