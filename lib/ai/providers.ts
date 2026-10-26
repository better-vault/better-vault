import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { ImageModel, LanguageModel, ToolSet } from "ai";
import { providers, type ModelRef, type ProviderCredentials } from "./catalog";
import { localProvidersAllowed, parseBaseURL } from "./server-config";

/**
 * Builds the model for one request from the credentials sent with it.
 * Nothing is cached, so a key never outlives the request.
 */
export function createLanguageModel(
  ref: ModelRef,
  credentials: ProviderCredentials,
): LanguageModel {
  const info = providers[ref.provider];
  if (info.needsKey && !credentials.apiKey)
    throw new Error(`Add an API key for ${info.name} in Settings.`);
  if (info.local && !localProvidersAllowed())
    throw new Error("Local providers are turned off on this server.");

  switch (ref.provider) {
    case "openai":
      return createOpenAI({ apiKey: credentials.apiKey })(ref.modelId);
    case "anthropic":
      return createAnthropic({ apiKey: credentials.apiKey })(ref.modelId);
    case "google":
      return createGoogleGenerativeAI({ apiKey: credentials.apiKey })(ref.modelId);
    case "ollama":
    case "lmstudio": {
      const base = parseBaseURL(credentials.baseURL, info.defaultBaseURL ?? "");
      return createOpenAICompatible({
        name: ref.provider,
        baseURL: new URL("/v1", base).toString(),
        supportsStructuredOutputs: true,
      })(ref.modelId);
    }
  }
}

/** Builds an image model for one request. Only OpenAI and Google draw pictures. */
export function createImageModel(ref: ModelRef, credentials: ProviderCredentials): ImageModel {
  const info = providers[ref.provider];
  if (info.imageModels.length === 0) throw new Error(`${info.name} has no image models.`);
  if (!credentials.apiKey) throw new Error(`Add an API key for ${info.name} in Settings.`);
  switch (ref.provider) {
    case "openai":
      return createOpenAI({ apiKey: credentials.apiKey }).image(ref.modelId);
    case "google":
      return createGoogleGenerativeAI({ apiKey: credentials.apiKey }).image(ref.modelId);
    default:
      throw new Error(`${info.name} has no image models.`);
  }
}

/**
 * The provider's own web search tool, or nothing when it has none.
 * better-vault uses no third-party search service.
 */
export function createWebSearchTools(
  ref: ModelRef,
  credentials: ProviderCredentials,
): ToolSet | undefined {
  switch (ref.provider) {
    case "openai":
      return { web_search: createOpenAI({ apiKey: credentials.apiKey }).tools.webSearch({}) };
    case "anthropic":
      return {
        web_search: createAnthropic({ apiKey: credentials.apiKey }).tools.webSearch_20260318({
          maxUses: 5,
        }),
      };
    case "google":
      return {
        google_search: createGoogleGenerativeAI({ apiKey: credentials.apiKey }).tools.googleSearch(
          {},
        ),
      };
    default:
      return undefined;
  }
}
