import {
  Add01Icon,
  ArrowLeft01Icon,
  Shield01Icon,
  Delete02Icon,
  Eraser01Icon,
  MoreHorizontalIcon,
  PencilEdit02Icon,
} from "@hugeicons/core-free-icons";
import type { Chat } from "@ai-sdk/react";
import { useChat } from "@ai-sdk/react";
import { getToolName } from "ai";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ComposerModelPicker } from "@/components/chat/composer-model-picker";
import { EffortMenu } from "@/components/chat/effort-menu";
import { Markdown } from "@/components/chat/markdown";
import { UsageRing } from "@/components/chat/usage-ring";
import { isVisualPart, VisualPart } from "@/components/chat/visual/visual-part";
import { Icon } from "@/components/icon";
import { Menu } from "@/components/panelui/menu";
import { Message } from "@/components/panelui/message";
import { Prompt, type PromptState } from "@/components/panelui/prompt";
import { ScrollArea } from "@/components/ui/scroll-area";
import { providers } from "@/lib/ai/catalog";
import { accessSummary, botAccess } from "@/lib/bot/access";
import { botWriteTools, isBotTool } from "@/lib/bot/tools";
import type { ChatMessage } from "@/lib/chat/types";
import { updateBot } from "@/lib/db/bots";
import { activeModel, availableModels, useSettings } from "@/lib/db/settings";
import type { Bot } from "@/lib/db/types";
import { cn } from "@/lib/utils";
import { BotAvatar } from "./bot-avatar";
import { ApprovalCard, isToolPart, ToolEvent } from "./bot-parts";
import { moodOf } from "./bot-roster";
import { answerApproval, botChat, NoModelError, sendToBot, useBotActivity } from "./bot-runtime";

/** A bot's thread: its header, the conversation, and the prompt. */
export function BotThread({
  bot,
  bots,
  onBack,
  onEdit,
  onClear,
  onDelete,
  onOpenSettings,
}: {
  bot: Bot;
  bots: Bot[];
  onBack: () => void;
  onEdit: () => void;
  onClear: () => void;
  onDelete: () => void;
  onOpenSettings: () => void;
}) {
  const [chat, setChat] = useState<{ id: string; chat: Chat<ChatMessage> } | null>(null);
  useEffect(() => {
    let alive = true;
    void botChat(bot.id).then((loaded) => {
      if (alive) setChat({ id: bot.id, chat: loaded });
    });
    return () => {
      alive = false;
    };
  }, [bot.id]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ThreadHeader
        bot={bot}
        onBack={onBack}
        onEdit={onEdit}
        onClear={onClear}
        onDelete={onDelete}
      />
      {chat && chat.id === bot.id ? (
        <ThreadBody
          key={bot.id}
          bot={bot}
          bots={bots}
          chat={chat.chat}
          onEdit={onEdit}
          onClear={onClear}
          onOpenSettings={onOpenSettings}
        />
      ) : (
        <div className="min-h-0 flex-1" />
      )}
    </div>
  );
}

