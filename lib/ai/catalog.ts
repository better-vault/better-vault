/**
 * The AI providers better-vault can talk to. Shared by the browser (settings,
 * model picker) and the server (model factory). To add a provider, add it
 * here and handle it in `lib/ai/providers.ts` and `server/routes/models.ts`.
 */
export const providerIds = [
  "openai",
  "anthropic",
  "google",
  "opencode",
  "ollama",
  "lmstudio",
  "deepseek",
  "elevenlabs",
] as const;

export type ProviderId = (typeof providerIds)[number];

/**
 * How much a model thinks before it answers: the AI SDK's `reasoning` call
 * option, which each provider maps to its own setting. `provider-default`
 * sends nothing and lets the provider decide.
 */
export const efforts = [
  "provider-default",
  "none",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
] as const;

export type Effort = (typeof efforts)[number];

export interface ProviderInfo {
  id: ProviderId;
  /**
   * "chat" providers write text (chat, Studio). "audio" providers only speak:
   * they never appear in the model picker and are used by audio tools.
   */
  kind: "chat" | "audio";
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
  /**
   * Models that draw pictures (infographics), best first, from the image
   * model id unions in the installed `@ai-sdk/*` packages. Empty when the
   * provider has none.
   */
  imageModels: readonly string[];
  /** The effort levels its models accept, `provider-default` first. Empty when it has none. */
  efforts: readonly Effort[];
}

/** Providers whose models chat and write: the ones in the model picker. */
export const chatProviderIds = [
  "openai",
  "anthropic",
  "google",
  "opencode",
  "ollama",
  "lmstudio",
  "deepseek",
] as const satisfies readonly ProviderId[];

/** Providers that turn text into speech (audio overviews). */
export const speechProviderIds = ["elevenlabs"] as const satisfies readonly ProviderId[];
export type SpeechProviderId = (typeof speechProviderIds)[number];

/** Providers with image models. */
export const imageProviderIds = ["openai", "google"] as const satisfies readonly ProviderId[];
export type ImageProviderId = (typeof imageProviderIds)[number];

export const providers: Record<ProviderId, ProviderInfo> = {
  openai: {
    id: "openai",
    kind: "chat",
    name: "OpenAI",
    local: false,
    needsKey: true,
    webSearch: true,
    keyUrl: "https://platform.openai.com/api-keys",
    suggestedModels: ["gpt-6.1-sol", "gpt-6-sol", "gpt-6-luna", "gpt-5.5", "gpt-5.4-mini"],
    contextChars: 400_000,
    imageModels: [
      "gpt-image-2",
      "gpt-image-2.5-sunburst",
      "gpt-image-2.5-flare",
      "gpt-image-1.5",
      "gpt-image-1",
      "gpt-image-1-mini",
      "chatgpt-image-latest",
    ],
    efforts: ["provider-default", "none", "minimal", "low", "medium", "high", "xhigh", "max"],
  },
  anthropic: {
    id: "anthropic",
    kind: "chat",
    name: "Anthropic",
    local: false,
    needsKey: true,
    webSearch: true,
    keyUrl: "https://console.anthropic.com/settings/keys",
    suggestedModels: [
      "claude-opus-5-5",
      "claude-sonnet-5-5",
      "claude-haiku-5-5",
      "claude-fable-5-1",
    ],
    contextChars: 400_000,
    imageModels: [],
    efforts: ["provider-default", "low", "medium", "high", "xhigh", "max"],
  },
  google: {
    id: "google",
    kind: "chat",
    name: "Google Gemini",
    local: false,
    needsKey: true,
    webSearch: true,
    keyUrl: "https://aistudio.google.com/apikey",
    suggestedModels: [
      "gemini-4-argon",
      "gemini-3.8-flash",
      "gemini-pro-latest",
      "gemini-flash-latest",
    ],
    contextChars: 400_000,
    imageModels: [
      "gemini-3-pro-image-preview",
      "gemini-nano-banana-2.1",
      "gemini-3.1-flash-image-preview",
      "gemini-2.5-flash-image",
    ],
    efforts: ["provider-default", "none", "minimal", "low", "medium", "high"],
  },
  opencode: {
    id: "opencode",
    kind: "chat",
    name: "OpenCode",
    local: false,
    needsKey: true,
    // The plan: Zen (pay as you go) or Go (monthly). See lib/ai/opencode.ts.
    defaultBaseURL: "https://opencode.ai/inference",
    webSearch: false,
    keyUrl: "https://opencode.ai/auth",
    // Taken from OpenCode's model list (https://opencode.ai/inference/v1/models).
    suggestedModels: ["claude-sonnet-5-5", "gpt-6-luna", "gemini-3.8-flash", "deepseek-v4.1-flash"],
    contextChars: 300_000,
    imageModels: [],
    efforts: ["provider-default", "none", "low", "medium", "high"],
  },
  ollama: {
    id: "ollama",
    kind: "chat",
    name: "Ollama",
    local: true,
    needsKey: false,
    defaultBaseURL: "http://localhost:11434",
    webSearch: false,
    suggestedModels: [],
    contextChars: 12_000,
    imageModels: [],
    efforts: ["provider-default", "none", "low", "medium", "high"],
  },
  lmstudio: {
    id: "lmstudio",
    kind: "chat",
    name: "LM Studio",
    local: true,
    needsKey: false,
    defaultBaseURL: "http://localhost:1234",
    webSearch: false,
    suggestedModels: [],
    contextChars: 12_000,
    imageModels: [],
    efforts: ["provider-default", "none", "low", "medium", "high"],
  },
  deepseek: {
    id: "deepseek",
    kind: "chat",
    name: "DeepSeek",
    local: false,
    needsKey: true,
    // DeepSeek has no built-in web search tool, so Web mode stays off.
    webSearch: false,
    keyUrl: "https://platform.deepseek.com/api_keys",
    // From the model id union in the installed @ai-sdk/deepseek.
    suggestedModels: ["deepseek-v4-pro", "deepseek-v4-flash"],
    contextChars: 400_000,
    imageModels: [],
    // DeepSeek V4 thinks at high or max; the SDK maps the other levels onto those.
    efforts: ["provider-default", "none", "low", "high", "max"],
  },
  elevenlabs: {
    id: "elevenlabs",
    kind: "audio",
    name: "ElevenLabs",
    local: false,
    needsKey: true,
    webSearch: false,
    keyUrl: "https://elevenlabs.io/app/settings/api-keys",
    // Speech models, from the model id union in the installed @ai-sdk/elevenlabs.
    suggestedModels: ["eleven_v3", "eleven_v4"],
    contextChars: 0,
    imageModels: [],
    efforts: [],
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
  /**
   * OpenAI only: use the ChatGPT account signed in on this server (its plan
   * pays) instead of an API key. The tokens never leave the server.
   */
  chatgpt?: boolean;
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
