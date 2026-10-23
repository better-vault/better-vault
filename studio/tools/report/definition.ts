import { z } from "zod";
import { defineTool } from "@/studio/types";

export const reportTemplates = ["briefing", "study-guide", "blog-post", "custom"] as const;

export const reportOptions = z.object({
  template: z.enum(reportTemplates),
  /** The user's own description, for the "custom" template. */
  instructions: z.string().max(4000),
});

const passageRef = z.object({
  n: z.number(),
  chunkId: z.string(),
  sourceId: z.string(),
  title: z.string(),
  kind: z.enum(["text", "markdown", "pdf", "url"]),
  snippet: z.string(),
});

export const reportData = z.object({
  markdown: z.string(),
  /** The passages the report may cite as [n]. */
  passages: z.array(passageRef),
});

export type ReportOptions = z.infer<typeof reportOptions>;
export type ReportData = z.infer<typeof reportData>;

export const reportTool = defineTool({
  id: "report",
  options: reportOptions,
  defaults: { template: "briefing", instructions: "" } satisfies ReportOptions,
  data: reportData,
  download: (title, data) => ({
    content: `# ${title}\n\n${data.markdown.replace(/\[(\d+(?:\s*[,–-]\s*\d+)*)\](?!\()/g, "")}`,
    extension: "md",
    type: "text/markdown",
  }),
});
