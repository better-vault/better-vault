import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  stepCountIs,
  streamText,
  tool,
  toUIMessageStream,
  type LanguageModelUsage,
  type ToolSet,
} from "ai";
import { z } from "zod";
import { providers } from "@/lib/ai/catalog";
import { describeError } from "@/lib/ai/errors";
import { botSystemPrompt } from "@/lib/ai/prompts";
import { createLanguageModel } from "@/lib/ai/providers";
import { credentialsSchema, effortSchema, modelRefSchema } from "@/lib/ai/request";
import { botToolDescriptions, botToolNames, botToolSchemas } from "@/lib/bot/tools";
import type { ChatMessage, ChatMessageMetadata, TokenUsage } from "@/lib/chat/types";
import { createVisualTools } from "../visual-tools";

const bodySchema = z.object({
  messages: z
    .array(z.looseObject({ id: z.string(), role: z.enum(["system", "user", "assistant"]) }))
    .min(1),
  model: modelRefSchema,
  credentials: credentialsSchema,
  effort: effortSchema,
  bot: z.object({
    name: z.string().min(1).max(80),
    title: z.string().max(200),
    instructions: z.string().max(20_000),
  }),
  /** The other bots this one may hand tasks to; empty when it may not. */
  roster: z
    .array(z.object({ name: z.string().max(80), title: z.string().max(200) }))
    .max(50)
    .default([]),
  /** The bot that handed this task over, if any. */
  delegatedBy: z.string().max(80).optional(),
  now: z.string().max(80),
  timeZone: z.string().max(80),
  vaults: z.array(z.string().max(200)).max(100),
  currentVault: z.string().max(200),
});

function tokenUsage(usage: LanguageModelUsage): TokenUsage {
  return {
    inputTokens: usage.inputTokens ?? 0,
    outputTokens: usage.outputTokens ?? 0,
    reasoningTokens: usage.outputTokenDetails.reasoningTokens,
    cachedInputTokens: usage.inputTokenDetails.cacheReadTokens,
  };
}

/**
 * The bot tools, declared without `execute`: the page runs them on the
 * user's device and adds their results, then asks again.
 */
function botTools(canDelegate: boolean): ToolSet {
  return Object.fromEntries(
    botToolNames
      .filter((name) => canDelegate || name !== "ask_bot")
      .map((name) => {
        const inputSchema: z.ZodType<Record<string, unknown>> = botToolSchemas[name];
        return [name, tool({ description: botToolDescriptions[name], inputSchema })];
      }),
  );
}

/** One turn of a bot's thread. */
export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request." }, { status: 400 });
  const { model, credentials, effort, roster } = parsed.data;
  const messages = parsed.data.messages as unknown as ChatMessage[];

  let languageModel;
  try {
    languageModel = await createLanguageModel(model, credentials, effort);
  } catch (error) {
    return Response.json({ error: describeError(error) }, { status: 400 });
  }

  // Local models often can't call tools, so they only chat.
  const canUseTools = !providers[model.provider].local;
  const tools: ToolSet | undefined = canUseTools
    ? { ...botTools(roster.length > 0), ...createVisualTools() }
    : undefined;
  const system = botSystemPrompt({
    ...parsed.data,
    tools: canUseTools,
    visuals: canUseTools,
  });

  const result = streamText({
    model: languageModel,
    system,
    messages: await convertToModelMessages(messages, { ignoreIncompleteToolCalls: true }),
    tools,
    stopWhen: stepCountIs(12),
    abortSignal: request.signal,
  });

  const metadata: ChatMessageMetadata = { createdAt: Date.now(), model };

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      tools,
      originalMessages: messages,
      sendSources: true,
      messageMetadata: ({ part }): ChatMessageMetadata | undefined => {
        if (part.type === "start") return metadata;
        if (part.type === "finish") return { usage: tokenUsage(part.totalUsage) };
        return undefined;
      },
      onError: describeError,
    }),
  });
}
