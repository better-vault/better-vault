"use client";

import { ArrowUpRight01Icon } from "@hugeicons/core-free-icons";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/icon";
import { Sheet } from "@/components/panelui/sheet";
import { useSourceWithChunks } from "@/lib/db/sources";
import { countWords } from "@/lib/format";
import { cn } from "@/lib/utils";

interface SourceReaderProps {
  reading: { sourceId: string; passage?: string } | null;
  onClose: () => void;
}

/** Shows a source's text, scrolled to a cited passage when there is one. */
export function SourceReader({ reading, onClose }: SourceReaderProps) {
  const { t: tCommon } = useTranslation();
  return (
    <Sheet side="right" open={reading !== null} onOpenChange={(open) => (open ? null : onClose())}>
      <Sheet.Content
        closeLabel={tCommon("actions.close")}
        className="w-[min(36rem,calc(100vw-2*var(--sheet-gap)))]"
      >
        {reading ? <ReaderBody sourceId={reading.sourceId} passage={reading.passage} /> : null}
      </Sheet.Content>
    </Sheet>
  );
}

function ReaderBody({ sourceId, passage }: { sourceId: string; passage?: string }) {
  const { t, i18n } = useTranslation("sources");
  const read = useSourceWithChunks(sourceId);
  const source = read?.source;
  const chunks = read?.chunks;
  const highlighted = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (chunks && passage) highlighted.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [chunks, passage]);

  if (!source) return null;
  const words = countWords(source.text);

  return (
    <>
      <Sheet.Header
        title={source.title}
        description={`${t(`kinds.${source.kind}`)} · ${t("words", { count: words, formattedCount: words.toLocaleString(i18n.language) })}`}
      >
        {source.url ? (
          <a
            href={source.url}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-flex w-fit items-center gap-1 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            {t("openPage")}
            <Icon icon={ArrowUpRight01Icon} size={14} className="rtl:-scale-x-100" />
          </a>
        ) : null}
      </Sheet.Header>
      <Sheet.Body>
        <div className="flex flex-col gap-3 pb-6 text-[0.9375rem] leading-7">
          {chunks?.map((chunk) => {
            const active = chunk.id === passage;
            return (
              <p
                key={chunk.id}
                ref={active ? highlighted : undefined}
                className={cn(
                  "whitespace-pre-wrap rounded-xl transition-colors",
                  active && "-mx-3 bg-info/10 px-3 py-2 ring-1 ring-info/30",
                )}
              >
                {chunk.text}
              </p>
            );
          })}
        </div>
      </Sheet.Body>
    </>
  );
}
