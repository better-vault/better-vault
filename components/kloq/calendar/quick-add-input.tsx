"use client";

/**
 * quick-add-input — type a sentence, get an event. Parsed phrases are underlined in place
 * via a mirrored, aria-hidden div under a transparent-text `<input>`.
 */

import { CalendarClock } from "@/components/kloq/lib/icons";
import type React from "react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { QuickAddResult } from "../lib/quick-add";
import { QUICK_ADD_KIND_ORDER, QUICK_ADD_KINDS } from "../lib/quick-add-kinds";
import { highlightSegments, type QuickAddSegment, quickAddPreview } from "../lib/quick-add-view";
import { cn } from "../lib/utils";
import { Badge } from "../ui/badge";
import { CommandFooter } from "../ui/command";
import { KbdKeys } from "./kbd-keys";

/** The ⌘K field row: the same box and type as `CommandInput`, ringed only outside the palette. */
export const COMMAND_FIELD_ROW =
  "mx-2.5 my-1.5 rounded-lg ring-ring transition-shadow not-in-data-[slot=command-dialog-popup]:has-[input:focus-visible]:ring-2";
export const COMMAND_FIELD =
  "h-9.5 px-[calc(--spacing(3)-1px)] font-sans text-base leading-9.5 tracking-normal sm:h-8.5 sm:text-sm sm:leading-8.5";

const SPEAK_AFTER_MS = 700;

/** `text` once typing has paused, so a live region reads the result and not every keystroke. */
export function useSpoken(text: string, enabled: boolean): string {
  const [spoken, setSpoken] = useState("");
  useEffect(() => {
    if (!enabled) return;
    const t = setTimeout(() => setSpoken(text), SPEAK_AFTER_MS);
    return () => clearTimeout(t);
  }, [text, enabled]);
  return enabled ? spoken : "";
}

interface QuickAddInputProps {
  value: string;
  onValueChange: (value: string) => void;
  /** Parse of `value` against the caller's clock. */
  result: QuickAddResult;
  /** Clock used for the preview line; the same `now` the parse used. */
  now: Date;
  /** Enter with a non-empty value. */
  onCommit: () => void;
  /** Escape on an already-empty value. */
  onBack?: () => void;
  autoFocus?: boolean;
  /** `false` keeps the preview out of the live region, for a demo that drives `value`. */
  announce?: boolean;
}

export function QuickAddInput({
  value,
  onValueChange,
  result,
  now,
  onCommit,
  onBack,
  autoFocus = true,
  announce = true,
}: QuickAddInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  const previewId = useId();

  const segments: QuickAddSegment[] = useMemo(
    () =>
      result.confidence === "none"
        ? [{ text: value, kind: null }]
        : highlightSegments(value, result.tokens, result.ignored),
    [value, result],
  );

  const preview = useMemo(() => quickAddPreview(result, now), [result, now]);
  const ready = value.trim().length > 0;
  const ignored = result.ignored.map((t) => t.text).join(", ");
  const spoken = useSpoken(
    ready
      ? [preview.title, preview.when, ...preview.chips, ignored && `ignored: ${ignored}`]
          .filter(Boolean)
          .join(", ")
      : "",
    announce,
  );

  useEffect(() => {
    const input = inputRef.current;
    const mirror = mirrorRef.current;
    if (!input || !mirror) return;
    mirror.scrollLeft = input.scrollLeft;
  }, [value]);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (ready) onCommit();
      return;
    }
    if (e.key === "Escape" && onBack) {
      // otherwise the surrounding dialog's Escape closes the whole menu
      e.preventDefault();
      e.stopPropagation();
      if (value) onValueChange("");
      else onBack();
    }
  };

  return (
    <div className="flex flex-col">
      <div className={cn(COMMAND_FIELD_ROW, "relative")}>
        <div
          aria-hidden
          ref={mirrorRef}
          className={cn(
            "pointer-events-none absolute inset-0 select-none overflow-hidden whitespace-pre text-transparent",
            COMMAND_FIELD,
          )}
        >
          {segments.map((s, i) =>
            s.ignored ? (
              // read, then overruled: struck through, in no kind's colour
              <span
                key={i}
                data-ignored
                className="rounded-xs bg-muted line-through decoration-muted-foreground decoration-2"
              >
                {s.text}
              </span>
            ) : s.kind ? (
              <span
                key={i}
                className={cn(
                  "rounded-xs underline decoration-2 underline-offset-4 motion-safe:transition-colors",
                  QUICK_ADD_KINDS[s.kind].mark,
                )}
              >
                {s.text}
              </span>
            ) : (
              <span key={i}>{s.text}</span>
            ),
          )}
        </div>
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          onScroll={() => {
            const mirror = mirrorRef.current;
            if (mirror && inputRef.current) mirror.scrollLeft = inputRef.current.scrollLeft;
          }}
          onKeyDown={onKeyDown}
          placeholder="lunch with sam@acme.com tomorrow 1pm at Padella"
          aria-label="Quick add an event"
          aria-describedby={previewId}
          autoComplete="off"
          spellCheck={false}
          className={cn(
            "relative w-full bg-transparent text-foreground caret-foreground outline-none placeholder:text-muted-foreground",
            COMMAND_FIELD,
          )}
        />
      </div>

      <div
        id={previewId}
        // a fixed height: the preview rewrites itself per keystroke and must not shift what follows
        className="flex h-17 flex-col gap-1 overflow-hidden border-t px-5 py-3"
      >
        {ready ? (
          <>
            <div className="flex items-baseline gap-2">
              <span className="min-w-0 flex-1 truncate font-medium text-sm text-foreground">
                {preview.title}
              </span>
              {ignored ? (
                <span className="min-w-0 shrink truncate text-2xs text-muted-foreground">
                  ignored: <s>{ignored}</s>
                </span>
              ) : preview.confidence !== "full" ? (
                <span className="shrink-0 text-2xs text-muted-foreground">
                  {preview.confidence === "none" ? "no date found" : "partial match"}
                </span>
              ) : null}
            </div>
            <div className="flex items-center gap-x-2 overflow-x-auto text-xs text-muted-foreground [scrollbar-width:none]">
              <span className="inline-flex shrink-0 items-center gap-1.5">
                <CalendarClock aria-hidden className="size-3.5" />
                {preview.when ?? "—"}
              </span>
              {preview.chips.map((chip) => (
                <Badge key={chip} variant="secondary" size="sm">
                  {chip}
                </Badge>
              ))}
            </div>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">
            Type a sentence — a date, a time, “for 45 minutes”, “at Padella”, or an email address
            all get picked up.
          </p>
        )}
      </div>
      <span className="sr-only" aria-live="polite">
        {spoken}
      </span>

      <CommandFooter>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {QUICK_ADD_KIND_ORDER.map((kind) => (
            <span
              key={kind}
              className={cn(
                "rounded-xs px-0.5 underline decoration-2 underline-offset-4",
                QUICK_ADD_KINDS[kind].mark,
              )}
            >
              {QUICK_ADD_KINDS[kind].label}
            </span>
          ))}
        </span>
        <span className="flex shrink-0 items-center gap-3">
          <span className="flex items-center gap-1.5">
            <KbdKeys keys={["↵"]} />
            create
          </span>
          {onBack ? (
            <span className="flex items-center gap-1.5">
              <KbdKeys keys={["esc"]} />
              back
            </span>
          ) : null}
        </span>
      </CommandFooter>
    </div>
  );
}
