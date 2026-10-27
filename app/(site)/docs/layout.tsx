import { DocsLayout } from "fumadocs-ui/layouts/notebook";
import { source } from "@/lib/source";
import { baseOptions } from "../layout.config";

/**
 * The notebook layout: a real top navbar with the sidebar beneath it. Sidebar
 * links aren't prefetched, since every one of them is on screen at once.
 */
export default function Layout({ children }: LayoutProps<"/docs">) {
  return (
    <DocsLayout
      tree={source.pageTree}
      {...baseOptions}
      nav={{ ...baseOptions.nav, mode: "top" }}
      sidebar={{ collapsible: false, prefetch: false }}
      tabs={false}
    >
      {children}
    </DocsLayout>
  );
}
