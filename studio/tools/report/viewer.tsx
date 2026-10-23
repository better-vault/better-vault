"use client";

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { headingsOf, Markdown } from "@/components/chat/markdown";
import RailToc, { type RailTocItem } from "@/components/ui/rail-toc";
import { countWords } from "@/lib/format";
import type { ToolViewerProps } from "@/studio/shared/form";
import type { ReportData } from "./definition";

/** Words a minute, for the reading time. */
const PACE = 220;

/**
 * The report as a document: on wide screens, Rare UI's rail of contents on
 * the left follows the reading; the page with the text and its citations
 * fills the rest.
 */
export function ReportViewer({ data, onOpenPassage, scrollRef }: ToolViewerProps<ReportData>) {
  const { t } = useTranslation("studio");
  const items = useMemo<RailTocItem[]>(
    () =>
      headingsOf(data.markdown).map((heading) => ({
        id: heading.id,
        label: heading.text,
        depth: heading.level - 2,
      })),
    [data.markdown],
  );
  const minutes = Math.max(1, Math.round(countWords(data.markdown) / PACE));

  return (
    <div className="flex items-start gap-8 pb-10">
      {items.length > 1 ? (
        <aside className="sticky top-4 hidden w-60 shrink-0 lg:block">
          <RailToc
            items={items}
            containerRef={scrollRef}
            offset={32}
            title={t("report.viewer.contents")}
            className="w-full"
          />
          <p className="mt-4 ps-1 text-xs text-muted-foreground">{t("report.viewer.readingTime", { count: minutes })}</p>
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
