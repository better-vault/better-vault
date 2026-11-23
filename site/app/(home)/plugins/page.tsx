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
    "Browse better-vault plugins: Studio tools, mods and themes that extend the app, each reviewed before it is listed. Search, read the details and install from the app.",
  alternates: { canonical: absoluteUrl("/plugins") },
};

/** The plugin directory, read live from the plugins repository. */
export default async function PluginsPage() {
  const plugins = await listPlugins();
  return (
    <main className="flex flex-1 flex-col">
      <section className="flex flex-col items-center px-6 pt-32 pb-12 text-center sm:pt-40">
        <div className="flex w-full max-w-3xl flex-col items-center gap-6">
          <p className="rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground">
            Reviewed · Sandboxed · Open source
          </p>
          <h1 className="font-heading text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
            Plugins
          </h1>
          <p className="max-w-2xl text-lg text-balance text-muted-foreground">
            Studio tools, mods and themes that extend better-vault. Each one was reviewed before it
            was listed, runs in a sandbox, and can only use what you allow.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/docs/plugins" className={buttonVariants({ size: "lg" })}>
              Build a plugin
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
      </section>
      <section className="border-t px-6 py-12">
        <div className="mx-auto max-w-5xl">
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
