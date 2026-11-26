import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight01Icon,
  ArrowUpRight01Icon,
  Cancel01Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { buttonVariants } from "@/components/panelui/button";
import { Suspense } from "react";
import { Card } from "@/components/panelui/card";
import { Hero } from "@/components/site/hero";
import { IsoFigure } from "@/components/site/iso-figures";
import { LayoutLink } from "@/components/site/layout-link";
import { ModelHub } from "@/components/site/model-hub";
import { NotesGraph } from "@/components/site/notes-graph";
import { PluginIcon } from "@/components/site/plugins/plugin-icon";
import { ProductPreview } from "@/components/site/product-preview";
import { StudioStage } from "@/components/site/studio-stage/studio-stage";
import { absoluteUrl, site } from "@/lib/site/config";
import { lastModifiedByFile } from "@/lib/site/last-modified";
import { listPlugins } from "@/lib/site/plugins";
import { tools } from "@/lib/site/tools";
import {
  comparison,
  faq,
  features,
  notesFeatures,
  pluginKinds,
  roadmapTeaser,
  type Cell,
} from "@/lib/site/copy";

export const metadata: Metadata = {
  // The layout's template would add the brand a second time.
  title: { absolute: `${site.name}: ${site.titleTagline}` },
  alternates: { canonical: absoluteUrl("/") },
};

/** Structured data for search engines and AI assistants. No ratings: we have none. */
function jsonLd() {
  const modified = lastModifiedByFile(["app/(home)/page.tsx", "lib/site/copy.ts"]);
  const dateModified = [...modified.values()].sort((a, b) => b.getTime() - a.getTime())[0];
  const organization = {
    "@type": "Organization",
    "@id": absoluteUrl("/#organization"),
    name: site.name,
    url: site.url,
    logo: absoluteUrl("/icon.png"),
    sameAs: [site.repo],
  };
  return {
    "@context": "https://schema.org",
    "@graph": [
      organization,
      {
        "@type": "WebPage",
        "@id": absoluteUrl("/#webpage"),
        url: absoluteUrl("/"),
        name: `${site.name}: ${site.titleTagline}`,
        description: site.description,
        isPartOf: { "@id": absoluteUrl("/#website") },
        about: { "@id": absoluteUrl("/#app") },
        primaryImageOfPage: absoluteUrl("/screenshots/studio-light.webp"),
        ...(dateModified ? { dateModified: dateModified.toISOString() } : {}),
        inLanguage: "en",
      },
      {
        "@type": "WebSite",
        "@id": absoluteUrl("/#website"),
        name: site.name,
        url: site.url,
        description: site.description,
        publisher: { "@id": organization["@id"] },
        inLanguage: "en",
      },
      {
        "@type": "SoftwareApplication",
        "@id": absoluteUrl("/#app"),
        name: site.name,
        description: site.definition,
        url: site.url,
        downloadUrl: absoluteUrl("/download"),
        installUrl: absoluteUrl("/download"),
        applicationCategory: "EducationalApplication",
        applicationSubCategory: "AI research notebook",
        operatingSystem: "macOS, Windows, Linux",
        softwareRequirements:
          "macOS 12, Windows 10 or a 64-bit Linux for the desktop app; or Node.js 22.12 and a web browser",
        screenshot: {
          "@type": "ImageObject",
          url: absoluteUrl("/screenshots/studio-light.webp"),
          caption: "A slide deck made from a notebook's sources, in the Studio tab",
          width: 2880,
          height: 1800,
        },
        isAccessibleForFree: true,
        license: "https://opensource.org/licenses/MIT",
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        featureList: [
          "Chat with your sources with numbered citations",
          "Web mode using the provider's built-in search",
          "Reports, flashcards, quizzes, data tables and mind maps",
          "Slide decks, infographics, Anatomy figures and a whiteboard",
          "Audio Overviews with two hosts, spoken with ElevenLabs voices",
          "Obsidian-style notes with links, backlinks and a graph",
          "Bots that read your notebooks, notes and calendar",
          "Sandboxed plugins: Studio tools, mods and themes",
          "An MCP server for agents such as Claude Code in the desktop app",
          "Bring your own OpenAI, Anthropic, Google, OpenRouter, Kimi or DeepSeek API key",
          "Local models through Ollama and LM Studio",
          "Local-first storage in the browser or a SQLite file, no account",
        ],
        publisher: { "@id": organization["@id"] },
        sameAs: [site.repo],
      },
      {
        "@type": "SoftwareSourceCode",
        name: site.name,
        codeRepository: site.repo,
        programmingLanguage: "TypeScript",
        runtimePlatform: "Node.js",
        license: "https://opensource.org/licenses/MIT",
        targetProduct: { "@id": absoluteUrl("/#app") },
      },
      {
        "@type": "FAQPage",
        mainEntity: faq.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: { "@type": "Answer", text: item.answer },
        })),
      },
    ],
  };
}

