import { createOpenAI } from "@ai-sdk/openai";
import { wrapLanguageModel, type LanguageModel, type LanguageModelMiddleware } from "ai";
import { resource } from "./oauth";
import { accessToken } from "./session";

type Middleware = LanguageModelMiddleware;
type CallOptions = Parameters<NonNullable<Middleware["transformParams"]>>[0]["params"];
type GenerateResult = Awaited<ReturnType<NonNullable<Middleware["wrapGenerate"]>>>;
type DoStream = Parameters<NonNullable<Middleware["wrapGenerate"]>>[0]["doStream"];
type StreamPart =
  Awaited<ReturnType<DoStream>>["stream"] extends ReadableStream<infer P> ? P : never;

/** Sends each request with a fresh access token for the signed-in ChatGPT account. */
const withToken: typeof fetch = async (input, init) => {
  const headers = new Headers(init?.headers);
  headers.set("authorization", `Bearer ${await accessToken()}`);
  return fetch(input, { ...init, headers });
};

export function chatGPTProvider() {
  // The key is a placeholder: `withToken` sets the real header on every request.
  return createOpenAI({ apiKey: "chatgpt-plan", baseURL: resource, fetch: withToken });
}

/** Settings the ChatGPT plan route rejects. */
const unsupported = [
  "temperature",
  "topP",
  "topK",
  "maxOutputTokens",
  "presencePenalty",
  "frequencyPenalty",
  "seed",
] as const;

/**
 * ChatGPT plan requests must stream, must not be stored, and reject some
 * settings and system-role messages (OpenAI's "Preview limitations").
 */
export const planRules: Middleware = {
  transformParams: async ({ params }): Promise<CallOptions> => {
    const rest: CallOptions = { ...params };
    for (const key of unsupported) delete rest[key];
    return {
      ...rest,
      providerOptions: {
        ...rest.providerOptions,
        openai: {
          ...rest.providerOptions?.openai,
          store: false,
          systemMessageMode: "developer",
        },
      },
    };
  },
  // A whole answer (Studio, suggestions) is read from a stream too.
  wrapGenerate: async ({ doStream }): Promise<GenerateResult> => {
    const { stream, request, response } = await doStream();
    const content: GenerateResult["content"] = [];
    const texts = new Map<string, { type: "text"; text: string }>();
    const reasoning = new Map<string, { type: "reasoning"; text: string }>();
    let warnings: GenerateResult["warnings"] = [];
    let finish: Extract<StreamPart, { type: "finish" }> | undefined;
    let metadata: Omit<Extract<StreamPart, { type: "response-metadata" }>, "type"> = {};

    const reader = stream.getReader();
    for (;;) {
      const { done, value: part } = await reader.read();
      if (done) break;
      switch (part.type) {
        case "stream-start":
          warnings = part.warnings;
          break;
        case "response-metadata":
          metadata = { id: part.id, timestamp: part.timestamp, modelId: part.modelId };
          break;
        case "text-start": {
          const text = { type: "text" as const, text: "", providerMetadata: part.providerMetadata };
          texts.set(part.id, text);
          content.push(text);
          break;
        }
        case "text-delta": {
          const text = texts.get(part.id);
          if (text) text.text += part.delta;
          break;
        }
        case "reasoning-start": {
          const item = {
            type: "reasoning" as const,
            text: "",
            providerMetadata: part.providerMetadata,
          };
          reasoning.set(part.id, item);
          content.push(item);
          break;
        }
        case "reasoning-delta": {
          const item = reasoning.get(part.id);
          if (item) item.text += part.delta;
          break;
        }
        case "error":
          throw part.error;
        case "finish":
          finish = part;
          break;
        case "text-end":
        case "reasoning-end":
        case "tool-input-start":
        case "tool-input-delta":
        case "tool-input-end":
        case "raw":
          break;
        default:
          // Tool calls, tool results, sources and files are complete parts already.
          content.push(part as GenerateResult["content"][number]);
      }
    }
    if (!finish) throw new Error("ChatGPT ended the answer before it was complete.");
    return {
      content,
      finishReason: finish.finishReason,
      usage: finish.usage,
      providerMetadata: finish.providerMetadata,
      request,
      response: { ...metadata, headers: response?.headers },
      warnings,
    };
  },
};

export function chatGPTLanguageModel(modelId: string): LanguageModel {
  return wrapLanguageModel({
    model: chatGPTProvider().responses(modelId),
    middleware: planRules,
  });
}

/** The models this ChatGPT account may use, in OpenAI's order. */
export async function listChatGPTModels(): Promise<string[]> {
  const response = await withToken(`${resource}/models`, {
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`.trim());
  const body = (await response.json()) as { models?: { slug: string; visibility?: string }[] };
  return (body.models ?? [])
    .filter((model) => model.visibility === undefined || model.visibility === "list")
    .map((model) => model.slug);
}
