import { defineConfig, defineDocs, frontmatterSchema } from "fumadocs-mdx/config";
import { z } from "zod";

/** The documentation at /docs, written as MDX in content/docs. */
export const docs = defineDocs({
  dir: "content/docs",
  docs: {
    // `status` puts a small "New" mark beside a page in the sidebar.
    schema: frontmatterSchema.extend({
      status: z.string().optional(),
    }),
    // Plain Markdown of each page, for /llms-full.txt.
    postprocess: { includeProcessedMarkdown: true },
  },
});

export default defineConfig();
