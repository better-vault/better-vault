import { Add01Icon, Search01Icon } from "@hugeicons/core-free-icons";
import { useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/icon";
import { Input } from "@/components/panelui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Bot } from "@/lib/db/types";
import { cn } from "@/lib/utils";
import { BotAvatar, type BotMood } from "./bot-avatar";
import { useBotActivity, type BotActivity } from "./bot-runtime";

/** The character is filled with what it sits on; a chosen row is a shade lighter than the card. */
const selectedSurface = {
  "--bot-surface": "color-mix(in oklab, var(--foreground) 10%, var(--card))",
} as CSSProperties;

const moodOf = (state: BotActivity): BotMood =>
  state === "thinking"
    ? "thinking"
    : state === "done"
      ? "happy"
      : state === "waiting"
        ? "waiting"
        : "idle";

/** Every bot: pinned ones as large tiles, the rest as rows with their last message. */
export function BotRoster({
  bots,
  selected,
  onSelect,
  onCreate,
}: {
  bots: Bot[];
  selected: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
}) {
  const { t } = useTranslation("bot");
  const [query, setQuery] = useState("");
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const shown = words.length
    ? bots.filter((bot) =>
        words.every((word) => `${bot.name} ${bot.title}`.toLowerCase().includes(word)),
      )
    : bots;
  const pinned = words.length ? [] : shown.filter((bot) => bot.pinned);
  const rest = words.length ? shown : shown.filter((bot) => !bot.pinned);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* A window bar on macOS: it moves the window and leaves room for its buttons. */}
      <div
        data-window-bar
        className="flex min-h-14 shrink-0 items-center gap-1 border-b py-3 ps-4 pe-3"
      >
        <h2 className="min-w-0 flex-1 truncate text-base font-semibold">{t("roster.label")}</h2>
        <button
          type="button"
          aria-label={t("roster.newBot")}
          title={t("roster.newBot")}
          onClick={onCreate}
          className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full bg-foreground text-background outline-none hover:bg-foreground/85 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
        >
          <Icon icon={Add01Icon} size={17} />
        </button>
      </div>
      <div className="border-b p-3">
        <Input.Group size="sm">
          <Input.Addon>
            <Icon icon={Search01Icon} size={14} />
          </Input.Addon>
          <Input
            size="sm"
            type="search"
            aria-label={t("roster.search")}
            placeholder={t("roster.searchPlaceholder")}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </Input.Group>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <nav aria-label={t("roster.label")} className="flex flex-col gap-1 px-2 py-3">
          {pinned.length > 0 ? (
            <div className="grid grid-cols-3 gap-1 pb-2">
              {pinned.map((bot) => (
                <PinnedTile
                  key={bot.id}
                  bot={bot}
                  selected={bot.id === selected}
                  onSelect={() => onSelect(bot.id)}
                />
              ))}
            </div>
          ) : null}
          {rest.map((bot) => (
            <BotRow
              key={bot.id}
              bot={bot}
              selected={bot.id === selected}
              onSelect={() => onSelect(bot.id)}
            />
          ))}
          {shown.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">
              {words.length ? t("roster.noMatch") : t("roster.empty")}
            </p>
          ) : null}
        </nav>
      </ScrollArea>
    </div>
  );
}

function PinnedTile({
  bot,
  selected,
  onSelect,
}: {
  bot: Bot;
  selected: boolean;
  onSelect: () => void;
}) {
  const state = useBotActivity(bot.id);
  return (
    <button
      type="button"
      aria-current={selected ? "page" : undefined}
      style={selected ? selectedSurface : undefined}
      onClick={onSelect}
      title={bot.title || bot.name}
      className={cn(
        "flex cursor-pointer flex-col items-center gap-1.5 rounded-2xl px-1 pt-2 pb-2.5 transition-colors outline-none hover:bg-foreground/5 focus-visible:ring-2 focus-visible:ring-ring",
        selected && "bg-foreground/10 hover:bg-foreground/10",
      )}
    >
      <BotAvatar avatar={bot.avatar} size={72} mood={moodOf(state)} />
      <span className="line-clamp-2 w-full text-center text-xs leading-4 font-medium">
        {bot.name}
      </span>
    </button>
  );
}

function BotRow({
  bot,
  selected,
  onSelect,
}: {
  bot: Bot;
  selected: boolean;
  onSelect: () => void;
}) {
  const { t } = useTranslation("bot");
  const state = useBotActivity(bot.id);
  const line =
    state === "thinking" || state === "waiting"
      ? t(`activity.${state}`)
      : (bot.preview ?? bot.title ?? t("roster.noMessages"));
  return (
    <button
      type="button"
      aria-current={selected ? "page" : undefined}
      style={selected ? selectedSurface : undefined}
      onClick={onSelect}
      className={cn(
        "flex w-full cursor-pointer items-center gap-3 rounded-xl px-2 py-2 text-start transition-colors outline-none hover:bg-foreground/5 focus-visible:ring-2 focus-visible:ring-ring",
        selected && "bg-foreground/10 hover:bg-foreground/10",
      )}
    >
      <BotAvatar avatar={bot.avatar} size={44} fit="head" mood={moodOf(state)} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium">{bot.name}</span>
        <span
          className={cn(
            "truncate text-xs text-muted-foreground",
            state === "waiting" && "text-foreground",
          )}
        >
          {line}
        </span>
      </span>
    </button>
  );
}

export { moodOf };
