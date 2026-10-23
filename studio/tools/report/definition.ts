import { z } from "zod";
import { stripCitations } from "@/lib/grounding/passages";
import { defineTool, textBlob } from "@/studio/types";

export const reportTemplates = ["briefing", "study-guide", "blog-post", "custom"] as const;
export const reportLengths = ["short", "standard", "long"] as const;

export const reportOptions = z.object({
  template: z.enum(reportTemplates),
  /** The user's own description, for the "custom" template or a suggested format. */
  instructions: z.string().max(4000),
  length: z.enum(reportLengths).default("standard"),
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
  defaults: { template: "briefing", instructions: "", length: "standard" } satisfies ReportOptions,
  data: reportData,
  exports: [
    {
      format: "docx",
      build: async (title, data) => {
        const { isRightToLeft, markdownToBlocks, wordDocument } = await import("@/studio/exports/docx");
        const rtl = isRightToLeft(data.markdown);
        return wordDocument({ title, rtl, children: markdownToBlocks(data.markdown, data.passages, rtl) });
      },
    },
    {
      format: "md",
      build: async (title, data) => textBlob(`# ${title}\n\n${stripCitations(data.markdown)}\n`, "text/markdown"),
    },
  ],
});
