"use client";

import { Book02Icon, RepeatIcon } from "@hugeicons/core-free-icons";
import { getToolName, isToolUIPart } from "ai";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/icon";
import { Message } from "@/components/panelui/message";
import { sourceKindIcons } from "@/components/sources/source-kind";
import { WebSearch, type WebSource } from "@/components/ui/web-search";
import type { ChatMessage, PassageRef } from "@/lib/chat/types";
import { citedNumbers, stripCitations } from "@/lib/grounding/passages";
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
export function AssistantMessage({ message, streaming, isLast, onRetry, onOpenPassage }: AssistantMessageProps) {
  const { t } = useTranslation("chat");
  const { t: tSources } = useTranslation("sources");
  const passages = useMemo(() => message.metadata?.passages ?? [], [message.metadata?.passages]);
  const text = message.parts.flatMap((part) => (part.type === "text" ? [part.text] : [])).join("\n\n");

  const web = useMemo(() => {
    const sources: WebSource[] = [];
    const seen = new Set<string>();
    for (const part of message.parts) {
      if (part.type === "source-url" && !seen.has(part.url)) {
        seen.add(part.url);
        sources.push({ id: part.sourceId, url: part.url, title: part.title || new URL(part.url).hostname });
      }
    }
    const searches = message.parts.filter((part) => isToolUIPart(part) && SEARCH_TOOLS.has(getToolName(part)));
    const pending = searches.find((part) => isToolUIPart(part) && part.state !== "output-available");
    const input = pending && isToolUIPart(pending) ? (pending.input as { query?: unknown } | undefined) : undefined;
    return {
      sources,
      used: searches.length > 0 || sources.length > 0,
      searching: streaming && (pending !== undefined || (searches.length > 0 && !text)),
      query: typeof input?.query === "string" ? input.query : undefined,
    };
  }, [message.parts, streaming, text]);

  // Notebook sources: the ones the answer cites, else every one it was given.
  const notebook = useMemo(() => {
    const byN = new Map(passages.map((passage) => [passage.n, passage]));
    const cited = citedNumbers(text).flatMap((n) => byN.get(n) ?? []);
    const pick = (list: PassageRef[]) => {
      const out = new Map<string, PassageRef>();
      for (const passage of list) if (!out.has(passage.sourceId)) out.set(passage.sourceId, passage);
      return [...out.values()];
    };
    const read = pick(passages);
    const shown = cited.length > 0 ? pick(cited) : read;
    return {
      read: read.length,
      cards: shown.map<WebSource>((passage) => ({
        id: passage.sourceId,
        title: passage.title,
        url: "#",
        site: tSources(`kinds.${passage.kind}`),
        snippet: passage.snippet,
        icon: sourceKindIcons[passage.kind],
      })),
      firstBySource: new Map(shown.map((passage) => [passage.sourceId, passage])),
    };
  }, [passages, text, tSources]);

  const strings = {
    more: (count: number) => t("sources.more", { count }),
    showMore: (count: number) => t("sources.showMore", { count }),
    showLess: t("sources.showLess"),
  };

  return (
    <Message from="assistant" streaming={streaming && text !== ""}>
      <Message.Content className="gap-3">
        {message.metadata?.mode === "web" && web.used ? (
          <WebSearch
            sources={web.sources}
            status={web.searching ? "searching" : "done"}
            label={
              web.searching
                ? web.query
                  ? t("sources.searchingFor", { query: web.query })
                  : t("sources.searching")
                : t("sources.searched", { count: web.sources.length })
            }
            defaultOpen={false}
            strings={strings}
          />
        ) : null}
        {notebook.read > 0 && (text || !streaming) ? (
          <WebSearch
            sources={notebook.cards}
            linked={false}
            icon={Book02Icon}
            label={t("sources.read", { count: notebook.read })}
            defaultOpen={false}
            strings={strings}
            onSourceSelect={(source) => {
              const passage = notebook.firstBySource.get(source.id);
              if (passage) onOpenPassage(passage);
            }}
          />
        ) : null}
        {text ? (
          <Message.Bubble>
            <Message.BubbleContent>
              <Markdown text={text} passages={passages} onCite={onOpenPassage} bare />
            </Message.BubbleContent>
          </Message.Bubble>
        ) : streaming && !web.searching ? (
          <Message.Status>{passages.length > 0 ? t("status.reading") : t("status.thinking")}</Message.Status>
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