function ThreadHeader({
  bot,
  onBack,
  onEdit,
  onClear,
  onDelete,
}: {
  bot: Bot;
  onBack: () => void;
  onEdit: () => void;
  onClear: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation("bot");
  const state = useBotActivity(bot.id);
  return (
    <div
      data-window-bar
      className="grid min-h-14 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 py-3"
    >
      <div>
        <button
          type="button"
          onClick={onBack}
          aria-label={t("thread.back")}
          title={t("thread.back")}
          className="flex size-8 cursor-pointer items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring md:hidden"
        >
          <Icon icon={ArrowLeft01Icon} size={18} />
        </button>
      </div>
      <div className="flex min-w-0 items-center gap-2 rounded-full bg-muted/60 py-1 ps-1.5 pe-3.5">
        <BotAvatar avatar={bot.avatar} size={28} mood={moodOf(state)} followPointer />
        <span className="truncate text-sm font-medium">{bot.name}</span>
      </div>
      <div className="flex justify-end">
        <Menu>
          <Menu.Trigger
            aria-label={t("menu.label")}
            title={t("menu.label")}
            className="flex size-8 cursor-pointer items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-popup-open:bg-accent"
          >
            <Icon icon={MoreHorizontalIcon} size={18} />
          </Menu.Trigger>
          <Menu.Content align="end">
            <Menu.Item onClick={onEdit}>
              <Icon icon={PencilEdit02Icon} />
              {t("menu.edit")}
            </Menu.Item>
            <Menu.Item onClick={onClear}>
              <Icon icon={Eraser01Icon} />
              {t("menu.clear")}
            </Menu.Item>
            <Menu.Separator />
            <Menu.Item variant="destructive" onClick={onDelete}>
              <Icon icon={Delete02Icon} />
              {t("menu.delete")}
            </Menu.Item>
          </Menu.Content>
        </Menu>
      </div>
    </div>
  );
}

/** A divider before the first message and after a long pause: "Friday 7:48 AM". */
function stampFor(at: number, previous: number | undefined, language: string): string | null {
  if (previous !== undefined && at - previous < 60 * 60 * 1000) return null;
  const date = new Date(at);
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  return date.toLocaleString(language, {
    ...(sameDay ? {} : { weekday: "long" }),
    ...(today.getTime() - at > 6 * 24 * 60 * 60 * 1000 ? { day: "numeric", month: "short" } : {}),
    hour: "numeric",
    minute: "2-digit",
  });
}

function ThreadBody({
  bot,
  bots,
  chat: instance,
  onEdit,
  onClear,
  onOpenSettings,
}: {
  bot: Bot;
  bots: Bot[];
  chat: Chat<ChatMessage>;
  onEdit: () => void;
  onClear: () => void;
  onOpenSettings: () => void;
}) {
  const { t, i18n } = useTranslation("bot");
  const { t: tChat } = useTranslation("chat");
  const { messages, status, error, stop, regenerate, clearError } = useChat<ChatMessage>({
    chat: instance,
  });
  const settings = useSettings();
  const state = useBotActivity(bot.id);
  const [draft, setDraft] = useState("");
  const end = useRef<HTMLDivElement>(null);

  const models = settings ? availableModels(settings) : [];
  const appModel = settings ? activeModel(settings) : null;
  const model =
    bot.model &&
    models.some((ref) => ref.provider === bot.model?.provider && ref.modelId === bot.model.modelId)
      ? bot.model
      : appModel;
  const busy = status === "submitted" || status === "streaming";
  const promptStatus: PromptState = status === "ready" || status === "error" ? "idle" : status;
  const local = model ? providers[model.provider].local : false;
  const noModel = settings !== undefined && !model;

  // While the bot works and no text is arriving (waiting for the model, or
  // running tools), it shows that it is typing.
  const last = messages.at(-1);
  const tail = last?.role === "assistant" ? last.parts.at(-1) : undefined;
  const textArriving =
    tail?.type === "text" && tail.state === "streaming" && tail.text.trim() !== "";
  const typing = (busy || state === "thinking") && !textArriving;

  // Follow the conversation as it grows.
  const lastLength = last?.parts.length ?? 0;
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [messages.length, lastLength, typing]);

  const stamps = useMemo(() => {
    const times = messages.map((message) => message.metadata?.createdAt);
    return times.map((at, index) =>
      at
        ? stampFor(
            at,
            times.slice(0, index).findLast((each) => each !== undefined),
            i18n.language,
          )
        : null,
    );
  }, [messages, i18n.language]);

  const errorText =
    error && !(error instanceof NoModelError) && error.message !== "no-model"
      ? error.message
      : null;

  return (
    <>
      <ScrollArea className="min-h-0 flex-1">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-4 pt-2 pb-6">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <BotAvatar avatar={bot.avatar} size={112} mood={moodOf(state)} followPointer />
              <p className="text-lg font-semibold tracking-tight">
                {t("thread.emptyTitle", { name: bot.name })}
              </p>
              <p className="max-w-sm text-sm text-muted-foreground">
                {t("thread.emptyBody", { name: bot.name })}
                {bot.canDelegate ? ` ${t("thread.emptyDelegate")}` : ""}
              </p>
            </div>
          ) : null}
          {messages.map((message, at) => (
            <Fragment key={message.id}>
              {stamps[at] ? (
                <p className="pt-2 text-center font-mono text-xs text-muted-foreground">
                  {stamps[at]}
                </p>
              ) : null}
              {message.role === "user" ? (
                <UserTurn message={message} bots={bots} />
              ) : (
                <BotTurn
                  message={message}
                  bots={bots}
                  onAnswer={async (toolCallId, approved) => {
                    try {
                      await answerApproval(bot.id, toolCallId, approved);
                    } catch (failure) {
                      toast.error(failure instanceof Error ? failure.message : String(failure));
                    }
                  }}
                />
              )}
            </Fragment>
          ))}
          {typing ? <TypingIndicator bot={bot} /> : null}
          {errorText ? (
            <p className="text-sm text-destructive">
              {t("thread.error", { error: errorText })}{" "}
              <button
                type="button"
                className="cursor-pointer underline underline-offset-4"
                onClick={() => {
                  clearError();
                  void regenerate();
                }}
              >
                {t("thread.retry")}
              </button>
            </p>
          ) : null}
          <div ref={end} />
        </div>
      </ScrollArea>

      <div className="shrink-0 px-3 pb-3">
        <div className="mx-auto w-full max-w-3xl">
          <Prompt
            value={draft}
            onValueChange={setDraft}
            status={promptStatus}
            disabled={!model}
            onStop={() => void stop()}
            onSubmit={({ text }) => {
              sendToBot(bot.id, text).catch((failure: unknown) => {
                toast.error(failure instanceof Error ? failure.message : String(failure));
              });
            }}
          >
            <Prompt.Banner open={noModel || (local && !busy)}>
              {noModel ? tChat("setup.banner") : t("thread.noTools", { name: bot.name })}
              {noModel ? (
                <Prompt.BannerAction onClick={onOpenSettings}>
                  {tChat("setup.action")}
                </Prompt.BannerAction>
              ) : null}
            </Prompt.Banner>
            <Prompt.Field>
              <Prompt.Textarea
                placeholder={t("thread.placeholder", { name: bot.name })}
                aria-label={t("thread.placeholder", { name: bot.name })}
              />
              <Prompt.Footer>
                <Prompt.Tools>
                  <Prompt.Menu label={tChat("menu")} icon={<Icon icon={Add01Icon} />}>
                    <Menu.Item onClick={onEdit}>
                      <Icon icon={PencilEdit02Icon} />
                      {t("menu.edit")}
                    </Menu.Item>
                    <Menu.Item disabled={messages.length === 0} onClick={onClear}>
                      <Icon icon={Eraser01Icon} />
                      {t("menu.clear")}
                    </Menu.Item>
                  </Prompt.Menu>
                  {model && settings ? (
                    <ComposerModelPicker
                      settings={settings}
                      model={model}
                      onChange={(next) => void updateBot(bot.id, { model: next })}
                    />
                  ) : null}
                </Prompt.Tools>
                <Prompt.Submit sendLabel={tChat("send")} stopLabel={tChat("stop")} />
              </Prompt.Footer>
            </Prompt.Field>
            <Prompt.Context open={model !== null}>
              <Prompt.ContextItem onSelect={onEdit}>
                <Icon icon={Shield01Icon} size={14} />
                <span className="max-w-64 truncate">
                  {accessSummary(botAccess(bot))
                    .map((key) => t(`access.summary.${key}` as "access.summary.notes"))
                    .join(", ") || t("access.summary.nothing")}
                </span>
              </Prompt.ContextItem>
              {model && settings ? (
                <span className="ms-auto flex items-center gap-3">
                  <EffortMenu settings={settings} provider={model.provider} />
                  <UsageRing messages={messages} settings={settings} model={model} busy={busy} />
                </span>
              ) : null}
            </Prompt.Context>
          </Prompt>
        </div>
      </div>
    </>
  );
}

