import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
  MarkdownCopyButton,
  ViewOptionsPopover,
} from "fumadocs-ui/layouts/notebook/page";
import { getMDXComponents } from "@/mdx-components";
import { absoluteUrl, site } from "@/lib/site/config";
import { source } from "@/lib/source";

interface Crumb {
  name: string;
  url?: string;
}

/** The breadcrumb trail for JSON-LD; only ancestors that are real pages get a rung. */
function breadcrumbTrail(slug: string[], title: string): Crumb[] {
  if (slug.length === 0) return [];
  const trail: Crumb[] = [{ name: "Docs", url: absoluteUrl("/docs") }];
  for (let depth = 1; depth < slug.length; depth++) {
    const ancestor = source.getPage(slug.slice(0, depth));
    if (ancestor) trail.push({ name: ancestor.data.title, url: absoluteUrl(ancestor.url) });
  }
  trail.push({ name: title });
  return trail;
}

/** The line above the title on a page's social card. */
const SECTIONS: Record<string, string> = {
  studio: "Studio",
  contributing: "Contributing",
};

export default function Page({ params }: PageProps<"/docs/[[...slug]]">) {
  // Params are read inside Suspense (Cache Components). Every page is listed in
  // generateStaticParams, so the full page is still prerendered at build time.
  return (
    <Suspense fallback={null}>
      <DocsContent params={params} />
    </Suspense>
  );
}

async function DocsContent({ params }: Pick<PageProps<"/docs/[[...slug]]">, "params">) {
  const { slug } = await params;
  const page = source.getPage(slug);
  if (!page) notFound();

  const MDX = page.data.body;
  const url = absoluteUrl(page.url);
  // The page's raw Markdown, served by app/llms.mdx/[[...slug]].
  const markdownUrl = `/llms.mdx/${page.slugs.join("/")}`;
  const trail = breadcrumbTrail(slug ?? [], page.data.title);

  return (
    <DocsPage toc={page.data.toc} full={page.data.full}>
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <div className="flex flex-row flex-wrap items-center gap-2 border-b pb-4">
        <MarkdownCopyButton markdownUrl={markdownUrl} />
        <ViewOptionsPopover
          markdownUrl={markdownUrl}
          githubUrl={`${site.repo}/blob/main/content/docs/${page.path}`}
        />
      </div>
      <DocsBody>
        <MDX components={getMDXComponents()} />
      </DocsBody>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "TechArticle",
                headline: page.data.title,
                description: page.data.description,
                url,
                isPartOf: { "@type": "WebSite", name: site.name, url: site.url },
                about: { "@type": "SoftwareApplication", name: site.name, url: site.url },
                author: { "@type": "Organization", name: `${site.name} contributors`, url: site.repo },
                inLanguage: "en",
              },
              ...(trail.length > 1
                ? [
                    {
                      "@type": "BreadcrumbList",
                      itemListElement: trail.map((crumb, index) => ({
                        "@type": "ListItem",
                        position: index + 1,
                        name: crumb.name,
                        ...(crumb.url ? { item: crumb.url } : {}),
                      })),
                    },
                  ]
                : []),
            ],
          }),
        }}
      />
    </DocsPage>
  );
}

export function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata({
  params,
}: PageProps<"/docs/[[...slug]]">): Promise<Metadata> {
  const { slug } = await params;
  const page = source.getPage(slug);
  if (!page) notFound();

  const url = absoluteUrl(page.url);
  const title = page.data.title;
  const description = page.data.description ?? site.description;
  const eyebrow = (slug?.[0] && SECTIONS[slug[0]]) || `${site.name} docs`;
  const ogImage = absoluteUrl(
    `/og?title=${encodeURIComponent(title)}` +
      `&description=${encodeURIComponent(description)}` +
      `&eyebrow=${encodeURIComponent(eyebrow)}`,
  );
  const image = { url: ogImage, width: 1200, height: 630, alt: title, type: "image/png" };

  return {
    title,
    description,
    alternates: {
      canonical: url,
      types: { "text/markdown": absoluteUrl(`/llms.mdx/${page.slugs.join("/")}`) },
    },
    openGraph: {
      type: "article",
      url,
      title: `${title} · ${site.name}`,
      description,
      siteName: site.name,
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} · ${site.name}`,
      description,
      images: [image],
    },
  };
}
