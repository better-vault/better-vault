import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Usage } from "@/components/panelui/usage";
import type { ModelRef } from "@/lib/ai/catalog";
import type { ChatMessage } from "@/lib/chat/types";
import { contextTokensFor, type AppSettings } from "@/lib/db/settings";

interface UsageRingProps {
  messages: ChatMessage[];
  settings: AppSettings;
  model: ModelRef;
  /** A reply is being written, so the figure is still growing. */
  busy: boolean;
}

/**
 * How full the model's context was at the last answer, as a ring. The
 * provider counts the tokens; their split between instructions, sources and
 * conversation is estimated from the request's size in characters.
 */
export function UsageRing({ messages, settings, model, busy }: UsageRingProps) {
  const { t, i18n } = useTranslation("chat");

  const figures = useMemo(() => {
    const answers = messages.filter((message) => message.metadata?.usage);
    const last = answers.at(-1)?.metadata;
    let input = 0;
    let output = 0;
    for (const answer of answers) {
      input += answer.metadata?.usage?.inputTokens ?? 0;
      output += answer.metadata?.usage?.outputTokens ?? 0;
    }
    return { last, input, output, answers: answers.length };
  }, [messages]);

  const ref = figures.last?.model ?? model;
  const limit = contextTokensFor(settings, ref);
  const usage = figures.last?.usage;
  const size = figures.last?.prompt;

  const segments = useMemo(() => {
    if (!usage) return [];
    const parts = size
      ? [
          { label: t("usage.instructions"), chars: size.instructions },
          { label: t("usage.sources"), chars: size.sources },
          { label: t("usage.conversation"), chars: size.conversation },
        ]
      : [{ label: t("usage.prompt"), chars: 1 }];
    const total = parts.reduce((sum, part) => sum + part.chars, 0) || 1;
    return [
      ...parts.map((part) => ({
        label: part.label,
        value: Math.round((usage.inputTokens * part.chars) / total),
      })),
      { label: t("usage.answer"), value: usage.outputTokens },
    ];
  }, [usage, size, t]);

  const format = (value: number) =>
    value.toLocaleString(i18n.language, { notation: "compact", maximumFractionDigits: 1 });

  return (
    <Usage
      limit={limit}
      segments={segments}
      state={busy ? "active" : usage ? "done" : "idle"}
      label={t("usage.label")}
      locales={i18n.language}
    >
      <Usage.Trigger className="size-6 [&>svg]:size-4" />
      <Usage.Content align="end">
        <Usage.Summary label={t("usage.context")} unit={t("usage.tokens")} />
        {usage ? <Usage.Breakdown /> : null}
        <Usage.Section title={t("usage.conversationTitle")}>
          <Usage.Meter
            label={t("usage.sent")}
            value={figures.input}
            limit={Math.max(figures.input + figures.output, 1)}
            display={format(figures.input)}
          />
          <Usage.Meter
            label={t("usage.received")}
            value={figures.output}
            limit={Math.max(figures.input + figures.output, 1)}
            display={format(figures.output)}
            note={
              usage?.reasoningTokens
                ? t("usage.reasoning", {
                    count: usage.reasoningTokens,
                    tokens: format(usage.reasoningTokens),
                  })
                : undefined
            }
          />
        </Usage.Section>
        <Usage.Footer>{usage ? t("usage.estimate") : t("usage.empty")}</Usage.Footer>
      </Usage.Content>
    </Usage>
  );
}
