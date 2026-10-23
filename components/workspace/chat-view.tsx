"use client";

import { Book02Icon, Idea01Icon } from "@hugeicons/core-free-icons";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { AssistantMessage } from "@/components/chat/assistant-message";
import { useChatSession } from "@/components/chat/chat-provider";
import { Icon } from "@/components/icon";
import { Message } from "@/components/panelui/message";
import { useSources } from "@/lib/db/sources";
import { useWorkspace } from "./workspace-context";

const SUGGESTIONS = ["summary", "questions", "terms", "plan"] as const;

/** The conversation with the notebook. */
export function ChatView() {
  const { t } = useTranslation("chat");
  const chat = useChatSession();
  const { readSource } = useWorkspace();
  const scroller = useRef<HTMLDivElement>(null);
  const last = chat.messages.at(-1);

  // Follows the answer as it is written, unless the reader has scrolled up.
  useEffect(() => {
    const element = scroller.current;
    if (!element) return;
    if (element.scrollHeight - element.scrollTop - element.clientHeight < 240) {
      element.scrollTo({ top: element.scrollHeight });
    }
  }, [chat.messages]);

  if (chat.messages.length === 0) return <EmptyChat />;

  const retry = () =>
    chat.retry().catch((error: unknown) => toast.error(error instanceof Error ? error.message : String(error)));

  return (
    <div ref={scroller} className="h-full overflow-y-auto px-4 pb-56 sm:px-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-8 pt-4">
        {chat.messages.map((message, at) =>
          message.role === "user" ? (
            <Message key={message.id} from="user">
              <Message.Content>
                <Message.Bubble>
                  <Message.BubbleContent className="whitespace-pre-wrap">
                    {message.parts.flatMap((part) => (part.type === "text" ? [part.text] : [])).join("\n")}
                  </Message.BubbleContent>
                </Message.Bubble>
              </Message.Content>
            </Message>
          ) : (
            <AssistantMessage
              key={message.id}
              message={message}
              streaming={chat.status === "streaming" && at === chat.messages.length - 1}
              isLast={at === chat.messages.length - 1}
              onRetry={retry}
              onOpenPassage={(passage) => readSource(passage.sourceId, passage.chunkId)}
            />
          ),
        )}
        {chat.status === "submitted" && last?.role === "user" ? (
          <Message from="assistant">
            <Message.Content>
              <Message.Status>{t("status.thinking")}</Message.Status>
            </Message.Content>
          </Message>
        ) : null}
        {chat.status === "error" && chat.error ? (
          <div role="alert" className="flex items-center gap-3 rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <span className="min-w-0 flex-1">{t("error", { error: chat.error.message })}</span>
            <button
              type="button"
              onClick={retry}
              className="shrink-0 cursor-pointer font-medium underline-offset-4 hover:underline"
            >
              {t("actions.retry")}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function EmptyChat() {
  const { t } = useTranslation("chat");
  const chat = useChatSession();
  const { notebook, setAddSourceOpen } = useWorkspace();
  const sources = useSources(notebook.id);
  const selected = sources?.filter((source) => source.selected).length ?? 0;

  return (
    <div className="flex h-full flex-col items-center justify-center overflow-y-auto px-4 pb-48 text-center">
      <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t("empty.title")}</h2>
      {sources && selected === 0 ? (
        <>
          <p className="mt-2 max-w-md text-muted-foreground">{t("empty.noSources")}</p>
          <button
            type="button"
            onClick={() => setAddSourceOpen(true)}
            className="mt-6 inline-flex cursor-pointer items-center gap-2 rounded-full bg-muted px-4 py-2 text-sm font-medium outline-none transition-colors hover:bg-foreground/10 focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Icon icon={Book02Icon} size={16} />
            {t("addSource")}
          </button>
        </>
      ) : (
        <>
          <p className="mt-2 max-w-md text-muted-foreground">{t("empty.body", { count: selected })}</p>
          <div className="mt-8 flex max-w-xl flex-wrap justify-center gap-2">
            {SUGGESTIONS.map((key) => (
              <button
                key={key}
                type="button"
                disabled={chat.status === "submitted" || chat.status === "streaming"}
                onClick={() =>
                  chat.send(t(`empty.suggestions.${key}`)).catch((error: unknown) =>
                    toast.error(error instanceof Error ? error.message : String(error)),
                  )
                }
                className="inline-flex cursor-pointer items-center gap-2 rounded-full border px-3.5 py-2 text-sm outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              >
                <Icon icon={Idea01Icon} size={16} className="text-chart-4" />
                {t(`empty.suggestions.${key}`)}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
