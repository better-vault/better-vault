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
import { Card } from "@/components/panelui/card";
import { Hero } from "@/components/site/hero";
import { LayoutLink } from "@/components/site/layout-link";
import { ProductPreview } from "@/components/site/product-preview";
import { routes } from "@/lib/routes";
import { absoluteUrl, site } from "@/lib/site/config";
import {
  comparison,
  faq,
  features,
  providers,
  roadmapTeaser,
  toolBlurbs,
  type Cell,
} from "@/lib/site/copy";
import { studioToolIds, studioTools } from "@/studio/tools";

export const metadata: Metadata = {
  // The layout's template would add the brand a second time.
  title: { absolute: `${site.name}: ${site.titleTagline}` },
  alternates: { canonical: absoluteUrl("/") },
};

/** Structured data for search engines and AI assistants. No ratings: we have none. */
function jsonLd() {
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
        "@type": "WebSite",
        "@id": absoluteUrl("/#website"),
        name: site.name,
        url: site.url,
        description: site.description,
        publisher: { "@id": organization["@id"] },
        inLanguage: "en",
      },
      {
        "@type": ["SoftwareApplication", "WebApplication"],
        "@id": absoluteUrl("/#app"),
        name: site.name,
        description: site.definition,
        url: absoluteUrl(site.appPath),
        applicationCategory: "EducationalApplication",
        applicationSubCategory: "AI research notebook",
        operatingSystem: "Any (web browser)",
        browserRequirements: "Requires a modern browser with JavaScript and IndexedDB.",
        isAccessibleForFree: true,
        license: "https://opensource.org/licenses/MIT",
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        featureList: [
          "Chat with your sources with numbered citations",
          "Web mode using the provider's built-in search",
          "Reports, flashcards, quizzes, data tables and mind maps",
          "Slide decks, infographics, Anatomy figures and a whiteboard",
          "Bring your own OpenAI, Anthropic or Google API key",
          "Local models through Ollama and LM Studio",
          "Local-first storage in the browser, no account",
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
  wide = false,
}: {
  id: string;
  title: string;
  intro?: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <section className="min-w-0 border-t px-6 py-20" id={id} aria-labelledby={`${id}-title`}>
      <div className={`mx-auto flex flex-col gap-10 ${wide ? "max-w-6xl" : "max-w-5xl"}`}>
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
    <span className="inline-flex items-center gap-1.5 text-success">
      <HugeiconsIcon icon={Tick02Icon} className="size-4" aria-hidden="true" />
      <span className="sr-only">Yes</span>
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
      <HugeiconsIcon icon={Cancel01Icon} className="size-4" aria-hidden="true" />
      <span className="sr-only">No</span>
    </span>
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
      <Section
        id="what"
        title="What is better-vault?"
        intro={site.definition}
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <Card key={feature.title} className="h-full">
              <Card.Header>
                <span className="mb-2 inline-flex size-9 items-center justify-center rounded-lg border bg-muted">
                  <HugeiconsIcon icon={feature.icon} className="size-5" aria-hidden="true" />
                </span>
                <Card.Title>
                  <Link href={feature.href} className="hover:underline underline-offset-4">
                    {feature.title}
                  </Link>
                </Card.Title>
                <Card.Description>{feature.body}</Card.Description>
              </Card.Header>
            </Card>
          ))}
        </div>
      </Section>

      <Section
        id="studio"
        title="Nine ways to learn from your sources"
        intro="Open Create, pick a tool and choose its options. Every output is made from your selected sources and can be downloaded."
      >
        <ul className="grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {studioToolIds.map((id) => {
            const tool = studioTools[id];
            const blurb = toolBlurbs[id];
            return (
              <li key={id} className="bg-background">
                <Link
                  href={`/docs/studio/${id}`}
                  className="flex h-full items-start gap-3 p-5 transition-colors hover:bg-muted/60"
                >
                  <HugeiconsIcon
                    icon={tool.icon}
                    className={`mt-0.5 size-5 shrink-0 ${tool.tint}`}
                    aria-hidden="true"
                  />
                  <span className="flex flex-col gap-1">
                    <span className="font-medium">{blurb.name}</span>
                    <span className="text-sm text-muted-foreground">{blurb.body}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </Section>

      <Section
        id="providers"
        title="Works with the model you choose"
        intro="Bring an API key or run a model on your own computer. Switch provider and model for each question."
      >
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {providers.map((provider) => (
            <li key={provider.name} className="flex flex-col gap-1 rounded-xl border bg-card p-4">
              <span className="font-medium">{provider.name}</span>
              <span className="text-sm text-muted-foreground">{provider.note}</span>
            </li>
          ))}
        </ul>
        <LayoutLink
          href="/docs/providers"
          className="inline-flex items-center gap-1 self-start text-sm font-medium underline-offset-4 hover:underline"
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
            <Link href={routes.home} prefetch={false} className={buttonVariants({ size: "lg" })}>
              Open the app
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

      <footer className="border-t px-6 py-10">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>
            MIT © 2026 the {site.name} contributors
          </p>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2">
            <LayoutLink href="/docs" className="hover:text-foreground">
              Docs
            </LayoutLink>
            <LayoutLink href="/docs/roadmap" className="hover:text-foreground">
              Roadmap
            </LayoutLink>
            <LayoutLink href="/docs/faq" className="hover:text-foreground">
              FAQ
            </LayoutLink>
            <a href={`${site.repo}/blob/main/CHANGELOG.md`} className="hover:text-foreground">
              Changelog
            </a>
            <a href={site.repo} className="hover:text-foreground">
              GitHub
            </a>
            <a href="/llms.txt" className="hover:text-foreground">
              llms.txt
            </a>
          </nav>
        </div>
      </footer>
    </main>
  );
}
