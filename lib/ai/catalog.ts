/**
 * The AI providers better-vault can talk to. Shared by the browser (settings,
 * model picker) and the server (model factory). To add a provider, add it
 * here and handle it in `lib/ai/providers.ts` and `app/api/models/route.ts`.
 */
export const providerIds = ["openai", "anthropic", "google", "ollama", "lmstudio"] as const;

export type ProviderId = (typeof providerIds)[number];

export interface ProviderInfo {
  id: ProviderId;
  /** Brand name, shown as is in every language. */
  name: string;
  /** Runs on the user's machine (no key, has a base URL). */
  local: boolean;
  needsKey: boolean;
  defaultBaseURL?: string;
  /** Has a built-in web search tool, so Web mode can be used. */
  webSearch: boolean;
  /** Where to create an API key. */
  keyUrl?: string;
  /**
   * Shown before the provider's own model list has been fetched. Taken from
   * the model id unions in the installed `@ai-sdk/*` packages.
   */
  suggestedModels: readonly string[];
  /** How much source text, in characters, to send as context by default. */
  contextChars: number;
}

export const providers: Record<ProviderId, ProviderInfo> = {
  openai: {
    id: "openai",
    name: "OpenAI",
    local: false,
    needsKey: true,
    webSearch: true,
    keyUrl: "https://platform.openai.com/api-keys",
    suggestedModels: ["gpt-6.1-sol", "gpt-6-sol", "gpt-6-luna", "gpt-5.5", "gpt-5.4-mini"],
    contextChars: 400_000,
  },
  anthropic: {
    id: "anthropic",
    name: "Anthropic",
    local: false,
    needsKey: true,
    webSearch: true,
    keyUrl: "https://console.anthropic.com/settings/keys",
    suggestedModels: ["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5", "claude-fable-5-1"],
    contextChars: 400_000,
  },
  google: {
    id: "google",
    name: "Google Gemini",
    local: false,
    needsKey: true,
    webSearch: true,
    keyUrl: "https://aistudio.google.com/apikey",
    suggestedModels: ["gemini-4-argon", "gemini-3.8-flash", "gemini-pro-latest", "gemini-flash-latest"],
    contextChars: 400_000,
  },
  ollama: {
    id: "ollama",
    name: "Ollama",
    local: true,
    needsKey: false,
    defaultBaseURL: "http://localhost:11434",
    webSearch: false,
    suggestedModels: [],
    contextChars: 12_000,
  },
  lmstudio: {
    id: "lmstudio",
    name: "LM Studio",
    local: true,
    needsKey: false,
    defaultBaseURL: "http://localhost:1234",
    webSearch: false,
    suggestedModels: [],
    contextChars: 12_000,
  },
};

export function isProviderId(value: unknown): value is ProviderId {
  return typeof value === "string" && (providerIds as readonly string[]).includes(value);
}

/** Which model a request goes to. */
export interface ModelRef {
  provider: ProviderId;
  modelId: string;
}

/** What the server needs to reach a provider. Sent with each request, never stored server-side. */
export interface ProviderCredentials {
  apiKey?: string;
  baseURL?: string;
}

/** `provider:modelId`. Model ids can contain colons (e.g. `llama3.2:3b`), provider ids cannot. */
export function modelKey(ref: ModelRef): string {
  return `${ref.provider}:${ref.modelId}`;
}

export function parseModelKey(key: string): ModelRef | null {
  const at = key.indexOf(":");
  if (at <= 0) return null;
  const provider = key.slice(0, at);
  const modelId = key.slice(at + 1);
  return isProviderId(provider) && modelId ? { provider, modelId } : null;
}