function Section({
  id,
  title,
  intro,
  children,
}: {
  id: string;
  title: string;
  intro?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="min-w-0 border-t px-6 py-20" id={id} aria-labelledby={`${id}-title`}>
      <div className="mx-auto flex max-w-5xl flex-col gap-10">
        <div className="flex flex-col gap-2">
          <h2 id={`${id}-title`} className="font-heading text-3xl font-semibold tracking-tight">
            {title}
          </h2>
          {intro ? <p className="max-w-2xl text-muted-foreground">{intro}</p> : null}
        </div>
        {children}
      </div>
    </section>
  );
}

function Mark({ value }: { value: Cell }) {
  if (typeof value === "string") return <span className="text-sm">{value}</span>;
  return value ? (
    <span className="inline-flex items-center text-success">
      <HugeiconsIcon icon={Tick02Icon} className="size-4" aria-hidden="true" />
      <span className="sr-only">Yes</span>
    </span>
  ) : (
    <span className="inline-flex items-center text-muted-foreground">
      <HugeiconsIcon icon={Cancel01Icon} className="size-4" aria-hidden="true" />
      <span className="sr-only">No</span>
    </span>
  );
}

/** The footer's links: every main docs page, so readers and crawlers can reach them from here. */
const FOOTER: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Product",
    links: [
      { label: "Download", href: "/download" },
      { label: "Pricing", href: "/pricing" },
      { label: "Plugins", href: "/plugins" },
      { label: "Roadmap", href: "/docs/roadmap" },
      { label: "Changelog", href: `${site.repo}/blob/main/CHANGELOG.md` },
    ],
  },
  {
    title: "Guides",
    links: [
      { label: "Quickstart", href: "/docs/quickstart" },
      { label: "Sources", href: "/docs/sources" },
      { label: "Chat", href: "/docs/chat" },
      { label: "Studio", href: "/docs/studio" },
      { label: "Notes", href: "/docs/notes" },
      { label: "Bots", href: "/docs/bots" },
    ],
  },
  {
    title: "Setup",
    links: [
      { label: "AI providers", href: "/docs/providers" },
      { label: "Storage", href: "/docs/storage" },
      { label: "Desktop app", href: "/docs/desktop" },
      { label: "MCP for agents", href: "/docs/mcp" },
      { label: "Self-hosting", href: "/docs/self-hosting" },
      { label: "Subscription", href: "/docs/subscription" },
    ],
  },
  {
    title: "About",
    links: [
      { label: "vs NotebookLM", href: "/docs/comparison" },
      { label: "FAQ", href: "/docs/faq" },
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
      { label: "GitHub", href: site.repo },
      { label: "llms.txt", href: "/llms.txt" },
    ],
  },
];

/** A few plugins from the gallery, most starred first. */
async function FeaturedPlugins() {
  const plugins = [...(await listPlugins())].sort((a, b) => b.stars - a.stars).slice(0, 4);
  return <PluginList plugins={plugins} />;
}

