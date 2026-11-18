import {
  BotIcon,
  Calendar03Icon,
  MagicWand01Icon,
  CheckmarkCircle02Icon,
  Note01Icon,
  Search01Icon,
} from "@hugeicons/core-free-icons";
import { getToolName, isToolUIPart } from "ai";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/icon";
import { Button } from "@/components/panelui/button";
import { accessSummary } from "@/lib/bot/access";
import type { BotToolInput, BotToolName } from "@/lib/bot/tools";
import type { ChatMessage } from "@/lib/chat/types";
import type { Bot } from "@/lib/db/types";
import { cn } from "@/lib/utils";
import { BotAvatar } from "./bot-avatar";

export type ToolPart = Extract<ChatMessage["parts"][number], { toolCallId: string }>;

export function isToolPart(part: ChatMessage["parts"][number]): part is ToolPart {
  return isToolUIPart(part);
}

/** A tool's output, when it ran: what it said, or that it failed. */
function outputOf(part: ToolPart): Record<string, unknown> | null {
  if (part.state === "output-error") return { error: part.errorText };
  if (part.state !== "output-available") return null;
  return (part.output && typeof part.output === "object" ? part.output : {}) as Record<
    string,
    unknown
  >;
}

/**
 * One quiet line for a read or a hand-over: "Searched sources for …",
 * "Asked Planner". It shimmers while the tool runs.
 */
export function ToolEvent({ part, bots }: { part: ToolPart; bots: Bot[] }) {
  const { t } = useTranslation("bot");
  const name = getToolName(part) as BotToolName;
  const input = (part.input ?? {}) as Record<string, string | undefined>;
  const output = outputOf(part);
  const running = output === null;
  const failed = typeof output?.error === "string";

  if (name === "ask_bot") {
    const target = bots.find((bot) => bot.name === input.bot);
    const waiting = output?.pendingApproval === true;
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {target ? (
          <BotAvatar avatar={target.avatar} size={20} mood={running ? "thinking" : "idle"} />
        ) : null}
        <span className={cn(running && "animate-pulse motion-reduce:animate-none")}>
          {waiting
            ? t("tools.askedWaiting", { bot: input.bot ?? "" })
            : t("tools.ask_bot", { bot: input.bot ?? "" })}
        </span>
        {failed ? <span className="text-destructive">· {t("tools.failed")}</span> : null}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Icon icon={Search01Icon} size={14} className="shrink-0" />
      <span className={cn("truncate", running && "animate-pulse motion-reduce:animate-none")}>
        {t(`tools.${name}` as "tools.list_notebooks", {
          query: input.query ?? "",
          name: input.name ?? "",
          source: input.source ?? "",
        })}
      </span>
      {failed ? <span className="text-destructive">· {t("tools.failed")}</span> : null}
    </div>
  );
}

