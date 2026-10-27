"use client";

import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Cancel01Icon,
  Note01Icon,
  PlayIcon,
} from "@hugeicons/core-free-icons";
import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Markdown } from "@/components/chat/markdown";
import { Icon } from "@/components/icon";
import { Button } from "@/components/panelui/button";
import { cn } from "@/lib/utils";
import type { ToolViewerProps } from "@/studio/shared/form";
import type { SlideDeckData } from "./definition";
import { DeckPrintView } from "./print";
import { SlideView } from "./slide";

/**
 * A deck: thumbnails, the slide on a stage, its speaker notes, and a full
 * screen presentation. ← → move between slides, F presents, N shows notes.
 */
export function SlideDeckViewer({ title, data, onOpenPassage }: ToolViewerProps<SlideDeckData>) {
  const { t } = useTranslation("studio");
  const slides = data.slides;
  const [index, setIndex] = useState(0);
  const hasNotes = slides.some((slide) => slide.notes.trim());
  const [notesOpen, setNotesOpen] = useState(data.format === "presenter" && hasNotes);
  const [presenting, setPresenting] = useState(false);
  const stopPresenting = useCallback(() => setPresenting(false), []);
  const thumbs = useRef<HTMLOListElement>(null);
  const slide = slides[Math.min(index, slides.length - 1)];

  const go = useCallback(
    (to: number) => setIndex(Math.max(0, Math.min(slides.length - 1, to))),
    [slides.length],
  );

  // Keyboard, while the deck is open and nothing else has the focus for typing.
  useEffect(() => {
    if (presenting) return;
    const onKey = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLElement &&
        event.target.closest("input, textarea, [contenteditable], [role=dialog], [role=menu]")
      )
        return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const keys: Record<string, () => void> = {
        ArrowRight: () => go(index + 1),
        ArrowDown: () => go(index + 1),
        PageDown: () => go(index + 1),
        ArrowLeft: () => go(index - 1),
        ArrowUp: () => go(index - 1),
        PageUp: () => go(index - 1),
        Home: () => go(0),
        End: () => go(slides.length - 1),
        f: () => setPresenting(true),
        n: () => hasNotes && setNotesOpen((open) => !open),
      };
      const action = keys[event.key] ?? keys[event.key.toLowerCase()];
      if (!action) return;
      event.preventDefault();
      action();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, index, slides.length, hasNotes, presenting]);

  // Keep the current thumbnail in view.
  useEffect(() => {
    const item = thumbs.current?.children[index] as HTMLElement | undefined;
    item?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [index]);

  const common = {
    deckTitle: title,
    format: data.format,
    passages: data.passages,
    total: slides.length,
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
      {/* On wide screens the column is positioned absolutely, so a long deck
          scrolls inside it instead of stretching the page. */}
      <div className="relative order-2 shrink-0 lg:order-none lg:w-44">
        <ol
          ref={thumbs}
          aria-label={t("slide-deck.viewer.slides")}
          className="flex [scrollbar-width:thin] gap-2 overflow-x-auto p-1 lg:absolute lg:inset-0 lg:flex-col lg:overflow-x-hidden lg:overflow-y-auto"
        >
          {slides.map((item, at) => (
            <li key={at} className="w-36 shrink-0 lg:w-full">
              <button
                type="button"
                onClick={() => go(at)}
                aria-current={at === index ? "true" : undefined}
                aria-label={t("slide-deck.viewer.slideLabel", {
                  current: at + 1,
                  total: slides.length,
                  title: item.title,
                })}
                className={cn(
                  "block w-full cursor-pointer rounded-[0.7rem] p-0.5 transition-shadow outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  at === index ? "ring-2 ring-info" : "hover:ring-2 hover:ring-border",
                )}
              >
                <SlideView {...common} slide={item} index={at} mode="thumb" />
              </button>
            </li>
          ))}
        </ol>
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
        <div className="relative min-h-[14rem] flex-1">
          <div className="[container-type:size] absolute inset-0 grid place-items-center">
            <div
              className="w-[min(100cqw,calc(100cqh*16/9))]"
              aria-roledescription={t("slide-deck.viewer.slide")}
              aria-label={t("slide-deck.viewer.slideLabel", {
                current: index + 1,
                total: slides.length,
                title: slide.title,
              })}
            >
              <SlideView
                {...common}
                slide={slide}
                index={index}
                mode="stage"
                onCite={onOpenPassage}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("slide-deck.viewer.previous")}
            disabled={index === 0}
            onClick={() => go(index - 1)}
          >
            <Icon icon={ArrowLeft01Icon} size={16} className="rtl:rotate-180" />
          </Button>
          <span className="min-w-14 text-center font-mono text-xs text-muted-foreground tabular-nums">
            {index + 1} / {slides.length}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("slide-deck.viewer.next")}
            disabled={index >= slides.length - 1}
            onClick={() => go(index + 1)}
          >
            <Icon icon={ArrowRight01Icon} size={16} className="rtl:rotate-180" />
          </Button>
          <span className="hidden truncate text-xs text-muted-foreground sm:inline">
            {t("slide-deck.viewer.keys")}
          </span>
          <div className="ms-auto flex items-center gap-2">
            {hasNotes ? (
              <Button
                variant={notesOpen ? "secondary" : "ghost"}
                size="sm"
                aria-pressed={notesOpen}
                onClick={() => setNotesOpen((open) => !open)}
              >
                <Icon icon={Note01Icon} size={16} />
                {t("slide-deck.viewer.notes")}
              </Button>
            ) : null}
            <Button size="sm" shape="pill" onClick={() => setPresenting(true)}>
              <Icon icon={PlayIcon} size={16} />
              {t("slide-deck.viewer.present")}
            </Button>
          </div>
        </div>

        {notesOpen ? (
          <section
            aria-label={t("slide-deck.viewer.notes")}
            className="max-h-48 shrink-0 overflow-y-auto rounded-2xl bg-muted/60 px-4 py-3 text-sm"
          >
            {slide.notes.trim() ? (
              <Markdown text={slide.notes} passages={data.passages} onCite={onOpenPassage} />
            ) : (
              <p className="text-muted-foreground">{t("slide-deck.viewer.noNotes")}</p>
            )}
          </section>
        ) : null}
      </div>

      {presenting ? (
        <Presenter {...common} slides={slides} index={index} onIndex={go} onExit={stopPresenting} />
      ) : null}
      <DeckPrintView title={title} data={data} />
    </div>
  );
}

