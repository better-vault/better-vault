"use client";

import {
  ArrowDown01Icon,
  ArrowRight01Icon,
  ArrowUpRight01Icon,
  Book02Icon,
  Globe02Icon,
  Loading03Icon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/icon";
import { cn } from "@/lib/utils";

/** One source an answer read or searched. */
export interface Reference {
  key: string;
  /** The citation numbers that point at it, if the answer cites it; shown as a count. */
  numbers: number[];
  title: string;
  /** Where it is from: a kind of source, or a web site's host. */
  place: string;
  snippet?: string;
  icon: IconSvgElement;
  /** A web page, opened in a new tab. */
  href?: string;
  /** A notebook source, opened in the reader. */
  onOpen?: () => void;
}

/** Rows shown before "Show all". */
const FIRST = 5;

/** "Searching the web for …", while the provider's search runs. */
export function SearchStatus({ label }: { label: string }) {
  return (
    <p className="flex items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
      <Icon icon={Loading03Icon} size={16} className="animate-spin motion-reduce:animate-none" />
      {label}
    </p>
  );
}

interface AnswerReferencesProps {
  notebook: Reference[];
  web: Reference[];
  /** A short summary beside the title, e.g. "Read 3 sources". */
  summary: string;
}

/**
 * The sources behind an answer, as footnotes under it: one line that opens a
 * numbered list. Notebook sources open in the reader; web pages in a new tab.
 */
export function AnswerReferences({ notebook, web, summary }: AnswerReferencesProps) {
  const { t } = useTranslation("chat");
  const [open, setOpen] = useState(false);
  const [all, setAll] = useState(false);
  const listId = useId();
  const total = notebook.length + web.length;
  if (total === 0) return null;

  const both = notebook.length > 0 && web.length > 0;
  const limit = all ? Infinity : FIRST;
  const shownNotebook = notebook.slice(0, limit);
  const shownWeb = web.slice(0, Math.max(0, limit - shownNotebook.length));

  return (
    <div className="border-t border-border/70 pt-1.5">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((value) => !value)}
        className="-mx-1 flex w-[calc(100%+0.5rem)] cursor-pointer items-center gap-2 rounded-lg px-1 py-1 text-start text-xs text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Icon icon={web.length > 0 && notebook.length === 0 ? Globe02Icon : Book02Icon} size={14} />
        <span className="font-medium text-foreground/80">{t("sources.title")}</span>
        <span className="rounded-full bg-muted px-1.5 font-mono text-[0.6875rem] tabular-nums">
          {total}
        </span>
        <span className="min-w-0 truncate">{summary}</span>
        <Icon
          icon={ArrowDown01Icon}
          size={14}
          className={cn(
            "ms-auto shrink-0 transition-transform duration-200 motion-reduce:transition-none",
            open && "rotate-180",
          )}
        />
      </button>
      <div
        id={listId}
        inert={!open}
        className="grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none"
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="flex flex-col gap-2 pt-1 pb-1">
            {shownNotebook.length > 0 ? (
              <ReferenceList
                heading={both ? t("sources.fromSources") : undefined}
                items={shownNotebook}
              />
            ) : null}
            {shownWeb.length > 0 ? (
              <ReferenceList heading={both ? t("sources.fromWeb") : undefined} items={shownWeb} />
            ) : null}
            {total > FIRST ? (
              <button
                type="button"
                onClick={() => setAll((value) => !value)}
                className="w-fit cursor-pointer rounded-md px-1 text-xs font-medium text-muted-foreground underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring"
              >
                {all ? t("sources.showFewer") : t("sources.showAll", { count: total })}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function ReferenceList({ heading, items }: { heading?: string; items: Reference[] }) {
  const { t } = useTranslation("chat");
  return (
    <section>
      {heading ? (
        <h4 className="px-1 pt-1 pb-0.5 text-[0.6875rem] font-medium text-muted-foreground">
          {heading}
        </h4>
      ) : null}
      <ol className="flex flex-col">
        {items.map((item, index) => {
          const body = (
            <>
              <span className="mt-0.5 flex h-5 min-w-5 shrink-0 items-center justify-center rounded-md bg-muted px-1 font-mono text-[0.6875rem] text-muted-foreground tabular-nums">
                {index + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <Icon icon={item.icon} size={14} className="shrink-0 text-muted-foreground" />
                  <span className="truncate text-sm font-medium">{item.title}</span>
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {item.numbers.length > 0
                    ? `${item.place} · ${t("sources.cited", { count: item.numbers.length })}`
                    : item.place}
                </span>
                {item.snippet ? (
                  <span className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground/90">
                    {item.snippet}
                  </span>
                ) : null}
              </span>
              <Icon
                icon={item.href ? ArrowUpRight01Icon : ArrowRight01Icon}
                size={14}
                className="mt-1 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 rtl:-scale-x-100"
              />
            </>
          );
          const row =
            "group flex w-full cursor-pointer items-start gap-3 rounded-xl px-1.5 py-2 text-start outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring";
          return (
            <li key={item.key}>
              {item.href ? (
                <a
                  href={item.href}
                  target="_blank"
                  rel="noreferrer"
                  className={row}
                  title={t("sources.openPage")}
                >
                  {body}
                </a>
              ) : (
                <button type="button" className={row} onClick={item.onOpen}>
                  {body}
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
