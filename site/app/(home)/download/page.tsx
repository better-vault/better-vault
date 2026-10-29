import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight01Icon, Download04Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { buttonVariants } from "@/components/panelui/button";
import { DownloadButton } from "@/components/site/download-button";
import { absoluteUrl, site } from "@/lib/site/config";
import { formatSize, type Installer, type Platform } from "@/lib/site/installers";
import { latestRelease, releasesUrl } from "@/lib/site/releases";

export const metadata: Metadata = {
  title: "Download",
  description:
    "Download the better-vault desktop app for macOS, Windows and Linux: the open-source NotebookLM alternative, with notebooks on your computer and auto-updates.",
  alternates: { canonical: absoluteUrl("/download") },
};

/**
 * The systems, with their own marks (site/public/platforms, see its README).
 * `dark` is the mark for the dark theme when it differs.
 */
const PLATFORMS: { id: Platform; name: string; logo: string; dark?: string; requires: string }[] = [
  {
    id: "mac",
    name: "macOS",
    logo: "/platforms/apple-light.svg",
    dark: "/platforms/apple-dark.svg",
    requires: "macOS 12 Monterey or later",
  },
  {
    id: "windows",
    name: "Windows",
    logo: "/platforms/windows.svg",
    requires: "Windows 10 or 11, 64-bit",
  },
  {
    id: "linux",
    name: "Linux",
    logo: "/platforms/linux.svg",
    requires: "64-bit, Ubuntu 22.04, Debian 12 or newer",
  },
];

function PlatformLogo({ logo, dark }: { logo: string; dark?: string }) {
  return (
    <>
      <Image
        src={logo}
        alt=""
        width={20}
        height={20}
        className={dark ? "size-5 dark:hidden" : "size-5"}
      />
      {dark ? (
        <Image src={dark} alt="" width={20} height={20} className="hidden size-5 dark:block" />
      ) : null}
    </>
  );
}

const PERKS = [
  {
    title: "Same app as the web",
    body: "Every tool, chat mode and provider, with the same interface.",
  },
  {
    title: "Notebooks on your computer",
    body: "Kept in one file in the app's data folder, not in a browser.",
  },
  {
    title: "Updates itself",
    body: "New versions download in the background and install on restart.",
  },
];

function DownloadRow({ installer }: { installer: Installer }) {
  return (
    <li>
      <a
        href={installer.url}
        className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-accent"
      >
        <span className="flex min-w-0 flex-col">
          <span className="text-sm font-medium">{installer.label}</span>
          <span className="truncate text-xs text-muted-foreground">
            {installer.kind} · {formatSize(installer.bytes)}
          </span>
        </span>
        <HugeiconsIcon
          icon={Download04Icon}
          className="size-4 shrink-0 text-muted-foreground"
          aria-label={`Download ${installer.name}`}
        />
      </a>
    </li>
  );
}

export default async function DownloadPage() {
  const release = await latestRelease();
  const installers = release?.installers ?? [];
  const released = release
    ? new Date(release.publishedAt).toLocaleDateString("en", { dateStyle: "long" })
    : null;

  return (
    <main className="flex flex-1 flex-col">
      <section className="flex flex-col items-center px-6 pt-32 pb-16 text-center sm:pt-40">
        <div className="flex w-full max-w-3xl flex-col items-center gap-6">
          <p className="rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground">
            Free · Open source · No account
          </p>
          <h1 className="font-heading text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
            Download {site.name}
          </h1>
          <p className="max-w-2xl text-lg text-balance text-muted-foreground">
            The desktop app for macOS, Windows and Linux. It is the same app as on the web, keeps
            your notebooks on your computer and updates itself.
          </p>
          {release && installers.length > 0 ? (
            <DownloadButton installers={installers} version={release.version} />
          ) : (
            <div className="flex flex-col items-center gap-3">
              <p className="max-w-xl text-sm text-balance text-muted-foreground">
                The first desktop installers are coming with the next release. Until then, you can
                run better-vault from source in a few minutes.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <Link href="/docs/quickstart" className={buttonVariants({ size: "lg" })}>
                  Get started
                </Link>
                <a
                  href={releasesUrl}
                  className={buttonVariants({ size: "lg", variant: "outline" })}
                >
                  Releases on GitHub
                  <HugeiconsIcon icon={ArrowUpRight01Icon} aria-hidden="true" />
                </a>
              </div>
            </div>
          )}
        </div>
      </section>

      <section
        id="all-downloads"
        aria-labelledby="all-downloads-title"
        className="scroll-mt-20 border-t px-6 py-16"
      >
        <div className="mx-auto flex max-w-5xl flex-col gap-8">
          <div className="flex flex-col gap-2">
            <h2
              id="all-downloads-title"
              className="font-heading text-3xl font-semibold tracking-tight"
            >
              All downloads
            </h2>
            <p className="text-muted-foreground">
              {release && released && installers.length > 0
                ? `Version ${release.version}, released ${released}.`
                : "Installers for every system are listed here once they are released."}
            </p>
          </div>

          <ul className="grid gap-4 md:grid-cols-3">
            {PLATFORMS.map((platform) => {
              const files = installers.filter((installer) => installer.platform === platform.id);
              return (
                <li key={platform.id} className="flex flex-col rounded-xl border bg-card">
                  <div className="flex items-center gap-3 border-b px-5 py-4">
                    <span className="flex size-10 items-center justify-center rounded-xl border bg-background">
                      <PlatformLogo logo={platform.logo} dark={platform.dark} />
                    </span>
                    <div className="flex flex-col">
                      <h3 className="font-medium">{platform.name}</h3>
                      <p className="text-xs text-muted-foreground">{platform.requires}</p>
                    </div>
                  </div>
                  {files.length > 0 ? (
                    <ul className="flex flex-col gap-0.5 p-2">
                      {files.map((installer) => (
                        <DownloadRow key={installer.name} installer={installer} />
                      ))}
                    </ul>
                  ) : (
                    <p className="px-5 py-4 text-sm text-muted-foreground">
                      Coming with the next release.
                    </p>
                  )}
                </li>
              );
            })}
          </ul>

          <ul className="grid gap-6 border-t pt-8 sm:grid-cols-3">
            {PERKS.map((perk) => (
              <li key={perk.title} className="flex flex-col gap-1">
                <h3 className="text-sm font-medium">{perk.title}</h3>
                <p className="text-sm text-muted-foreground">{perk.body}</p>
              </li>
            ))}
          </ul>

          <p className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t pt-6 text-sm text-muted-foreground">
            {release && installers.length > 0 ? (
              <a
                href={release.notesUrl}
                className="underline-offset-4 hover:text-foreground hover:underline"
              >
                Release notes
              </a>
            ) : null}
            <a
              href={releasesUrl}
              className="underline-offset-4 hover:text-foreground hover:underline"
            >
              All releases on GitHub
            </a>
            <Link
              href="/docs/desktop"
              className="underline-offset-4 hover:text-foreground hover:underline"
            >
              Installing and updating
            </Link>
            <Link
              href="/docs/quickstart"
              className="underline-offset-4 hover:text-foreground hover:underline"
            >
              Run from source instead
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