/**
 * Full screen: click, Space or → for the next slide, ← to go back, N shows
 * the notes, Esc leaves. The arrows at the bottom do the same.
 */
function Presenter({
  slides,
  index,
  onIndex,
  onExit,
  ...common
}: {
  slides: SlideDeckData["slides"];
  index: number;
  onIndex: (index: number) => void;
  onExit: () => void;
  deckTitle: string;
  format: SlideDeckData["format"];
  passages: SlideDeckData["passages"];
  total: number;
}) {
  const { t } = useTranslation("studio");
  const stage = useRef<HTMLDivElement>(null);
  const [notes, setNotes] = useState(false);
  const slide = slides[index];
  const exit = useEffectEvent(onExit);

  // Once, when presenting starts: changing slides must not leave full screen.
  useEffect(() => {
    const element = stage.current;
    element?.focus();
    // Full screen where the browser allows it; the overlay works without it too.
    if (element?.requestFullscreen && !document.fullscreenElement)
      element.requestFullscreen().catch(() => {});
    const onChange = () => {
      if (!document.fullscreenElement) exit();
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    };
  }, []);

  // Keys on the whole page, so they work wherever the focus went.
  const onKey = useEffectEvent((event: KeyboardEvent) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const onButton = event.target instanceof HTMLElement && event.target.closest("button");
    if (onButton && (event.key === " " || event.key === "Enter")) return;
    const next = ["ArrowRight", "ArrowDown", "PageDown", " ", "Enter"];
    const back = ["ArrowLeft", "ArrowUp", "PageUp", "Backspace"];
    if (next.includes(event.key)) onIndex(index + 1);
    else if (back.includes(event.key)) onIndex(index - 1);
    else if (event.key === "Home") onIndex(0);
    else if (event.key === "End") onIndex(slides.length - 1);
    else if (event.key.toLowerCase() === "n") setNotes((open) => !open);
    else if (event.key === "Escape") onExit();
    else return;
    event.preventDefault();
  });
  useEffect(() => {
    const listener = (event: KeyboardEvent) => onKey(event);
    document.addEventListener("keydown", listener);
    return () => document.removeEventListener("keydown", listener);
  }, []);

  const control =
    "text-foreground opacity-50 hover:opacity-100 focus-visible:opacity-100 disabled:opacity-20";

  return createPortal(
    <div
      ref={stage}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={t("slide-deck.viewer.presenting")}
      onClick={(event) => {
        if ((event.target as HTMLElement).closest("button, a")) return;
        onIndex(index + 1);
      }}
      className="fixed inset-0 z-50 grid cursor-pointer place-items-center bg-background outline-none"
    >
      <div className="w-[min(100vw,calc(100dvh*16/9))]">
        <SlideView {...common} slide={slide} index={index} mode="present" />
      </div>
      {notes && slide.notes.trim() ? (
        <div className="absolute inset-x-4 bottom-16 max-h-[35dvh] overflow-y-auto rounded-2xl bg-popover/95 px-5 py-4 text-base text-popover-foreground shadow-lg ring-1 ring-border">
          <Markdown text={slide.notes} passages={common.passages} />
        </div>
      ) : null}
      <div className="absolute inset-x-0 bottom-4 mx-auto flex w-fit items-center gap-1 rounded-full bg-background/80 p-1 backdrop-blur">
        <Button
          variant="ghost"
          size="icon-sm"
          shape="pill"
          aria-label={t("slide-deck.viewer.previous")}
          disabled={index === 0}
          className={control}
          onClick={() => onIndex(index - 1)}
        >
          <Icon icon={ArrowLeft01Icon} size={16} className="rtl:rotate-180" />
        </Button>
        <span className="min-w-14 text-center font-mono text-xs text-muted-foreground tabular-nums">
          {index + 1} / {slides.length}
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          shape="pill"
          aria-label={t("slide-deck.viewer.next")}
          disabled={index >= slides.length - 1}
          className={control}
          onClick={() => onIndex(index + 1)}
        >
          <Icon icon={ArrowRight01Icon} size={16} className="rtl:rotate-180" />
        </Button>
        {slides.some((item) => item.notes.trim()) ? (
          <Button
            variant="ghost"
            size="icon-sm"
            shape="pill"
            aria-label={t("slide-deck.viewer.notes")}
            aria-pressed={notes}
            className={cn(control, notes && "opacity-100")}
            onClick={() => setNotes((open) => !open)}
          >
            <Icon icon={Note01Icon} size={16} />
          </Button>
        ) : null}
      </div>
      <Button
        variant="secondary"
        size="icon-sm"
        shape="pill"
        aria-label={t("slide-deck.viewer.exit")}
        className="absolute end-4 top-4 opacity-40 hover:opacity-100 focus-visible:opacity-100"
        onClick={onExit}
      >
        <Icon icon={Cancel01Icon} size={16} />
      </Button>
    </div>,
    document.body,
  );
}
