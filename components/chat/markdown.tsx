"use client";

import { useMemo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { sourceKindIcons } from "@/components/sources/source-kind";
import { WebSearchCitation, type WebSource } from "@/components/ui/web-search";
import type { PassageRef } from "@/lib/chat/types";
import { linkCitations } from "@/lib/grounding/passages";
import { cn } from "@/lib/utils";

const CITE_RUN = /(?:\[\d+\]\(#cite-\d+\))+/g;

/** Joins runs like [1][2] that point into the same source into one chip. */
function groupCitations(markdown: string, byN: Map<number, PassageRef>): string {
  return markdown.replace(CITE_RUN, (run) => {
    const numbers = [...run.matchAll(/#cite-(\d+)/g)].map((match) => Number(match[1]));
    const groups: number[][] = [];
    for (const n of numbers) {
      const last = groups.at(-1);
      if (last && byN.get(last[0])?.sourceId === byN.get(n)?.sourceId) last.push(n);
      else groups.push([n]);
    }
    return groups.map((group) => `[${group[0]}](#cite-${group.join("-")})`).join("");
  });
}

const short = (title: string) => (title.length > 22 ? `${title.slice(0, 20).trimEnd()}…` : title);

interface MarkdownProps {
  text: string;
  /** The passages the text may cite as [n]. */
  passages?: readonly PassageRef[];
  onCite?: (passage: PassageRef) => void;
  className?: string;
  /** Render the blocks without a wrapper, for a parent that styles prose itself. */
  bare?: boolean;
  /** Give "##" and "###" headings ids (see `headingsOf`), for a table of contents. */
  anchorHeadings?: boolean;
}

/** A heading's id: the line it starts on, which adding citation links never changes. */
const headingId = (line: number | undefined) => `line-${line ?? 0}`;

/** The "##" and "###" headings of a Markdown text, as a table of contents. */
export function headingsOf(markdown: string): { level: 2 | 3; text: string; id: string }[] {
  const out: { level: 2 | 3; text: string; id: string }[] = [];
  let fenced = false;
  markdown.split("\n").forEach((line, at) => {
    if (/^\s*(```|~~~)/.test(line)) fenced = !fenced;
    const match = !fenced && line.match(/^(#{2,3})\s+(.+?)\s*#*\s*$/);
    if (!match) return;
    const text = match[2]
      .replace(/\[(\d+(?:\s*[,–-]\s*\d+)*)\](?!\()/g, "")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/[*_`]/g, "")
      .trim();
    if (text) out.push({ level: match[1].length as 2 | 3, text, id: headingId(at + 1) });
  });
  return out;
}

/** Model-written Markdown, with "[n]" citations drawn as source chips. */
export function Markdown({ text, passages, onCite, className, bare = false, anchorHeadings = false }: MarkdownProps) {
  const byN = useMemo(() => new Map((passages ?? []).map((passage) => [passage.n, passage])), [passages]);
  const source = useMemo(
    () => (byN.size > 0 ? groupCitations(linkCitations(text, new Set(byN.keys())), byN) : text),
    [text, byN],
  );

  const components = useMemo<Components>(
    () => ({
      ...(anchorHeadings
        ? {
            h2: ({ node, children }) => <h2 id={headingId(node?.position?.start.line)}>{children}</h2>,
            h3: ({ node, children }) => <h3 id={headingId(node?.position?.start.line)}>{children}</h3>,
          }
        : {}),
      a: ({ href, children }) => {
        const cite = href?.match(/^#cite-([\d-]+)$/);
        if (cite) {
          const passage = byN.get(Number(cite[1].split("-")[0]));
          if (passage) {
            const webSource: WebSource = {
              id: passage.chunkId,
              title: passage.title,
              url: "#",
              site: short(passage.title),
              snippet: passage.snippet,
              icon: sourceKindIcons[passage.kind],
            };
            return (
              <WebSearchCitation
                source={webSource}
                index={passage.n}
                linked={false}
                className={cn("mx-0.5", onCite && "cursor-pointer")}
                onClick={() => onCite?.(passage)}
              />
            );
          }
        }
        return (
          <a href={href} target="_blank" rel="noreferrer">
            {children}
          </a>
        );
      },
    }),
    [byN, onCite, anchorHeadings],
  );

  const blocks = (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {source}
    </ReactMarkdown>
  );
  return bare ? blocks : <div className={cn("markdown", className)}>{blocks}</div>;
}
