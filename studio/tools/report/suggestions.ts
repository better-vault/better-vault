"use client";

import { useEffect, useState } from "react";
import { modelRequestFor } from "@/lib/studio/request";

export interface ReportSuggestion {
  title: string;
  description: string;
  instructions: string;
}

type Result = { status: "ready"; items: ReportSuggestion[] } | { status: "error" };

/** Suggestions already loaded, by sources and language, for this visit. */
const cache = new Map<string, Result>();

/** A small spread of the sources is enough to suggest formats. */
const BUDGET = 12_000;

/**
 * Report formats suited to the chosen sources, as NotebookLM suggests them.
 * Loaded once per set of sources and language.
 */
export function useReportSuggestions(sourceIds: string[], language: string) {
  const key = `${[...sourceIds].sort().join(",")}|${language}`;
  const [, rerender] = useState(0);
  const result = cache.get(key);

  useEffect(() => {
    if (sourceIds.length === 0 || cache.has(key)) return;
    let alive = true;
    // Waits for the source choice to settle before asking.
    const timer = setTimeout(async () => {
      let next: Result;
      try {
        const request = await modelRequestFor(sourceIds, "", BUDGET);
        const response = await fetch("/api/studio/suggest", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...request, language }),
        });
        const body = (await response.json()) as { suggestions?: ReportSuggestion[] };
        next =
          response.ok && body.suggestions
            ? { status: "ready", items: body.suggestions }
            : { status: "error" };
      } catch {
        next = { status: "error" };
      }
      cache.set(key, next);
      if (alive) rerender((n) => n + 1);
    }, 400);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
    // The key stands for the sources and the language.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (sourceIds.length === 0) return { status: "error" as const, items: [] };
  if (!result) return { status: "loading" as const, items: [] };
  return result.status === "ready"
    ? { status: "ready" as const, items: result.items }
    : { status: "error" as const, items: [] };
}
