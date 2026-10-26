"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { activeHeading, readingProgress, scrollToShow } from "./reading";

export interface ContentsItem {
  id: string;
  label: string;
  /** 0 for "##", 1 for "###". */
  depth: 0 | 1;
}

interface ReportContentsProps {
  items: readonly ContentsItem[];
  /** The element the document scrolls in. */
  containerRef?: RefObject<HTMLElement | null>;
  minutes: number;
  /** Pixels between the top of the scroller and a heading it scrolls to. */
  offset?: number;
}

/** The space kept between the panel and the edges of the scroller. */
const GAP = 32;

/**
 * The report's contents: how far you have read, then the headings, with the
 * one being read marked. The list scrolls inside the panel when it is long,
 * and keeps the current heading in view.
 */
export function ReportContents({ items, containerRef, minutes, offset = 32 }: ReportContentsProps) {
  const { t } = useTranslation("studio");
  const listRef = useRef<HTMLOListElement>(null);
  const [active, setActive] = useState(-1);
  const [progress, setProgress] = useState(0);
  const [maxHeight, setMaxHeight] = useState<number>();
  // "01", "02"… for each "##" heading.
  const chapters = useMemo(() => {
    let count = 0;
    return items.map((item) => (item.depth === 0 ? ++count : count));
  }, [items]);

  const topOf = useCallback((container: HTMLElement, id: string) => {
    const heading = document.getElementById(id);
    if (!heading) return Infinity;
    return (
      heading.getBoundingClientRect().top -
      container.getBoundingClientRect().top +
      container.scrollTop
    );
  }, []);

  // Follow the reading.
  useEffect(() => {
    const container = containerRef?.current;
    if (!container) return;
    let frame = 0;
    const read = () => {
      frame = 0;
      const { scrollTop, scrollHeight, clientHeight } = container;
      const tops = items.map((item) => topOf(container, item.id));
      // The reading line sits a third of the way down the view: a heading counts
      // as read once it rises above it.
      const line = scrollTop + Math.max(offset, clientHeight * 0.3);
      setActive(activeHeading(tops, line, scrollTop + clientHeight >= scrollHeight - 2));
      setProgress(readingProgress(scrollTop, scrollHeight, clientHeight));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };
    read();
    container.addEventListener("scroll", schedule, { passive: true });
    const observer = new ResizeObserver(() => {
      setMaxHeight(Math.max(200, container.clientHeight - GAP));
      schedule();
    });
    observer.observe(container);
    return () => {
      container.removeEventListener("scroll", schedule);
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [containerRef, items, offset, topOf]);

  // Keep the current heading in view inside the list, without moving the page.
  useEffect(() => {
    const list = listRef.current;
    const row = list?.children[active] as HTMLElement | undefined;
    if (!list || !row) return;
    const next = scrollToShow(row.offsetTop, row.offsetHeight, list.scrollTop, list.clientHeight);
    if (next !== list.scrollTop) list.scrollTo({ top: next, behavior: "smooth" });
  }, [active]);

  function go(index: number) {
    const container = containerRef?.current;
    if (!container) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    container.scrollTo({
      top: topOf(container, items[index].id) - offset,
      behavior: still ? "auto" : "smooth",
    });
    setActive(index);
  }

  return (
    <nav
      aria-label={t("report.viewer.contents")}
      className="flex flex-col overflow-hidden rounded-3xl bg-card p-2.5 ring-1 ring-border"
      style={{ maxHeight }}
    >
      <div className="px-3 pt-2 pb-3.5">
        <div className="flex items-baseline justify-between gap-3 text-xs">
          <span className="font-medium">{t("report.viewer.contents")}</span>
          <span className="text-muted-foreground tabular-nums">
            {t("report.viewer.progress", { percent: Math.round(progress * 100), count: minutes })}
          </span>
        </div>
        <div
          className="mt-2 h-1 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-label={t("report.viewer.progressLabel")}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
        >
          <div
            className="h-full rounded-full bg-foreground transition-[width] duration-150 motion-reduce:transition-none"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      </div>
      <ol
        ref={listRef}
        className="relative min-h-0 flex-1 [scrollbar-width:thin] overflow-y-auto overscroll-contain"
      >
        {items.map((item, index) => {
          const current = index === active;
          return (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                aria-current={current ? "location" : undefined}
                onClick={(event) => {
                  event.preventDefault();
                  go(index);
                }}
                className={cn(
                  "relative flex gap-3 rounded-xl py-2 pe-3 text-start leading-snug transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  item.depth === 0 ? "ps-3 text-sm" : "ps-11 text-[0.8125rem]",
                  current
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                )}
              >
                {current ? (
                  <span
                    aria-hidden
                    className="absolute inset-y-2 start-0 w-0.5 rounded-full bg-foreground"
                  />
                ) : null}
                {item.depth === 0 ? (
                  <span
                    aria-hidden
                    className="mt-px w-5 shrink-0 font-mono text-[0.6875rem] text-muted-foreground tabular-nums"
                  >
                    {String(chapters[index]).padStart(2, "0")}
                  </span>
                ) : null}
                <span className="min-w-0">{item.label}</span>
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
