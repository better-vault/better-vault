"use client";

import {
  Delete02Icon,
  MoreVerticalIcon,
  PencilEdit01Icon,
  PencilEdit02Icon,
} from "@hugeicons/core-free-icons";
import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/icon";
import { Button } from "@/components/panelui/button";
import { Menu } from "@/components/panelui/menu";
import { Sheet } from "@/components/panelui/sheet";
import { useWorkspace } from "@/components/workspace/workspace-context";
import { groupByDay } from "@/lib/chat/history";
import type { Conversation } from "@/lib/db/database";
import { useConversations } from "@/lib/db/messages";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useChatSession } from "./chat-provider";

interface HistorySheetProps {
  trigger: ReactElement;
}

/**
 * The notebook's chats, most recent first and grouped by day, with a button
 * for a new one. Choosing a chat closes the sheet and shows it; rename and
 * delete close the sheet and open their dialogs in the workspace.
 */
export function HistorySheet({ trigger }: HistorySheetProps) {
  const { t } = useTranslation("chat");
  const { t: tCommon } = useTranslation();
  const { notebook, historyOpen, setHistoryOpen } = useWorkspace();
  const chat = useChatSession();
  const conversations = useConversations(notebook.id);

  return (
    <Sheet side="left" open={historyOpen} onOpenChange={setHistoryOpen}>
      <Sheet.Trigger render={trigger} />
      <Sheet.Content
        closeLabel={tCommon("actions.close")}
        className="w-[min(24rem,calc(100vw-2*var(--sheet-gap)))]"
      >
        <Sheet.Header title={t("history.title")} description={t("history.description")} />
        <Sheet.Body>
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => {
              chat.startNew();
              setHistoryOpen(false);
            }}
          >
            <Icon icon={PencilEdit02Icon} size={16} />
            {t("history.newChat")}
          </Button>
          {conversations && conversations.length === 0 ? (
            <p className="px-1 py-8 text-center text-sm text-muted-foreground">
              {t("history.empty")}
            </p>
          ) : null}
          <div className="mt-4 flex flex-col gap-4 pb-4">
            {groupByDay(conversations ?? []).map(({ group, conversations: list }) => (
              <section key={group}>
                <h3 className="mb-1 px-1 text-xs font-medium text-muted-foreground">
                  {t(`history.groups.${group}`)}
                </h3>
                <ul className="-mx-2 flex flex-col gap-0.5">
                  {list.map((conversation) => (
                    <li key={conversation.id}>
                      <ConversationRow
                        conversation={conversation}
                        current={conversation.id === chat.conversationId}
                        onOpen={() => {
                          setHistoryOpen(false);
                          void chat.open(conversation.id);
                        }}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </Sheet.Body>
      </Sheet.Content>
    </Sheet>
  );
}

function ConversationRow({
  conversation,
  current,
  onOpen,
}: {
  conversation: Conversation;
  current: boolean;
  onOpen: () => void;
}) {
  const { t, i18n } = useTranslation("chat");
  const { t: tCommon } = useTranslation();
  const { requestConversationAction } = useWorkspace();
  const title = conversation.title || t("history.untitled");

  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded-2xl pe-1 transition-colors hover:bg-muted",
        current && "bg-muted",
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        aria-current={current ? "true" : undefined}
        className="flex min-w-0 flex-1 cursor-pointer flex-col rounded-2xl px-2.5 py-2 text-start outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="truncate text-sm font-medium">{title}</span>
        <span className="truncate text-xs text-muted-foreground">
          {current ? `${t("history.current")} · ` : ""}
          {formatRelativeTime(conversation.updatedAt, i18n.language)}
        </span>
      </button>
      <Menu>
        <Menu.Trigger
          aria-label={t("history.actions")}
          className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-foreground/10 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Icon icon={MoreVerticalIcon} size={16} />
        </Menu.Trigger>
        <Menu.Content align="end">
          <Menu.Item onClick={() => requestConversationAction({ kind: "rename", conversation })}>
            <Icon icon={PencilEdit01Icon} />
            {tCommon("actions.rename")}
          </Menu.Item>
          <Menu.Item
            variant="destructive"
            onClick={() => requestConversationAction({ kind: "delete", conversation })}
          >
            <Icon icon={Delete02Icon} />
            {tCommon("actions.delete")}
          </Menu.Item>
        </Menu.Content>
      </Menu>
    </div>
  );
}
