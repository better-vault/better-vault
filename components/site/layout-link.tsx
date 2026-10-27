"use client";

import Link from "next/link";
import type { ComponentPropsWithRef } from "react";

/** Routes repeated by the site's navbar, menu and footer. */
const REPEATED = new Set(["/", "/docs", "/app"]);

type LayoutLinkProps = ComponentPropsWithRef<"a"> & { prefetch?: boolean | null };

/**
 * A link for the site's persistent chrome. Destinations that appear several
 * times on every page are not prefetched, so one page view doesn't fetch the
 * same route over and over. /app is a separate root layout and loads fully.
 */
export function LayoutLink({ href = "#", prefetch, ...props }: LayoutLinkProps) {
  return <Link href={href} prefetch={prefetch ?? (REPEATED.has(href) ? false : null)} {...props} />;
}
