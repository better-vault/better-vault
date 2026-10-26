"use client";

import { useMemo } from "react";
import { headingsOf, Markdown } from "@/components/chat/markdown";
import { countWords } from "@/lib/format";
import type { ToolViewerProps } from "@/studio/shared/form";
import { ReportContents, type ContentsItem } from "./contents";
import type { ReportData } from "./definition";

/** Words a minute, for the reading time. */
const PACE = 220;

/**
 * The report as a document: on wide screens, its contents on the start side
 * follow the reading; the page with the text and its citations fills the rest.
 */
export function ReportViewer({ data, onOpenPassage, scrollRef }: ToolViewerProps<ReportData>) {
  const items = useMemo<ContentsItem[]>(
    () =>
      headingsOf(data.markdown).map((heading) => ({
        id: heading.id,
        label: heading.text,
        depth: heading.level === 2 ? 0 : 1,
      })),
    [data.markdown],
  );
  const minutes = Math.max(1, Math.round(countWords(data.markdown) / PACE));

  return (
    <div className="flex items-start gap-8 pb-10">
      {items.length > 1 ? (
        <aside className="sticky top-4 hidden w-64 shrink-0 lg:block">
          <ReportContents items={items} containerRef={scrollRef} minutes={minutes} />
        </aside>
      ) : null}
      <article className="min-w-0 flex-1 rounded-3xl bg-card px-6 py-8 text-card-foreground ring-1 ring-border sm:px-10 sm:py-10">
        <Markdown
          text={data.markdown}
          passages={data.passages}
          onCite={onOpenPassage}
          anchorHeadings
          className="markdown-document"
        />
      </article>
    </div>
  );
}
