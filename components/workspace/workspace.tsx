"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { buttonVariants } from "@/components/panelui/button";
import { ChatProvider } from "@/components/chat/chat-provider";
import { ConversationActionDialogs } from "@/components/chat/conversation-action-dialogs";
import { PromptBar } from "@/components/chat/prompt-bar";
import { Tabs } from "@/components/panelui/tabs";
import { OutputActionDialogs } from "@/components/studio/output-action-dialogs";
import { StudioRunnerProvider } from "@/components/studio/studio-runner";
import { ToolDialog } from "@/components/studio/tool-dialog";
import { AddSourceDialog } from "@/components/sources/add-source-dialog";
import { SourceReader } from "@/components/sources/source-reader";
import { useNotebook } from "@/lib/db/notebooks";
import { ChatView } from "./chat-view";
import { SourcesView } from "./sources-view";
import { StudioView } from "./studio-view";
import { TopBar } from "./top-bar";
import { WorkspaceProvider, useWorkspace, type WorkspaceTab } from "./workspace-context";
import { routes } from "@/lib/routes";

/** The notebook screen. */
export function Workspace({ notebookId }: { notebookId: string }) {
  const notebook = useNotebook(notebookId);
  if (notebook === undefined) return <div className="h-full" aria-busy="true" />;
  if (notebook === null) return <NotebookNotFound />;
  return (
    <WorkspaceProvider notebook={notebook}>
      <ChatProvider notebookId={notebook.id}>
        <StudioRunnerProvider notebookId={notebook.id}>
          <WorkspaceLayout />
        </StudioRunnerProvider>
      </ChatProvider>
    </WorkspaceProvider>
  );
}

function WorkspaceLayout() {
  const {
    notebook,
    tab,
    setTab,
    addSourceOpen,
    setAddSourceOpen,
    reading,
    closeReader,
    activeTool,
    closeTool,
  } = useWorkspace();
  const { t } = useTranslation();

  useEffect(() => {
    document.title = `${notebook.title} · ${t("appName")}`;
  }, [notebook.title, t]);

  return (
    <Tabs
      value={tab}
      onValueChange={(value) => setTab(value as WorkspaceTab)}
      className="h-full gap-0"
    >
      <TopBar />
      <div className="relative min-h-0 flex-1">
        {/* The prompt belongs to the chat; kept mounted so a draft survives a tab switch. */}
        <Tabs.Content value="chat" keepMounted className="relative h-full">
          <ChatView />
          <PromptBar />
        </Tabs.Content>
        <Tabs.Content value="sources" className="h-full">
          <SourcesView />
        </Tabs.Content>
        <Tabs.Content value="studio" className="h-full">
          <StudioView />
        </Tabs.Content>
      </div>
      <AddSourceDialog
        notebookId={notebook.id}
        open={addSourceOpen}
        onOpenChange={setAddSourceOpen}
      />
      <SourceReader reading={reading} onClose={closeReader} />
      <ToolDialog notebookId={notebook.id} toolId={activeTool} onClose={closeTool} />
      <OutputActionDialogs />
      <ConversationActionDialogs />
    </Tabs>
  );
}

function NotebookNotFound() {
  const { t } = useTranslation("workspace");
  return (
    <main className="grid h-full place-items-center p-6">
      <div className="max-w-sm text-center">
        <h1 className="text-xl font-semibold">{t("notFound.title")}</h1>
        <p className="mt-2 text-muted-foreground">{t("notFound.body")}</p>
        <Link href={routes.home} className={buttonVariants({ className: "mt-6" })}>
          {t("notFound.action")}
        </Link>
      </div>
    </main>
  );
}
