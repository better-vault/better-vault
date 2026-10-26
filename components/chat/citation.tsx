"use client";

import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/icon";
import { Button } from "@/components/panelui/button";
import { sourceKindIcons } from "@/components/sources/source-kind";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import type { PassageRef } from "@/lib/chat/types";
import { cleanText } from "@/lib/grounding/clean";
import { cn } from "@/lib/utils";

interface CitationProps {
  /** The first passage cited; its source is the one shown. */
  passage: PassageRef;
  /** Every passage number in this mark, e.g. [2][5] from one source. */
  numbers: readonly number[];
  onOpen?: (passage: PassageRef) => void;
  className?: string;
}

/**
 * A citation in the text: a small raised number, like a footnote mark.
 * Pointing at it or focusing it previews the passage; choosing it opens the
 * source at that passage.
 */
export function Citation({ passage, numbers, onOpen, className }: CitationProps) {
  const { t } = useTranslation();
  const { t: tSources } = useTranslation("sources");
  const label = t("citation.label", { numbers: numbers.join(", "), title: passage.title });

  return (
    <HoverCard>
      <HoverCardTrigger
        delay={250}
        closeDelay={120}
        render={
          <button
            type="button"
            aria-label={label}
            onClick={() => onOpen?.(passage)}
            className={cn(
              "relative -top-[0.45em] mx-px inline-flex h-[1.35em] min-w-[1.35em] cursor-pointer items-center justify-center rounded-[0.4em] px-[0.35em] align-baseline",
              "bg-muted font-mono text-[0.68em] leading-none font-medium text-muted-foreground tabular-nums",
              "transition-colors outline-none hover:bg-info hover:text-info-foreground focus-visible:bg-info focus-visible:text-info-foreground",
              "data-[popup-open]:bg-info data-[popup-open]:text-info-foreground",
              className,
            )}
          />
        }
      >
        {numbers.join("·")}
      </HoverCardTrigger>
      <HoverCardContent side="top" sideOffset={6} className="w-72 rounded-2xl p-3">
        <div className="flex items-start gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <Icon icon={sourceKindIcons[passage.kind]} size={16} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{passage.title}</p>
            <p className="text-xs text-muted-foreground">
              {tSources(`kinds.${passage.kind}`)} ·{" "}
              {t("citation.passage", { numbers: numbers.join(", ") })}
            </p>
          </div>
        </div>
        {passage.snippet ? (
          <p className="mt-2.5 line-clamp-4 border-s-2 border-border ps-2.5 text-xs leading-relaxed text-muted-foreground">
            {cleanText(passage.snippet)}
          </p>
        ) : null}
        {onOpen ? (
          <Button
            variant="secondary"
            size="sm"
            className="mt-3 w-full"
            onClick={() => onOpen(passage)}
          >
            {t("citation.open")}
            <Icon icon={ArrowRight01Icon} size={14} className="rtl:rotate-180" />
          </Button>
        ) : null}
      </HoverCardContent>
    </HoverCard>
  );
}
