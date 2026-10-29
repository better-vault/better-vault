"use client";

import { useEffect, useState } from "react";
import { Download04Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { buttonVariants } from "@/components/panelui/button";
import { formatSize, type Installer, type Platform } from "@/lib/site/installers";

const PLATFORM_NAMES: Record<Platform, string> = {
  mac: "macOS",
  windows: "Windows",
  linux: "Linux",
};

interface Detected {
  platform: Platform;
  arch: "arm64" | "x64" | null;
}

/** The visitor's system, from the browser. Unknown systems (phones, say) get null. */
async function detect(): Promise<Detected | null> {
  const nav = navigator as Navigator & {
    userAgentData?: {
      platform?: string;
      getHighEntropyValues?: (hints: string[]) => Promise<{ architecture?: string }>;
    };
  };
  const platformName = (nav.userAgentData?.platform || nav.userAgent).toLowerCase();
  if (/android|iphone|ipad/.test(nav.userAgent.toLowerCase())) return null;
  const platform: Platform | null = platformName.includes("mac")
    ? "mac"
    : platformName.includes("win")
      ? "windows"
      : platformName.includes("linux")
        ? "linux"
        : null;
  if (!platform) return null;
  // Chromium browsers report the CPU; Safari and Firefox do not.
  let arch: Detected["arch"] = null;
  try {
    const values = await nav.userAgentData?.getHighEntropyValues?.(["architecture"]);
    if (values?.architecture === "arm") arch = "arm64";
    else if (values?.architecture === "x86") arch = "x64";
  } catch {
    arch = null;
  }
  return { platform, arch };
}

/** The installer for a system: on a Mac, Apple silicon unless the browser says Intel. */
function pick(installers: Installer[], detected: Detected): Installer | undefined {
  const own = installers.filter((installer) => installer.platform === detected.platform);
  if (detected.platform === "linux")
    return own.find((i) => i.kind === "AppImage" && i.arch === (detected.arch ?? "x64")) ?? own[0];
  return own.find((i) => i.arch === (detected.arch ?? "arm64")) ?? own[0];
}

/**
 * The large button at the top of the download page. It offers the installer
 * for the visitor's system; until the system is known, or when there is no
 * installer for it, it points at the list of all downloads.
 */
export function DownloadButton({
  installers,
  version,
}: {
  installers: Installer[];
  version: string;
}) {
  const [detected, setDetected] = useState<Detected | null>(null);

  useEffect(() => {
    let live = true;
    void detect().then((result) => {
      if (live) setDetected(result);
    });
    return () => {
      live = false;
    };
  }, []);

  const installer = detected ? pick(installers, detected) : undefined;

  if (!installer)
    return (
      <a href="#all-downloads" className={buttonVariants({ size: "lg" })}>
        <HugeiconsIcon icon={Download04Icon} aria-hidden="true" />
        Choose your system
      </a>
    );

  const system =
    installer.platform === "mac"
      ? `macOS (${installer.label})`
      : installer.platform === "linux"
        ? `Linux (${installer.kind})`
        : PLATFORM_NAMES[installer.platform];

  return (
    <div className="flex flex-col items-center gap-2">
      <a href={installer.url} className={buttonVariants({ size: "lg" })}>
        <HugeiconsIcon icon={Download04Icon} aria-hidden="true" />
        Download for {system}
      </a>
      <p className="text-xs text-muted-foreground">
        Version {version} · {formatSize(installer.bytes)} ·{" "}
        <a href="#all-downloads" className="underline underline-offset-4 hover:text-foreground">
          Other systems
        </a>
      </p>
    </div>
  );
}
