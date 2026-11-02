import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  stepCountIs,
  streamText,
  toUIMessageStream,
} from "ai";
import { z } from "zod";
import { providers } from "@/lib/ai/catalog";
import { describeError } from "@/lib/ai/errors";
import { chatSystemPrompt } from "@/lib/ai/prompts";
import { createLanguageModel, createWebSearchTools } from "@/lib/ai/providers";
import { credentialsSchema, modelRefSchema } from "@/lib/ai/request";
import type { ChatMessage, ChatMessageMetadata } from "@/lib/chat/types";
import { toPassageRefs, stripCitations, type Passage } from "@/lib/grounding/passages";

const passageSchema = z.object({
  n: z.number().int().positive(),
  chunkId: z.string(),
  sourceId: z.string(),
  title: z.string(),
  kind: z.enum(["text", "markdown", "pdf", "url"]),
  text: z.string(),
});

const bodySchema = z.object({
  messages: z.array(z.looseObject({ id: z.string(), role: z.enum(["system", "user", "assistant"]) })).min(1),
  mode: z.enum(["sources", "web"]),
  model: modelRefSchema,
  credentials: credentialsSchema,
  passages: z.array(passageSchema).max(2000),
});

/** Earlier answers cite passages by numbers that no longer exist; drop them. */
function withoutOldCitations(messages: ChatMessage[]): ChatMessage[] {
  return messages.map((message, at) =>
    message.role !== "assistant" || at === messages.length - 1
      ? message
      : {
          ...message,
          parts: message.parts.map((part) =>
            part.type === "text" ? { ...part, text: stripCitations(part.text) } : part,
          ),
        },
  );
}

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request." }, { status: 400 });
  const { mode, model, credentials } = parsed.data;
  const messages = parsed.data.messages as unknown as ChatMessage[];
  const passages = parsed.data.passages as Passage[];

  if (mode === "web" && !providers[model.provider].webSearch) {
    return Response.json({ error: `${providers[model.provider].name} has no built-in web search.` }, { status: 400 });
  }

  let languageModel;
  try {
    languageModel = createLanguageModel(model, credentials);
  } catch (error) {
    return Response.json({ error: describeError(error) }, { status: 400 });
  }

  const tools = mode === "web" ? createWebSearchTools(model, credentials) : undefined;
  const result = streamText({
    model: languageModel,
    system: chatSystemPrompt(mode, passages),
    messages: await convertToModelMessages(withoutOldCitations(messages), { ignoreIncompleteToolCalls: true }),
    tools,
    stopWhen: stepCountIs(5),
    abortSignal: request.signal,
  });

  const metadata: ChatMessageMetadata = {
    createdAt: Date.now(),
    mode,
    model,
    passages: toPassageRefs(passages),
  };

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      tools,
      originalMessages: messages,
      sendSources: true,
      messageMetadata: ({ part }) => (part.type === "start" ? metadata : undefined),
      onError: describeError,
    }),
  });
}
