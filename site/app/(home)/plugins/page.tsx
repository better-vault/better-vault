import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { buttonVariants } from "@/components/panelui/button";
import { PluginSearch } from "@/components/site/plugins/plugin-search";
import { absoluteUrl } from "@/lib/site/config";
import { listPlugins, pluginsRepo } from "@/lib/site/plugins";

export const metadata: Metadata = {
  title: "Plugins",
  description:
    "Browse better-vault plugins: Studio tools, mods and themes from their creators' repositories, each reviewed before it is listed. Search, sort and install from the app.",
  alternates: { canonical: absoluteUrl("/plugins") },
};

/** The plugin directory, read live from the plugins repository. */
export default async function PluginsPage() {
  const plugins = await listPlugins();
  return (
    <main className="flex flex-1 flex-col">
      <section className="px-6 pt-32 pb-12 sm:pt-40">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1fr_minmax(0,24rem)] lg:items-end">
          <div className="flex flex-col gap-6">
            <p className="text-sm font-medium text-muted-foreground">Plugins</p>
            <h1 className="font-heading text-5xl font-semibold tracking-tight text-balance sm:text-7xl">
              Make it yours.
              <span className="block text-muted-foreground">Tools, mods and themes.</span>
            </h1>
          </div>
          <div className="flex flex-col gap-5">
            <p className="text-lg text-pretty text-muted-foreground">
              Each plugin lives in its creator&apos;s own repository and was reviewed before it was
              listed. It runs in a sandbox and can only use what you allow.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/docs/plugins/publish" className={buttonVariants({ size: "lg" })}>
                Share yours
              </Link>
              <a
                href={`${pluginsRepo}/issues/new/choose`}
                className={buttonVariants({ size: "lg", variant: "outline" })}
              >
                Request a plugin
                <HugeiconsIcon icon={ArrowUpRight01Icon} aria-hidden="true" />
              </a>
            </div>
          </div>
        </div>
      </section>
      <section className="px-6 pb-20">
        <div className="mx-auto max-w-6xl">
          {plugins.length ? (
            <PluginSearch plugins={plugins} />
          ) : (
            <p className="py-12 text-center text-sm text-muted-foreground">
              The plugin directory can&apos;t be reached right now. It is also on{" "}
              <a href={pluginsRepo} className="underline underline-offset-4">
                GitHub
              </a>
              .
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
