import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";

/**
 * OpenCode's model service, with an OpenCode API key: Zen (pay as you go)
 * or Go (a monthly plan). Each model is served in its maker's API style
 * (OpenAI responses or chat completions, Anthropic messages, Google), so the
 * model is built from OpenCode's public model list, which names the base URL
 * and the AI SDK package for every model.
 */
export const openCodePlans = {
  zen: "https://opencode.ai/inference",
  go: "https://opencode.ai/inference/go",
} as const;

export type OpenCodePlan = keyof typeof openCodePlans;

/** The plan's address; anything else is refused, so a request can't point the server elsewhere. */
export function openCodeBase(baseURL: string | undefined): string {
  const plans = Object.values(openCodePlans) as string[];
  return baseURL && plans.includes(baseURL) ? baseURL : openCodePlans.zen;
}

interface CatalogModel {
  id: string;
  type?: string;
  api?: Record<string, { base_url: string; sdk?: { aisdk?: string } }>;
}

const cacheFor = 10 * 60 * 1000;
const catalogs = new Map<string, { at: number; models: Promise<CatalogModel[]> }>();

/** The plan's model list. It is public and the same for everyone, so it is cached briefly. */
export function openCodeCatalog(base: string): Promise<CatalogModel[]> {
  const cached = catalogs.get(base);
  if (cached && Date.now() - cached.at < cacheFor) return cached.models;
  const models = fetch(`${base}/v1/models`, { signal: AbortSignal.timeout(10_000) })
    .then((response) => {
      if (!response.ok) throw new Error(`OpenCode answered ${response.status}.`);
      return response.json() as Promise<{ data: CatalogModel[] }>;
    })
    .then((body) => body.data.filter((model) => (model.type ?? "chat") === "chat"));
  catalogs.set(base, { at: Date.now(), models });
  models.catch(() => catalogs.delete(base));
  return models;
}

/** The chat models of a plan, by id. */
export async function listOpenCodeModels(baseURL: string | undefined): Promise<string[]> {
  return (await openCodeCatalog(openCodeBase(baseURL))).map((model) => model.id);
}

/** The order API styles are tried in, when a model offers several. */
const styles = ["chat-completions", "responses", "messages", "generate-content"];

export async function createOpenCodeModel(
  modelId: string,
  apiKey: string,
  baseURL: string | undefined,
): Promise<LanguageModel> {
  const base = openCodeBase(baseURL);
  const model = (await openCodeCatalog(base)).find((entry) => entry.id === modelId);
  const style = styles.find((name) => model?.api?.[name]);
  const api = style ? model?.api?.[style] : undefined;
  // Unknown to the list (a new model, say): try OpenCode's OpenAI-compatible endpoint.
  const url = api?.base_url ?? `${base}/openai/v1`;
  const sdk = api?.sdk?.aisdk ?? "@ai-sdk/openai-compatible";
  switch (sdk) {
    case "@ai-sdk/openai":
      return createOpenAI({ apiKey, baseURL: url }).responses(modelId);
    case "@ai-sdk/anthropic":
      return createAnthropic({ apiKey, baseURL: url })(modelId);
    case "@ai-sdk/google":
      return createGoogleGenerativeAI({ apiKey, baseURL: url })(modelId);
    default:
      return createOpenAICompatible({
        name: "opencode",
        apiKey,
        baseURL: url,
        supportsStructuredOutputs: true,
      })(modelId);
  }
}
