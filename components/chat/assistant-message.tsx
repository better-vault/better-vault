"use client";

import { Globe02Icon, RepeatIcon } from "@hugeicons/core-free-icons";
import { getToolName, isToolUIPart } from "ai";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/icon";
import { Message } from "@/components/panelui/message";
import { sourceKindIcons } from "@/components/sources/source-kind";
import type { ChatMessage, PassageRef } from "@/lib/chat/types";
import { cleanText } from "@/lib/grounding/clean";
import { citedNumbers, stripCitations } from "@/lib/grounding/passages";

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};
import { AnswerReferences, SearchStatus, type Reference } from "./answer-references";
import { Markdown } from "./markdown";

const SEARCH_TOOLS = new Set(["web_search", "google_search"]);

interface AssistantMessageProps {
  message: ChatMessage;
  streaming: boolean;
  isLast: boolean;
  onRetry: () => void;
  onOpenPassage: (passage: PassageRef) => void;
}

/** An answer: the sources it read or searched, the text with citations, and actions. */
export function AssistantMessage({
  message,
  streaming,
  isLast,
  onRetry,
  onOpenPassage,
}: AssistantMessageProps) {
  const { t } = useTranslation("chat");
  const { t: tSources } = useTranslation("sources");
  const passages = useMemo(() => message.metadata?.passages ?? [], [message.metadata?.passages]);
  const text = message.parts
    .flatMap((part) => (part.type === "text" ? [part.text] : []))
    .join("\n\n");

  const web = useMemo(() => {
    const references: Reference[] = [];
    const seen = new Set<string>();
    for (const part of message.parts) {
      if (part.type === "source-url" && !seen.has(part.url)) {
        seen.add(part.url);
        const host = hostOf(part.url);
        references.push({
          key: part.url,
          numbers: [],
          title: part.title || host,
          place: host,
          icon: Globe02Icon,
          href: part.url,
        });
      }
    }
    const searches = message.parts.filter(
      (part) => isToolUIPart(part) && SEARCH_TOOLS.has(getToolName(part)),
    );
    const pending = searches.find(
      (part) => isToolUIPart(part) && part.state !== "output-available",
    );
    const input =
      pending && isToolUIPart(pending)
        ? (pending.input as { query?: unknown } | undefined)
        : undefined;
    return {
      references,
      searching: streaming && (pending !== undefined || (searches.length > 0 && !text)),
      query: typeof input?.query === "string" ? input.query : undefined,
    };
  }, [message.parts, streaming, text]);

  // Notebook sources: the ones the answer cites, with their numbers; else every one it was given.
  const notebook = useMemo(() => {
    const cited = new Set(citedNumbers(text));
    const bySource = new Map<string, { first: PassageRef; numbers: number[] }>();
    const read = new Set(passages.map((passage) => passage.sourceId));
    const citedPassages = passages.filter((passage) => cited.has(passage.n));
    for (const passage of citedPassages.length > 0 ? citedPassages : passages) {
      const entry = bySource.get(passage.sourceId);
      if (entry) {
        if (cited.has(passage.n)) entry.numbers.push(passage.n);
      } else {
        bySource.set(passage.sourceId, {
          first: passage,
          numbers: cited.has(passage.n) ? [passage.n] : [],
        });
      }
    }
    const references = [...bySource.values()].map<Reference>(({ first, numbers }) => ({
      key: first.sourceId,
      numbers: numbers.sort((a, b) => a - b),
      title: first.title,
      place: tSources(`kinds.${first.kind}`),
      // Snippets saved with older answers may hold characters no font can draw.
      snippet: cleanText(first.snippet),
      icon: sourceKindIcons[first.kind],
      onOpen: () => onOpenPassage(first),
    }));
    return { references, read: read.size };
  }, [passages, text, tSources, onOpenPassage]);

  const showNotebook = notebook.read > 0 && !streaming;
  const showWeb = message.metadata?.mode === "web" && web.references.length > 0 && !streaming;
  const summary = [
    showNotebook ? t("sources.read", { count: notebook.read }) : "",
    showWeb ? t("sources.searched", { count: web.references.length }) : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Message from="assistant" streaming={streaming && text !== ""}>
      <Message.Content className="gap-3">
        {message.metadata?.mode === "web" && web.searching ? (
          <SearchStatus
            label={
              web.query ? t("sources.searchingFor", { query: web.query }) : t("sources.searching")
            }
          />
        ) : null}
        {text ? (
          <Message.Bubble>
            <Message.BubbleContent>
              <Markdown text={text} passages={passages} onCite={onOpenPassage} bare />
            </Message.BubbleContent>
          </Message.Bubble>
        ) : streaming && !web.searching ? (
          <Message.Status>
            {passages.length > 0 ? t("status.reading") : t("status.thinking")}
          </Message.Status>
        ) : null}
        {text && (showNotebook || showWeb) ? (
          <AnswerReferences
            notebook={showNotebook ? notebook.references : []}
            web={showWeb ? web.references : []}
            summary={summary}
          />
        ) : null}
        {!streaming && text ? (
          <Message.Actions aria-label={t("actions.label")} reveal={isLast ? "always" : "hover"}>
            <Message.Action
              label={t("actions.copy")}
              copiedLabel={t("actions.copied")}
              copy={() => stripCitations(text)}
            />
            {isLast ? (
              <Message.Action label={t("actions.retry")} onClick={onRetry}>
                <Icon icon={RepeatIcon} />
              </Message.Action>
            ) : null}
          </Message.Actions>
        ) : null}
      </Message.Content>
    </Message>
  );
}
