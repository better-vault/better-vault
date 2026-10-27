import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { RootProvider } from "fumadocs-ui/provider/next";
import { LayoutLink } from "@/components/site/layout-link";
import { absoluteUrl, site } from "@/lib/site/config";
import "../site.css";

// The same variable names as the app's layout, which tokens.css reads.
const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  // Child pages give only their own title; the template adds the brand once.
  title: {
    default: `${site.name}: ${site.titleTagline}`,
    template: `%s · ${site.name}`,
  },
  description: site.description,
  applicationName: site.name,
  keywords: [...site.keywords],
  authors: [{ name: site.author, url: site.repo }],
  creator: site.author,
  alternates: { canonical: absoluteUrl("/") },
  openGraph: {
    type: "website",
    siteName: site.name,
    url: absoluteUrl("/"),
    title: `${site.name}: ${site.tagline}`,
    description: site.description,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: `${site.name}: ${site.tagline}`,
    description: site.description,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
  category: "technology",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

/** The root layout of the website: landing page and docs. */
export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} antialiased`}
    >
      {/* `isolate` keeps portals layered against this root. */}
      <body className="isolate flex min-h-screen flex-col font-sans">
        <RootProvider components={{ Link: LayoutLink }}>{children}</RootProvider>
      </body>
    </html>
  );
}
