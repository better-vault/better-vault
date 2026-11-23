import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert02Icon, ArrowLeft01Icon, Github01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { buttonVariants } from "@/components/panelui/button";
import { PluginIcon } from "@/components/site/plugins/plugin-icon";
import { absoluteUrl } from "@/lib/site/config";
import {
  describeAdds,
  getPlugin,
  listPlugins,
  permissionLabels,
  pluginsRepo,
  rawUrl,
} from "@/lib/site/plugins";

type Props = { params: Promise<{ id: string }> };

export async function generateStaticParams() {
  return (await listPlugins()).map((plugin) => ({ id: plugin.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const plugin = await getPlugin((await params).id);
  if (!plugin) return { title: "Plugin" };
  return {
    title: `${plugin.name} plugin`,
    description: plugin.description.slice(0, 160),
    alternates: { canonical: absoluteUrl(`/plugins/${plugin.id}`) },
  };
}

/** One plugin: what it is and adds, what it may use, and how to install it. */
export default async function PluginPage({ params }: Props) {
  const plugin = await getPlugin((await params).id);
  if (!plugin) notFound();
  const updated = plugin.updatedAt
    ? new Date(plugin.updatedAt).toLocaleDateString("en", { dateStyle: "long" })
    : null;

  return (
    <main className="flex flex-1 flex-col px-6 pt-28 pb-20 sm:pt-36">
      <article className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <Link
          href="/plugins"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" aria-hidden="true" />
          All plugins
        </Link>

        <header className="flex items-start gap-4">
          <span className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-muted">
            <PluginIcon icon={plugin.icon} className="size-7" />
          </span>
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="font-heading text-3xl font-semibold tracking-tight">{plugin.name}</h1>
            <p className="text-sm text-muted-foreground">
              by {plugin.author || "an unknown author"} · version {plugin.version}
              {updated ? ` · updated ${updated}` : ""}
            </p>
          </div>
        </header>

        <p className="text-lg text-pretty">{plugin.description}</p>

        {plugin.screenshots.length ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {plugin.screenshots.map((path) => (
              // eslint-disable-next-line @next/next/no-img-element -- pictures from the plugins repo
              <img key={path} src={rawUrl(path)} alt="" className="rounded-xl border" />
            ))}
          </div>
        ) : null}

        <div className="flex gap-3 rounded-2xl border border-warning/40 bg-warning/5 p-4 text-sm">
          <HugeiconsIcon icon={Alert02Icon} className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>
            <strong className="font-medium">A third-party plugin.</strong> better-vault didn&apos;t
            write it. It was reviewed before it was listed and runs in a sandbox, but once on it can
            read and change what you allow. Only install plugins you trust.
          </p>
        </div>

        <section className="grid gap-6 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <h2 className="text-sm font-medium text-muted-foreground">What it adds</h2>
            <ul className="flex flex-col gap-1 text-sm">
              {describeAdds(plugin.adds).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col gap-2">
            <h2 className="text-sm font-medium text-muted-foreground">What it asks for</h2>
            {plugin.permissions.length ? (
              <ul className="flex flex-col gap-1 text-sm">
                {plugin.permissions.map((permission) => (
                  <li key={permission}>{permissionLabels[permission] ?? permission}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm">Nothing: it only shows its own content.</p>
            )}
          </div>
        </section>

        <section className="flex flex-col gap-3 rounded-2xl border bg-card p-5">
          <h2 className="font-medium">Install it</h2>
          <p className="text-sm text-muted-foreground">
            Open better-vault, go to Settings, then Plugins, then Browse, and choose {plugin.name}.
            The app shows its permissions and a warning before it installs, and you can uninstall it
            at any time.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/download" className={buttonVariants()}>
              Get better-vault
            </Link>
            <a
              href={`${pluginsRepo}/tree/main/plugins/${plugin.id}`}
              className={buttonVariants({ variant: "outline" })}
            >
              <HugeiconsIcon icon={Github01Icon} aria-hidden="true" />
              Source on GitHub
            </a>
          </div>
        </section>
      </article>
    </main>
  );
}