function PluginList({ plugins }: { plugins: Awaited<ReturnType<typeof listPlugins>> }) {
  if (!plugins.length) {
    return (
      <p className="self-center text-sm text-muted-foreground">
        The gallery lists plugins reviewed by the project.{" "}
        <Link href="/plugins" className="underline underline-offset-4">
          See them all
        </Link>
        .
      </p>
    );
  }
  return (
    <ul className="flex flex-col divide-y rounded-xl border bg-card">
      {plugins.map((plugin) => (
        <li key={plugin.id} className="relative flex items-start gap-3 px-4 py-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
            <PluginIcon icon={plugin.icon} className="size-4.5" />
          </span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <Link
              href={`/plugins/${plugin.id}`}
              className="font-medium after:absolute after:inset-0 hover:underline"
            >
              {plugin.name}
            </Link>
            <p className="line-clamp-2 text-sm text-muted-foreground">{plugin.description}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd()) }}
      />

      <Hero />

      <ProductPreview />

      {/* The definition, stated plainly near the top for readers and answer engines. */}
      <Section id="what" title="What is better-vault?" intro={site.definition}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ figure, title, body, href }) => (
            <Card key={title} className="relative">
              <div className="border-b px-5 pt-4 pb-3">
                <IsoFigure kind={figure} />
              </div>
              <Card.Header>
                <Card.Title>
                  {/* The whole card is the link, through the stretched ::after. */}
                  <LayoutLink href={href} className="after:absolute after:inset-0 hover:underline">
                    {title}
                  </LayoutLink>
                </Card.Title>
                <Card.Description>{body}</Card.Description>
              </Card.Header>
            </Card>
          ))}
        </div>
      </Section>

      <Section
        id="studio"
        title="Nine ways to learn from your sources"
        intro="Every Studio output is made from the sources you select, cites them where it can, and leaves with you as a file. A short tour plays when you get here; click anything to take over."
      >
        <StudioStage />
        <nav aria-label="Studio tools" className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-sm">
          {tools.map((tool) => (
            <LayoutLink
              key={tool.id}
              href={`/docs/studio/${tool.id}`}
              className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              {tool.name}
            </LayoutLink>
          ))}
          <LayoutLink
            href="/docs/studio/audio-overview"
            className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Audio Overview
          </LayoutLink>
        </nav>
      </Section>

      <Section
        id="notes"
        title="Notes that connect everything"
        intro="Write notes beside your sources, link them with [[double brackets]], and watch ideas connect across notebooks and vaults. Your notes live right next to your research."
      >
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <div className="rounded-3xl border bg-card p-4">
            <NotesGraph />
          </div>
          <ul className="flex flex-col gap-5">
            {notesFeatures.map((item) => (
              <li key={item.title} className="flex flex-col gap-1">
                <h3 className="font-medium">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.body}</p>
              </li>
            ))}
          </ul>
        </div>
        <LayoutLink
          href="/docs/notes"
          className="inline-flex items-center gap-1 self-start text-sm font-medium underline-offset-4 hover:underline"
        >
          Read about notes
          <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" aria-hidden="true" />
        </LayoutLink>
      </Section>

      <Section
        id="plugins"
        title="Make it yours with plugins"
        intro="Plugins add Studio tools, mods and themes. Each one runs in a sandbox, uses only what you allow, and arrives turned off. Install one from the gallery, or ask an agent to build one for you."
      >
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <ul className="flex flex-col gap-5">
            {pluginKinds.map((kind) => (
              <li key={kind.title} className="flex flex-col gap-1">
                <h3 className="font-medium">
                  <LayoutLink href={kind.href} className="underline-offset-4 hover:underline">
                    {kind.title}
                  </LayoutLink>
                </h3>
                <p className="text-sm text-muted-foreground">{kind.body}</p>
              </li>
            ))}
            <li className="flex flex-col gap-1">
              <h3 className="font-medium">
                <LayoutLink href="/docs/creator-mode" className="underline-offset-4 hover:underline">
                  Built by your agent
                </LayoutLink>
              </h3>
              <p className="text-sm text-muted-foreground">
                In Creator mode, Claude Code, Cursor or Codex builds a plugin over MCP and installs it
                for you to review.
              </p>
            </li>
          </ul>
          <Suspense fallback={<PluginList plugins={[]} />}>
            <FeaturedPlugins />
          </Suspense>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/plugins" className={buttonVariants({ variant: "outline" })}>
            Browse plugins
          </Link>
          <LayoutLink
            href="/docs/plugins/build-your-first-plugin"
            className="inline-flex items-center gap-1 self-center text-sm font-medium underline-offset-4 hover:underline"
          >
            Build your first plugin
            <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" aria-hidden="true" />
          </LayoutLink>
        </div>
      </Section>

      <Section
        id="providers"
        title="Works with the model you choose"
        intro="Bring an API key, or run a model on your own computer. Switch provider and model for each question."
      >
        <ModelHub />
        <LayoutLink
          href="/docs/providers"
          className="inline-flex items-center gap-1 self-center text-sm font-medium underline-offset-4 hover:underline"
        >
          Set up a provider
          <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" aria-hidden="true" />
        </LayoutLink>
      </Section>

      <Section
        id="compare"
        title="better-vault vs NotebookLM"
        intro="Google's NotebookLM, now called Gemini Notebook, runs only on Gemini and keeps your notebooks on Google's servers. better-vault is open source and runs on your terms."
      >
        <div className="relative overflow-x-auto rounded-xl border">
          <table className="w-full min-w-lg text-start text-sm">
            <caption className="sr-only">better-vault compared with NotebookLM</caption>
            <thead className="bg-muted/60">
              <tr>
                <th scope="col" className="p-3 text-start font-medium">
                  Feature
                </th>
                <th scope="col" className="p-3 text-start font-medium">
                  better-vault
                </th>
                <th scope="col" className="p-3 text-start font-medium">
                  NotebookLM
                </th>
              </tr>
            </thead>
            <tbody>
              {comparison.map((row) => (
                <tr key={row.label} className="border-t">
                  <th scope="row" className="p-3 text-start font-normal text-muted-foreground">
                    {row.label}
                  </th>
                  <td className="p-3">
                    <Mark value={row.vault} />
                  </td>
                  <td className="p-3">
                    <Mark value={row.notebooklm} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Link
          href="/docs/comparison"
          className="inline-flex items-center gap-1 self-start text-sm font-medium underline-offset-4 hover:underline"
        >
          Read the full comparison
          <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" aria-hidden="true" />
        </Link>
      </Section>

      <Section
        id="roadmap"
        title="What's next"
        intro="better-vault is young and moving fast. These are the next steps on the roadmap."
      >
        <div className="grid gap-4 md:grid-cols-3">
          {roadmapTeaser.map((item) => (
            <Card key={item.title} className="h-full">
              <Card.Header>
                <HugeiconsIcon
                  icon={item.icon}
                  className="mb-2 size-5 text-muted-foreground"
                  aria-hidden="true"
                />
                <Card.Title>{item.title}</Card.Title>
                <Card.Description>{item.body}</Card.Description>
              </Card.Header>
            </Card>
          ))}
        </div>
        <LayoutLink
          href="/docs/roadmap"
          className={buttonVariants({ variant: "outline", className: "self-start" })}
        >
          See the roadmap
        </LayoutLink>
      </Section>

      <Section id="faq" title="Questions">
        <div className="flex max-w-3xl flex-col divide-y rounded-xl border">
          {faq.map((item) => (
            <details key={item.question} className="group px-5 py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium [&::-webkit-details-marker]:hidden">
                <h3>{item.question}</h3>
                <span
                  aria-hidden="true"
                  className="text-muted-foreground transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="mt-3 text-muted-foreground">{item.answer}</p>
            </details>
          ))}
        </div>
      </Section>

      <section className="min-w-0 border-t px-6 py-20">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center">
          <h2 className="font-heading text-3xl font-semibold tracking-tight text-balance">
            Your sources, your model, your notebook.
          </h2>
          <p className="text-muted-foreground">Free and open source. Nothing to sign up for.</p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/download" className={buttonVariants({ size: "lg" })}>
              Get started
              <HugeiconsIcon icon={ArrowRight01Icon} aria-hidden="true" />
            </Link>
            <a
              href={site.repo}
              target="_blank"
              rel="noreferrer noopener"
              className={buttonVariants({ size: "lg", variant: "outline" })}
            >
              Star on GitHub
              <HugeiconsIcon icon={ArrowUpRight01Icon} aria-hidden="true" />
            </a>
          </div>
        </div>
      </section>

      <footer className="border-t px-6 py-12">
        <div className="mx-auto flex max-w-5xl flex-col gap-10 text-sm">
          <nav aria-label="Footer" className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            {FOOTER.map((group) => (
              <div key={group.title} className="flex flex-col gap-3">
                <p className="font-medium">{group.title}</p>
                <ul className="flex flex-col gap-2 text-muted-foreground">
                  {group.links.map((link) => (
                    <li key={link.href}>
                      {link.href.startsWith("http") || link.href.endsWith(".txt") ? (
                        <a href={link.href} className="hover:text-foreground">
                          {link.label}
                        </a>
                      ) : (
                        <LayoutLink href={link.href} className="hover:text-foreground">
                          {link.label}
                        </LayoutLink>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
          <p className="text-muted-foreground">MIT © 2026 the {site.name} contributors</p>
        </div>
      </footer>
    </main>
  );
}
