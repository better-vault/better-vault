"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { DissolveText } from "@/components/dithercn/dissolve-text";
import { DitherGlow } from "@/components/dithercn/dither-glow";
import { buttonVariants } from "@/components/panelui/button";
import { CopyCommand } from "@/components/site/copy-command";
import { usePrefersReducedMotion } from "@/lib/dither";
import { routes } from "@/lib/routes";

/** The glow on each side of the hero: the ink colour, a third of full strength. */
const GLOW = {
  intensity: 0.35,
  radius: 0.4,
  palette: ["transparent", "--dither-ink"],
} as const;

/** What the headline says your sources become, in turn. */
const WORDS = ["reports", "flashcards", "quizzes", "mind maps", "slide decks"];
const HOLD = 2400;
const EXIT = 520;

/** Holds a word, dissolves it out, swaps in the next; still under reduced motion. */
function useWordCycle() {
  const reduced = usePrefersReducedMotion();
  const [index, setIndex] = useState(0);
  const [show, setShow] = useState(true);

  useEffect(() => {
    if (reduced) return;
    const timer = setTimeout(
      () => {
        if (show) {
          setShow(false);
        } else {
          setIndex((value) => (value + 1) % WORDS.length);
          setShow(true);
        }
      },
      show ? HOLD : EXIT,
    );
    return () => clearTimeout(timer);
  }, [show, reduced]);

  return { word: reduced ? WORDS[0] : WORDS[index], index: reduced ? 0 : index, show: reduced || show };
}

export function Hero() {
  const { word, index, show } = useWordCycle();

  return (
    <section className="relative isolate flex flex-col items-center px-6 pt-36 pb-20 text-center sm:pt-48">
      {/* Light above the text, and on wide screens beside it, each box fading
          out before it reaches a word. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-32 [mask-image:linear-gradient(to_bottom,#000_55%,transparent)] sm:h-44"
      >
        <DitherGlow position="top" {...GLOW} className="absolute inset-0" />
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 start-0 -z-10 hidden w-[calc(50%-31rem)] [mask-image:linear-gradient(to_right,#000_55%,transparent)] xl:block"
      >
        <DitherGlow position="left" {...GLOW} className="absolute inset-0" />
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 end-0 -z-10 hidden w-[calc(50%-31rem)] [mask-image:linear-gradient(to_left,#000_55%,transparent)] xl:block"
      >
        <DitherGlow position="right" {...GLOW} className="absolute inset-0" />
      </div>

      <div className="flex w-full max-w-4xl flex-col items-center gap-6">
        <p className="rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground">
          Open source · MIT · No account
        </p>
        {/* Readers and crawlers get the whole sentence; the cycling word is
            drawn for the eye only. */}
        <h1 className="font-heading text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
          <span className="sr-only">
            The open-source NotebookLM alternative: turn your sources into reports, flashcards,
            quizzes, mind maps and slide decks
          </span>
          <span aria-hidden="true" className="block">
            <span className="text-muted-foreground">Turn your sources into</span>
            <br />
            <DissolveText
              key={index}
              show={show}
              trigger="mount"
              duration={440}
              stagger={22}
              direction="random"
              color="ink"
              accent="--foreground"
            >
              {word}
            </DissolveText>
          </span>
        </h1>

        <p className="max-w-2xl text-lg text-balance text-muted-foreground">
          The open-source NotebookLM alternative. Chat with your PDFs, notes and web pages with
          cited answers, using your own OpenAI, Claude or Gemini key, or local models. Your
          notebooks never leave your browser.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link href={routes.home} prefetch={false} className={buttonVariants({ size: "lg" })}>
            Open the app
            <HugeiconsIcon icon={ArrowRight01Icon} aria-hidden="true" />
          </Link>
          <Link href="/docs" className={buttonVariants({ size: "lg", variant: "outline" })}>
            Read the docs
          </Link>
        </div>

        <CopyCommand command="git clone https://github.com/better-vault/better-vault && cd better-vault && npm i && npm run dev" />
      </div>
    </section>
  );
}
