"use client";

import { Fragment, type ReactNode } from "react";
import { Citation } from "@/components/chat/citation";
import type { PassageRef } from "@/lib/chat/types";
import { splitCitations } from "@/lib/grounding/passages";
import { isRightToLeft } from "@/lib/text/direction";
import { cn } from "@/lib/utils";
import type { Slide, SlideFormat } from "./definition";

export type SlideMode = "stage" | "thumb" | "present" | "print";

interface SlideViewProps {
  slide: Slide;
  index: number;
  total: number;
  deckTitle: string;
  format: SlideFormat;
  passages: readonly PassageRef[];
  mode: SlideMode;
  onCite?: (passage: PassageRef) => void;
}

/** Colours for stat cards and timeline marks, in order. */
const ACCENTS = ["text-chart-2", "text-chart-3", "text-chart-4", "text-chart-5"] as const;
const DOTS = ["bg-chart-2", "bg-chart-3", "bg-chart-4", "bg-chart-5"] as const;

/**
 * One slide, laid out for its layout. Every size is a share of the slide's
 * width (container query units), so the same slide is sharp as a thumbnail,
 * on the stage, full screen and printed.
 */
export function SlideView({
  slide,
  index,
  total,
  deckTitle,
  format,
  passages,
  mode,
  onCite,
}: SlideViewProps) {
  const byN = new Map(passages.map((passage) => [passage.n, passage]));
  const cited = mode === "stage" || mode === "present";
  const all = [slide.title, slide.subtitle, ...slide.bullets, slide.quote?.text ?? ""].join(" ");
  const rtl = isRightToLeft(all);
  const inverted = slide.layout === "title" || slide.layout === "closing";

  /** Text with its citations as marks, or without them where they can't be used. */
  const cite = (text: string): ReactNode =>
    splitCitations(text).map((part, at) => {
      if ("text" in part) return <Fragment key={at}>{part.text}</Fragment>;
      if (!cited) return null;
      const passage = byN.get(part.cite[0]);
      return passage ? (
        <Citation key={at} passage={passage} numbers={part.cite} onOpen={onCite} />
      ) : null;
    });

  const body =
    format === "detailed" ? "text-[1.85cqw] leading-[1.45]" : "text-[2.5cqw] leading-[1.35]";

  return (
    <div
      dir={rtl ? "rtl" : "ltr"}
      className={cn(
        "@container relative aspect-video w-full overflow-hidden text-start select-none",
        mode !== "print" && "rounded-[1.6cqw] ring-1 ring-border",
        inverted
          ? "bg-primary text-primary-foreground"
          : slide.layout === "section"
            ? "bg-muted"
            : "bg-card text-card-foreground",
      )}
    >
      <div className="absolute inset-0 flex flex-col px-[6.5cqw] pt-[5.5cqw] pb-[6cqw]">
        {slide.layout === "title" ? (
          <div className="mt-auto">
            <span
              aria-hidden
              className="mb-[2.5cqw] block h-[0.5cqw] w-[8cqw] rounded-full bg-info"
            />
            <h2 className="text-[5cqw] leading-[1.08] font-semibold tracking-tight">
              {slide.title}
            </h2>
            {slide.subtitle ? (
              <p className="mt-[1.8cqw] max-w-[70cqw] text-[2.1cqw] text-primary-foreground/70">
                {slide.subtitle}
              </p>
            ) : null}
          </div>
        ) : slide.layout === "section" ? (
          <div className="my-auto">
            <p className="font-mono text-[1.6cqw] tracking-widest text-muted-foreground">
              {String(index + 1).padStart(2, "0")}
            </p>
            <h2 className="mt-[1cqw] text-[4.4cqw] leading-[1.1] font-semibold tracking-tight">
              {slide.title}
            </h2>
            {slide.subtitle ? (
              <p className="mt-[1.5cqw] text-[2cqw] text-muted-foreground">{slide.subtitle}</p>
            ) : null}
          </div>
        ) : (
          <>
            <h2
              className={cn(
                "shrink-0 font-semibold tracking-tight",
                slide.layout === "quote" ? "sr-only" : "mb-[2.8cqw] text-[3.4cqw] leading-[1.15]",
              )}
            >
              {slide.title}
            </h2>
            <div className="min-h-0 flex-1">
              {slide.layout === "bullets" || slide.layout === "closing" ? (
                <Bullets items={slide.bullets} cite={cite} className={body} inverted={inverted} />
              ) : slide.layout === "two-column" || slide.layout === "comparison" ? (
                <div className="grid h-full grid-cols-2 gap-[3cqw]">
                  {slide.columns.map((column, at) => (
                    <div
                      key={at}
                      className={cn(
                        slide.layout === "comparison" &&
                          "rounded-[1.4cqw] bg-muted px-[2.4cqw] py-[2.2cqw]",
                      )}
                    >
                      <h3
                        className={cn(
                          "mb-[1.4cqw] text-[2.2cqw] font-semibold",
                          slide.layout === "comparison" && ACCENTS[at],
                        )}
                      >
                        {column.heading}
                      </h3>
                      <Bullets
                        items={column.bullets}
                        cite={cite}
                        className={
                          format === "detailed"
                            ? "text-[1.7cqw] leading-[1.45]"
                            : "text-[2.2cqw] leading-[1.35]"
                        }
                      />
                    </div>
                  ))}
                </div>
              ) : slide.layout === "stats" ? (
                <div
                  className={cn(
                    "grid h-full content-center gap-[2.4cqw]",
                    slide.stats.length === 4
                      ? "grid-cols-4"
                      : slide.stats.length === 3
                        ? "grid-cols-3"
                        : "grid-cols-2",
                  )}
                >
                  {slide.stats.map((stat, at) => (
                    <div key={at} className="rounded-[1.4cqw] bg-muted px-[2.2cqw] py-[2.4cqw]">
                      <p
                        className={cn(
                          "text-[5cqw] leading-none font-semibold tracking-tight tabular-nums",
                          ACCENTS[at % ACCENTS.length],
                        )}
                      >
                        {stat.value}
                      </p>
                      <p className="mt-[1.4cqw] text-[1.8cqw] leading-snug font-medium">
                        {cite(stat.label)}
                      </p>
                      {stat.detail ? (
                        <p className="mt-[0.8cqw] text-[1.35cqw] leading-snug text-muted-foreground">
                          {cite(stat.detail)}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : slide.layout === "quote" && slide.quote ? (
                <figure className="flex h-full flex-col justify-center">
                  <span aria-hidden className="font-serif text-[9cqw] leading-[0.6] text-info">
                    “
                  </span>
                  <blockquote className="mt-[1cqw] max-w-[78cqw] text-[3.1cqw] leading-[1.3] font-medium tracking-tight">
                    {cite(slide.quote.text)}
                  </blockquote>
                  {slide.quote.attribution ? (
                    <figcaption className="mt-[2cqw] text-[1.7cqw] text-muted-foreground">
                      — {slide.quote.attribution}
                    </figcaption>
                  ) : null}
                </figure>
              ) : slide.layout === "timeline" ? (
                <ol
                  className="relative grid h-full content-center gap-[2cqw]"
                  style={{
                    gridTemplateColumns: `repeat(${slide.timeline.length}, minmax(0, 1fr))`,
                  }}
                >
                  <span
                    aria-hidden
                    className="absolute inset-x-0 top-1/2 h-[0.2cqw] -translate-y-[3.5cqw] bg-border"
                  />
                  {slide.timeline.map((event, at) => (
                    <li key={at} className="relative">
                      <span
                        aria-hidden
                        className={cn(
                          "mb-[2cqw] block size-[1.6cqw] rounded-full ring-[0.5cqw] ring-card",
                          DOTS[at % DOTS.length],
                        )}
                      />
                      <p className="font-mono text-[1.35cqw] text-muted-foreground">{event.when}</p>
                      <p className="mt-[0.5cqw] text-[1.8cqw] leading-snug font-semibold">
                        {event.title}
                      </p>
                      {event.detail ? (
                        <p className="mt-[0.6cqw] text-[1.35cqw] leading-snug text-muted-foreground">
                          {cite(event.detail)}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ol>
              ) : null}
            </div>
          </>
        )}
      </div>
      <div
        className={cn(
          "absolute inset-x-[6.5cqw] bottom-[2.6cqw] flex items-center justify-between gap-[2cqw] text-[1.15cqw]",
          inverted ? "text-primary-foreground/55" : "text-muted-foreground",
        )}
      >
        <span className="truncate">{deckTitle}</span>
        <span className="shrink-0 font-mono tabular-nums">
          {index + 1} / {total}
        </span>
      </div>
    </div>
  );
}

function Bullets({
  items,
  cite,
  className,
  inverted = false,
}: {
  items: readonly string[];
  cite: (text: string) => ReactNode;
  className: string;
  inverted?: boolean;
}) {
  return (
    <ul className={cn("flex flex-col gap-[1.1cqw]", className)}>
      {items.map((item, at) => (
        <li key={at} className="flex gap-[1.4cqw]">
          <span
            aria-hidden
            className={cn(
              "mt-[0.55em] size-[0.8cqw] shrink-0 rounded-[0.2cqw]",
              inverted ? "bg-primary-foreground/60" : "bg-info",
            )}
          />
          <span className="min-w-0">{cite(item)}</span>
        </li>
      ))}
    </ul>
  );
}
