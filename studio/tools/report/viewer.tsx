"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { headingsOf, Markdown } from "@/components/chat/markdown";
import { countWords } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ToolViewerProps } from "@/studio/shared/form";
import type { ReportData } from "./definition";

/** Words a minute, for the reading time. */
const PACE = 220;

/**
 * The report as a document: a page with the text and its citations, and,
 * on wide screens, a numbered table of contents that follows the reading.
 */
export function ReportViewer({ data, onOpenPassage }: ToolViewerProps<ReportData>) {
  const { t } = useTranslation("studio");
  const sections = useMemo(() => headingsOf(data.markdown).filter((heading) => heading.level === 2), [data.markdown]);
  const minutes = Math.max(1, Math.round(countWords(data.markdown) / PACE));
  const [active, setActive] = useState<string | null>(null);

  // The section being read is the last one whose heading has passed the top third.
  useEffect(() => {
    const elements = sections.flatMap((section) => document.getElementById(section.id) ?? []);
    if (elements.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "0px 0px -66% 0px" },
    );
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [sections]);

  const current = active ?? sections[0]?.id;

  return (
    <div className="flex items-start gap-8 pb-10">
      <article className="min-w-0 flex-1 rounded-3xl bg-card px-6 py-8 text-card-foreground ring-1 ring-border sm:px-10 sm:py-10">
        <Markdown
          text={data.markdown}
          passages={data.passages}
          onCite={onOpenPassage}
          anchorHeadings
          className="markdown-document"
        />
      </article>
      {sections.length > 1 ? (
        <nav aria-label={t("report.viewer.contents")} className="sticky top-4 hidden w-64 shrink-0 lg:block">
          <p className="mb-2 px-3 text-xs font-medium text-muted-foreground">
            {t("report.viewer.contents")} · {t("report.viewer.readingTime", { count: minutes })}
          </p>
          <ol className="flex flex-col gap-0.5">
            {sections.map((section, at) => (
              <li key={section.id}>
                <button
                  type="button"
                  onClick={() => document.getElementById(section.id)?.scrollIntoView({ behavior: "smooth", block: "start" })}
                  aria-current={current === section.id ? "true" : undefined}
                  className={cn(
                    "flex w-full cursor-pointer gap-2 rounded-xl px-3 py-2 text-start text-sm leading-5 text-muted-foreground outline-none transition-colors",
                    "hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
                    current === section.id && "bg-muted font-medium text-foreground",
                  )}
                >
                  <span className="tabular-nums">{at + 1}.</span>
                  <span>{section.text}</span>
                </button>
              </li>
            ))}
          </ol>
        </nav>
      ) : null}
    </div>
  );
}
