"use client";

import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { RenameDialog } from "@/components/common/rename-dialog";
import { useWorkspace } from "@/components/workspace/workspace-context";
import { deleteConversation, renameConversation } from "@/lib/db/messages";
import { useChatSession } from "./chat-provider";

/** The rename and delete dialogs for chats in History, shown over the workspace. */
export function ConversationActionDialogs() {
  const { t } = useTranslation("chat");
  const { conversationAction, clearConversationAction } = useWorkspace();
  const chat = useChatSession();
  const conversation = conversationAction?.conversation;

  return (
    <>
      <RenameDialog
        open={conversationAction?.kind === "rename"}
        onOpenChange={(open) => (open ? null : clearConversationAction())}
        title={t("history.rename.title")}
        label={t("history.rename.label")}
        value={conversation?.title ?? ""}
        onSave={(title) =>
          conversation && title.trim() ? renameConversation(conversation.id, title) : undefined
        }
      />
      <ConfirmDialog
        open={conversationAction?.kind === "delete"}
        onOpenChange={(open) => (open ? null : clearConversationAction())}
        title={t("history.delete.title")}
        body={t("history.delete.body", { title: conversation?.title || t("history.untitled") })}
        confirmLabel={t("history.delete.confirm")}
        onConfirm={async () => {
          if (!conversation) return;
          // Stop and leave the chat first, so its answer isn't saved back.
          if (conversation.id === chat.conversationId) chat.startNew();
          await deleteConversation(conversation.id);
        }}
      />
    </>
  );
}
