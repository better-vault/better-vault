"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import type { SlideDeckData } from "./definition";
import { SlideView } from "./slide";

const subscribe = () => () => {};

/**
 * Every slide, one per printed page, in light colours: what "PDF (print)"
 * prints. It sits in <body>, hidden on screen; the print styles in
 * globals.css hide the rest of the page while it is printed.
 */
export function DeckPrintView({ title, data }: { title: string; data: SlideDeckData }) {
  // Only in the browser, after hydration: a portal needs document.body.
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  if (!mounted) return null;
  return createPortal(
    <div
      data-print-deck
      aria-hidden
      className="theme-light hidden bg-background text-foreground print:block"
    >
      {data.slides.map((slide, index) => (
        <section key={index} className="slide-page">
          <SlideView
            slide={slide}
            index={index}
            total={data.slides.length}
            deckTitle={title}
            format={data.format}
            passages={data.passages}
            mode="print"
          />
        </section>
      ))}
    </div>,
    document.body,
  );
}

/** Opens the browser's print dialog for the open deck; its title becomes the PDF's name. */
export function printDeck(title: string) {
  const previous = document.title;
  document.title = title;
  const restore = () => {
    document.title = previous;
    window.removeEventListener("afterprint", restore);
  };
  window.addEventListener("afterprint", restore);
  window.print();
}
