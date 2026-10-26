"use client";

import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  CancelCircleIcon,
  CheckmarkCircle02Icon,
  RotateLeft01Icon,
  ShuffleIcon,
} from "@hugeicons/core-free-icons";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/icon";
import { Button } from "@/components/panelui/button";
import { cn } from "@/lib/utils";
import type { ToolViewerProps } from "@/studio/shared/form";
import type { FlashcardsData } from "./definition";

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

function shuffled(list: number[]): number[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Cards one at a time: flip to see the answer, then mark whether you knew it. */
export function FlashcardsViewer({ data }: ToolViewerProps<FlashcardsData>) {
  const { t } = useTranslation("studio");
  const [order, setOrder] = useState(() => range(data.cards.length));
  const [position, setPosition] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState<Set<number>>(new Set());
  const [missed, setMissed] = useState<Set<number>>(new Set());
  const finished = position >= order.length;
  const card = data.cards[order[position]];

  const go = useCallback(
    (to: number) => {
      setPosition(Math.max(0, Math.min(order.length, to)));
      setFlipped(false);
    },
    [order.length],
  );

  const mark = useCallback(
    (knewIt: boolean) => {
      const index = order[position];
      setKnown((set) => {
        const next = new Set(set);
        if (knewIt) next.add(index);
        else next.delete(index);
        return next;
      });
      setMissed((set) => {
        const next = new Set(set);
        if (knewIt) next.delete(index);
        else next.add(index);
        return next;
      });
      go(position + 1);
    },
    [order, position, go],
  );

  const restart = (cards: number[]) => {
    setOrder(cards);
    setKnown(new Set());
    setMissed(new Set());
    setPosition(0);
    setFlipped(false);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLElement &&
        event.target.closest("input, textarea, [contenteditable], [role=dialog]")
      )
        return;
      if (event.key === " ") {
        event.preventDefault();
        if (!finished) setFlipped((value) => !value);
      } else if (event.key === "ArrowRight") go(position + 1);
      else if (event.key === "ArrowLeft") go(position - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [finished, go, position]);

  if (finished) {
    const missedList = [...missed];
    return (
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 py-16 text-center">
        <p className="text-xl font-semibold">
          {t("flashcards.viewer.finished", { known: known.size, total: order.length })}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {missedList.length > 0 ? (
            <Button shape="pill" onClick={() => restart(missedList)}>
              {t("flashcards.viewer.practiceMissed", { count: missedList.length })}
            </Button>
          ) : null}
          <Button
            shape="pill"
            variant="secondary"
            onClick={() => restart(range(data.cards.length))}
          >
            <Icon icon={RotateLeft01Icon} size={16} />
            {t("flashcards.viewer.restart")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-5 pb-10">
      <div className="flex w-full items-center justify-between text-sm text-muted-foreground">
        <span className="tabular-nums">
          {t("flashcards.viewer.progress", { current: position + 1, total: order.length })}
        </span>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => restart(shuffled(range(data.cards.length)))}
          >
            <Icon icon={ShuffleIcon} size={16} />
            {t("flashcards.viewer.shuffle")}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => restart(range(data.cards.length))}>
            <Icon icon={RotateLeft01Icon} size={16} />
            {t("flashcards.viewer.restart")}
          </Button>
        </div>
      </div>

      <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-chart-4 transition-[width]"
          style={{ width: `${(position / order.length) * 100}%` }}
        />
      </div>

      <button
        type="button"
        onClick={() => setFlipped((value) => !value)}
        aria-label={flipped ? t("flashcards.viewer.flipBack") : t("flashcards.viewer.flip")}
        className="group w-full cursor-pointer outline-none [perspective:1600px]"
      >
        <div
          className={cn(
            "relative grid aspect-[16/10] w-full transition-transform duration-500 ease-[cubic-bezier(0.3,0.7,0.1,1)] transform-3d motion-reduce:transition-none",
            flipped && "rotate-y-180",
          )}
        >
          <div className="col-start-1 row-start-1 flex items-center justify-center rounded-3xl bg-card p-8 text-center text-xl leading-snug font-semibold text-card-foreground shadow-sm ring-1 ring-border backface-hidden group-focus-visible:ring-2 group-focus-visible:ring-ring sm:text-2xl">
            {card.front}
          </div>
          <div className="col-start-1 row-start-1 flex rotate-y-180 items-center justify-center rounded-3xl bg-muted p-8 text-center text-lg leading-relaxed backface-hidden">
            {card.back}
          </div>
        </div>
      </button>

      <div className="flex w-full items-center justify-between gap-2">
        <Button
          variant="outline"
          shape="pill"
          size="icon"
          aria-label={t("flashcards.viewer.previous")}
          disabled={position === 0}
          onClick={() => go(position - 1)}
        >
          <Icon icon={ArrowLeft01Icon} className="rtl:rotate-180" />
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" shape="pill" onClick={() => mark(false)}>
            <Icon icon={CancelCircleIcon} size={16} className="text-destructive" />
            {t("flashcards.viewer.missed")}
            <span className="text-muted-foreground tabular-nums">{missed.size}</span>
          </Button>
          <Button variant="outline" shape="pill" onClick={() => mark(true)}>
            <Icon icon={CheckmarkCircle02Icon} size={16} className="text-success" />
            {t("flashcards.viewer.knew")}
            <span className="text-muted-foreground tabular-nums">{known.size}</span>
          </Button>
        </div>
        <Button
          variant="outline"
          shape="pill"
          size="icon"
          aria-label={t("flashcards.viewer.next")}
          onClick={() => go(position + 1)}
        >
          <Icon icon={ArrowRight01Icon} className="rtl:rotate-180" />
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{t("flashcards.viewer.hint")}</p>
    </div>
  );
}
