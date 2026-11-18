import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { useVaultName } from "@/components/home/vault-name";
import { SettingsSheet } from "@/components/settings/settings-sheet";
import { botAccess, canCreateBots, fullAccess } from "@/lib/bot/access";
import { starterBots } from "@/lib/bot/starters";
import {
  createBot,
  deleteBot,
  saveBotThread,
  seedBotsOnce,
  updateBot,
  useBots,
} from "@/lib/db/bots";
import type { Bot } from "@/lib/db/types";
import { cn } from "@/lib/utils";
import { BotEditorDialog, type BotDetails } from "./bot-editor-dialog";
import { BotRoster } from "./bot-roster";
import { dropBotChat, setBotEnvironment } from "./bot-runtime";
import { BotThread } from "./bot-thread";

const blank: BotDetails = {
  name: "",
  title: "",
  instructions: "",
  avatar: { shape: "blob", color: "chart-2" },
  canDelegate: false,
  canCreateBots: false,
  access: fullAccess,
  pinned: false,
};

/**
 * The Bot section: the roster of bots beside the chosen bot's thread. Each
 * bot is a persona with an avatar that keeps one ongoing chat, reads the
 * vault and asks before it changes anything.
 */
export default function BotView() {
  const { t } = useTranslation("bot");
  const vaultName = useVaultName();
  const bots = useBots();
  const [params, setParams] = useSearchParams();
  const [editing, setEditing] = useState<{ mode: "create" } | { mode: "edit"; bot: Bot } | null>(
    null,
  );
  const [clearing, setClearing] = useState<Bot | null>(null);
  const [deleting, setDeleting] = useState<Bot | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Bumped when a thread is cleared, so the open thread loads it again.
  const [resets, setResets] = useState(0);

  useEffect(() => {
    setBotEnvironment({ vaultLabel: vaultName });
  }, [vaultName]);

  useEffect(() => {
    void seedBotsOnce(() => starterBots((key) => t(key as "starters.chief.name")));
  }, [t]);

  const chosen = params.get("bot");
  const selected = useMemo(() => bots?.find((bot) => bot.id === chosen) ?? null, [bots, chosen]);
  // On a wide screen a bot is always open: the first one until another is chosen.
  const shown = selected ?? bots?.[0] ?? null;

  const select = (id: string | null) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (id) next.set("bot", id);
        else next.delete("bot");
        return next;
      },
      { replace: true },
    );

  if (!bots) return null;

  return (
    // Two cards, like the Skills page: the roster, and the open bot's thread.
    <div className="flex h-full min-h-0 gap-2">
      <aside
        className={cn(
          "min-h-0 w-full shrink-0 overflow-hidden rounded-3xl bg-card ring-1 ring-border md:block md:w-72",
          selected ? "hidden" : "block",
        )}
      >
        <BotRoster
          bots={bots}
          selected={shown?.id ?? null}
          onSelect={select}
          onCreate={() => setEditing({ mode: "create" })}
        />
      </aside>
      <section
        className={cn(
          "min-h-0 min-w-0 flex-1 overflow-hidden rounded-3xl bg-card ring-1 ring-border md:block",
          selected ? "block" : "hidden",
        )}
      >
        {shown ? (
          <BotThread
            key={`${shown.id}:${resets}`}
            bot={shown}
            bots={bots}
            onBack={() => select(null)}
            onEdit={() => setEditing({ mode: "edit", bot: shown })}
            onClear={() => setClearing(shown)}
            onDelete={() => setDeleting(shown)}
            onOpenSettings={() => setSettingsOpen(true)}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            {t("thread.select")}
          </div>
        )}
      </section>

      <BotEditorDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        mode={editing?.mode ?? "create"}
        initial={
          editing?.mode === "edit"
            ? {
                name: editing.bot.name,
                title: editing.bot.title,
                instructions: editing.bot.instructions,
                avatar: editing.bot.avatar,
                canDelegate: editing.bot.canDelegate,
                canCreateBots: canCreateBots(editing.bot),
                access: botAccess(editing.bot),
                pinned: editing.bot.pinned,
              }
            : blank
        }
        onSubmit={async (details) => {
          if (editing?.mode === "edit") await updateBot(editing.bot.id, details);
          else select((await createBot(details)).id);
        }}
      />
      <ConfirmDialog
        open={clearing !== null}
        onOpenChange={(open) => !open && setClearing(null)}
        title={t("clear.title", { name: clearing?.name ?? "" })}
        body={t("clear.body")}
        confirmLabel={t("clear.confirm")}
        onConfirm={async () => {
          if (!clearing) return;
          await dropBotChat(clearing.id);
          await saveBotThread(clearing.id, []);
          setResets((n) => n + 1);
        }}
      />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={t("delete.title", { name: deleting?.name ?? "" })}
        body={t("delete.body")}
        confirmLabel={t("delete.confirm")}
        onConfirm={async () => {
          if (!deleting) return;
          await dropBotChat(deleting.id);
          await deleteBot(deleting.id);
          select(null);
        }}
      />
      {/* Opened by the prompt's "Set up"; the sidebar has the visible button. */}
      <SettingsSheet
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        trigger={<button type="button" hidden aria-hidden tabIndex={-1} />}
      />
    </div>
  );
}