/** When an event happens, in the user's words: "Fri 20 Nov, 09:00–10:00". */
function eventWhen(input: BotToolInput<"add_calendar_event">, allDay: string, language: string) {
  const day = /^\d{4}-\d{2}-\d{2}$/;
  const date = (value: string) =>
    day.test(value)
      ? new Date(`${value}T00:00`)
      : new Date(value.length === 16 ? `${value}:00` : value);
  const start = date(input.start);
  if (Number.isNaN(start.getTime())) return input.start;
  const dayText = start.toLocaleDateString(language, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  if (day.test(input.start)) return `${dayText} · ${allDay}`;
  const time = (value: Date) =>
    value.toLocaleTimeString(language, { hour: "numeric", minute: "2-digit" });
  const end = input.end ? date(input.end) : new Date(start.getTime() + 60 * 60 * 1000);
  return `${dayText}, ${time(start)}–${Number.isNaN(end.getTime()) ? "" : time(end)}`;
}

/**
 * A change the bot wants to make: what it is, and Do it / Not now. Once
 * answered, it keeps showing what happened.
 */
export function ApprovalCard({
  part,
  onAnswer,
}: {
  part: ToolPart;
  onAnswer: (approved: boolean) => Promise<void>;
}) {
  const { t, i18n } = useTranslation("bot");
  const [busy, setBusy] = useState<boolean | null>(null);
  const name = getToolName(part) as
    | "create_note"
    | "append_to_note"
    | "add_calendar_event"
    | "create_bot"
    | "add_skills"
    | "create_skill";
  const input = (part.input ?? {}) as Record<string, string | undefined>;
  const output = outputOf(part);
  const pending = part.state === "input-available";
  const streaming = part.state === "input-streaming";

  const newBot =
    name === "create_bot" ? (part.input as BotToolInput<"create_bot"> | undefined) : undefined;
  const skillsToAdd =
    name === "add_skills" ? (part.input as BotToolInput<"add_skills"> | undefined) : undefined;
  const title =
    (newBot
      ? newBot.name
      : skillsToAdd
        ? skillsToAdd.names?.join(", ")
        : name === "create_skill"
          ? input.name
          : input.title) ?? "";
  const detail = skillsToAdd
    ? t("approval.skillsFrom", { source: skillsToAdd.source ?? "" })
    : name === "create_skill"
      ? (input.description ?? "")
      : newBot
        ? [
            newBot.title,
            accessSummary({
              notebooks: newBot.notebooks ?? true,
              notes: newBot.notes ?? "read",
              calendar: newBot.calendar ?? "read",
              skills: newBot.skills ?? "read",
            })
              .map((key) => t(`access.summary.${key}` as "access.summary.notes"))
              .join(", ") || t("access.summary.nothing"),
          ]
            .filter(Boolean)
            .join(" · ")
        : name === "add_calendar_event"
          ? [
              input.start
                ? eventWhen(
                    input as BotToolInput<"add_calendar_event">,
                    t("approval.allDay"),
                    i18n.language,
                  )
                : "",
              input.location ?? "",
            ]
              .filter(Boolean)
              .join(" · ")
          : ((name === "create_note" ? input.body : input.text) ?? "")
              .replace(/[#*_>`-]+/g, " ")
              .replace(/\s+/g, " ")
              .trim();

  const answer = async (approved: boolean) => {
    setBusy(approved);
    try {
      await onAnswer(approved);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex w-full max-w-md flex-col gap-1 rounded-2xl border bg-card px-4 py-3.5">
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon
          icon={
            name === "add_calendar_event"
              ? Calendar03Icon
              : newBot
                ? BotIcon
                : skillsToAdd || name === "create_skill"
                  ? MagicWand01Icon
                  : Note01Icon
          }
          size={13}
        />
        {pending || streaming ? t("approval.label") : t(`approval.${name}`)}
      </span>
      <div className="flex items-center gap-3">
        {newBot ? (
          <BotAvatar
            avatar={{
              color: newBot.color ?? "chart-2",
              head: newBot.head,
              face: newBot.face,
              neck: newBot.neck,
            }}
            size={44}
            mood={pending ? "idle" : "happy"}
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[0.9375rem] font-medium">{title || t(`approval.${name}`)}</p>
          {detail ? <p className="line-clamp-2 text-sm text-muted-foreground">{detail}</p> : null}
        </div>
      </div>
      {pending ? (
        <div className="mt-2 flex gap-2">
          <Button
            size="sm"
            shape="pill"
            disabled={busy !== null}
            aria-busy={busy === true}
            onClick={() => void answer(true)}
          >
            {t("approval.approve")}
          </Button>
          <Button
            size="sm"
            shape="pill"
            variant="outline"
            disabled={busy !== null}
            onClick={() => void answer(false)}
          >
            {t("approval.decline")}
          </Button>
        </div>
      ) : output ? (
        <p
          className={cn(
            "mt-1 flex items-center gap-1.5 text-sm",
            output.ok === true ? "text-foreground" : "text-muted-foreground",
            typeof output.error === "string" && "text-destructive",
          )}
        >
          {output.ok === true ? <Icon icon={CheckmarkCircle02Icon} size={15} /> : null}
          {typeof output.error === "string"
            ? t("approval.failed", { error: output.error })
            : output.ok === true
              ? t("approval.approved")
              : t("approval.declined")}
        </p>
      ) : null}
    </div>
  );
}
