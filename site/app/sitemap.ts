import { listPlugins } from "@/lib/site/plugins";
import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site/config";
import { lastModifiedByFile } from "@/lib/site/last-modified";
import { source } from "@/lib/source";

/** The landing page and every docs page. Canonical URLs only; the app is not listed. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const home = "app/(home)/page.tsx";
  const download = "app/(home)/download/page.tsx";
  const privacy = "app/(home)/privacy/page.tsx";
  const terms = "app/(home)/terms/page.tsx";
  const pricing = "app/(home)/pricing/page.tsx";
  const dates = lastModifiedByFile(["content/docs", home, download, privacy, terms, pricing]);
  const entry = (url: string, file: string) => {
    const lastModified = dates.get(file);
    return lastModified ? { url: absoluteUrl(url), lastModified } : { url: absoluteUrl(url) };
  };

  return [
    entry("/", home),
    entry("/download", download),
    { url: absoluteUrl("/plugins") },
    ...(await listPlugins()).map((plugin) => ({
      url: absoluteUrl(`/plugins/${plugin.id}`),
      ...(plugin.updatedAt ? { lastModified: new Date(plugin.updatedAt) } : {}),
    })),
    entry("/pricing", pricing),
    entry("/privacy", privacy),
    entry("/terms", terms),
    ...source.getPages().map((page) => entry(page.url, `content/docs/${page.path}`)),
  ];
}