function textOf(message: ChatMessage) {
  return message.parts.flatMap((part) => (part.type === "text" ? [part.text] : [])).join("\n\n");
}

/** The user's message, or a task another bot handed over. */
function UserTurn({ message, bots }: { message: ChatMessage; bots: Bot[] }) {
  const { t } = useTranslation("bot");
  const fromId = message.metadata?.from;
  const from = fromId ? bots.find((bot) => bot.id === fromId) : undefined;
  return (
    <Message from="user">
      <Message.Content>
        {fromId ? (
          <Message.Header>
            {from ? <BotAvatar avatar={from.avatar} size={18} /> : null}
            {from ? t("thread.from", { name: from.name }) : t("thread.fromUnknown")}
          </Message.Header>
        ) : null}
        <Message.Bubble className={cn(!fromId && "bg-primary text-primary-foreground")}>
          <Message.BubbleContent className={cn(!fromId && "text-primary-foreground")}>
            <p className="whitespace-pre-wrap">{textOf(message)}</p>
          </Message.BubbleContent>
        </Message.Bubble>
      </Message.Content>
    </Message>
  );
}

type Block =
  | { kind: "text"; text: string }
  | { kind: "part"; part: Extract<ChatMessage["parts"][number], { toolCallId: string }> };

/** A bot's turn: its text in bubbles, the tools it used, and the changes waiting for an OK. */
function BotTurn({
  message,
  bots,
  onAnswer,
}: {
  message: ChatMessage;
  bots: Bot[];
  onAnswer: (toolCallId: string, approved: boolean) => Promise<void>;
}) {
  const blocks = useMemo(() => {
    const out: Block[] = [];
    for (const part of message.parts) {
      if (part.type === "text") {
        if (!part.text.trim()) continue;
        const last = out.at(-1);
        if (last?.kind === "text") last.text += `\n\n${part.text}`;
        else out.push({ kind: "text", text: part.text });
      } else if (isToolPart(part)) {
        out.push({ kind: "part", part });
      }
    }
    return out;
  }, [message.parts]);

  return (
    <div className="flex flex-col items-start gap-2">
      {blocks.map((block, at) => {
        if (block.kind === "text")
          return (
            <div
              key={at}
              className="max-w-[min(85%,40rem)] rounded-[1.25rem] rounded-ss-md bg-muted px-4 py-2.5"
            >
              <Message from="assistant">
                <Message.Content>
                  <Message.Bubble>
                    <Message.BubbleContent className="leading-6 [&_p]:my-2">
                      <Markdown text={block.text} bare />
                    </Message.BubbleContent>
                  </Message.Bubble>
                </Message.Content>
              </Message>
            </div>
          );
        const part = block.part;
        if (isVisualPart(part))
          return (
            <div key={part.toolCallId} className="w-full">
              <VisualPart part={part} />
            </div>
          );
        const name = getToolName(part);
        if (!isBotTool(name)) return null;
        if (botWriteTools.has(name))
          return (
            <ApprovalCard
              key={part.toolCallId}
              part={part}
              onAnswer={(approved) => onAnswer(part.toolCallId, approved)}
            />
          );
        return <ToolEvent key={part.toolCallId} part={part} bots={bots} />;
      })}
    </div>
  );
}

/** The bot is working: its face thinks beside a bubble of pulsing dots. */
function TypingIndicator({ bot }: { bot: Bot }) {
  const { t } = useTranslation("bot");
  return (
    <div role="status" className="flex items-end gap-2">
      <BotAvatar avatar={bot.avatar} size={32} mood="thinking" />
      <div
        aria-hidden
        className="flex h-10 items-center gap-1.5 rounded-[1.25rem] rounded-es-md bg-muted px-4"
      >
        {[0, 1, 2].map((dot) => (
          <span
            key={dot}
            className="size-2 animate-pulse rounded-full bg-muted-foreground motion-reduce:animate-none"
            style={{ animationDelay: `${dot * 200}ms` }}
          />
        ))}
      </div>
      <span className="sr-only">{t("thread.working", { name: bot.name })}</span>
    </div>
  );
}
