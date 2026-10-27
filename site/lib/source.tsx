import { docs } from "collections/server";
import { loader } from "fumadocs-core/source";
import { statusBadgesPlugin } from "fumadocs-core/source/status-badges";

/** The marks a page's `status` frontmatter can show in the sidebar. */
const BADGES: Record<string, { label: string; className: string }> = {
  new: { label: "New", className: "bg-info" },
  planned: { label: "Planned", className: "bg-muted-foreground" },
};

/** The docs at /docs, read from content/docs. */
export const source = loader({
  baseUrl: "/docs",
  source: docs.toFumadocsSource(),
  plugins: [
    statusBadgesPlugin({
      renderBadge: (status) => {
        const badge = BADGES[status];
        if (!badge) return null;
        return (
          <span
            role="img"
            aria-label={badge.label}
            className={`ms-1.5 inline-block size-1.5 shrink-0 rounded-full align-middle ${badge.className}`}
          />
        );
      },
    }),
  ],
});
