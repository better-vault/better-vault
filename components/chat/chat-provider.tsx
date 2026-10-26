"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { providers } from "@/lib/ai/catalog";
import type { ChatMessage, ChatMode } from "@/lib/chat/types";
import { db } from "@/lib/db/database";
import { clearChat, loadChat, saveChat } from "@/lib/db/messages";
import { activeModel, contextCharsFor, credentialsFor, getSettings } from "@/lib/db/settings";
import { getChunks } from "@/lib/db/sources";
import { selectPassages } from "@/lib/grounding/passages";

/** How many earlier messages are sent with each question. */
const HISTORY = 24;

interface ChatSession {
  messages: ChatMessage[];
  status: "submitted" | "streaming" | "ready" | "error";
  error: Error | undefined;
  mode: ChatMode;
  setMode: (mode: ChatMode) => void;
  send: (text: string) => Promise<void>;
  retry: () => Promise<void>;
  stop: () => void;
  clear: () => Promise<void>;
}

const ChatContext = createContext<ChatSession | null>(null);

/** Loads the notebook's saved chat, then runs it. */
export function ChatProvider({
  notebookId,
  children,
}: {
  notebookId: string;
  children: ReactNode;
}) {
  const [initial, setInitial] = useState<{ id: string; messages: ChatMessage[] } | null>(null);
  useEffect(() => {
    let alive = true;
    void loadChat(notebookId).then((messages) => {
      if (alive) setInitial({ id: notebookId, messages });
    });
    return () => {
      alive = false;
    };
  }, [notebookId]);
  if (!initial || initial.id !== notebookId) return null;
  return (
    <ChatRunner notebookId={notebookId} initial={initial.messages}>
      {children}
    </ChatRunner>
  );
}

function textOf(message: ChatMessage | undefined): string {
  return (
    message?.parts.flatMap((part) => (part.type === "text" ? [part.text] : [])).join("\n") ?? ""
  );
}

function ChatRunner({
  notebookId,
  initial,
  children,
}: {
  notebookId: string;
  initial: ChatMessage[];
  children: ReactNode;
}) {
  const [mode, setMode] = useState<ChatMode>("sources");
  const transport = useMemo(
    () =>
      new DefaultChatTransport<ChatMessage>({
        api: "/api/chat",
        prepareSendMessagesRequest: ({ messages, body }) => ({
          body: { ...body, messages: messages.slice(-HISTORY) },
        }),
      }),
    [],
  );
  const chat = useChat<ChatMessage>({
    id: notebookId,
    messages: initial,
    transport,
    onFinish: ({ messages }) => void saveChat(notebookId, messages),
  });

  /** The model, the key and the passages for a question, read fresh each time. */
  const requestFor = useCallback(
    async (question: string) => {
      const settings = await getSettings();
      const model = activeModel(settings);
      if (!model) throw new Error("No model is set up.");
      const sources = (
        await db.sources.where("notebookId").equals(notebookId).sortBy("createdAt")
      ).filter((source) => source.selected);
      const chunks = await getChunks(sources.map((source) => source.id));
      const passages = selectPassages({
        sources,
        chunks,
        budget: contextCharsFor(settings, model.provider),
        query: question,
      });
      return {
        mode: mode === "web" && providers[model.provider].webSearch ? "web" : "sources",
        model,
        credentials: credentialsFor(settings, model.provider),
        passages,
      };
    },
    [notebookId, mode],
  );

  const { sendMessage, regenerate, setMessages, stop, messages, status, error } = chat;

  const value = useMemo<ChatSession>(
    () => ({
      messages,
      status,
      error,
      mode,
      setMode,
      send: async (text) => {
        const body = await requestFor(text);
        await sendMessage({ text, metadata: { createdAt: Date.now() } }, { body });
      },
      retry: async () => {
        const question = textOf([...messages].reverse().find((message) => message.role === "user"));
        await regenerate({ body: await requestFor(question) });
      },
      stop: () => void stop(),
      clear: async () => {
        await stop();
        setMessages([]);
        await clearChat(notebookId);
      },
    }),
    [
      messages,
      status,
      error,
      mode,
      requestFor,
      sendMessage,
      regenerate,
      setMessages,
      stop,
      notebookId,
    ],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChatSession(): ChatSession {
  const context = useContext(ChatContext);
  if (!context) throw new Error("useChatSession must be used inside <ChatProvider>.");
  return context;
}
