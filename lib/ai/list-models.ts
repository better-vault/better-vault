import { providers, type ProviderCredentials, type ProviderId } from "./catalog";
import { localProvidersAllowed, parseBaseURL } from "./server-config";

const TIMEOUT = 10_000;

async function getJson<T>(url: string, headers: Record<string, string> = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(TIMEOUT),
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") throw error;
    throw new Error(`Could not reach ${new URL(url).origin}. Is the server running?`);
  }
  if (!response.ok) {
    let reason = response.statusText;
    try {
      const body = (await response.json()) as { error?: { message?: string } | string };
      reason = typeof body.error === "string" ? body.error : (body.error?.message ?? reason);
    } catch {
      // Not JSON; the status text will do.
    }
    throw new Error(`${response.status} ${reason}`.trim());
  }
  return (await response.json()) as T;
}

// Models that do not chat (audio, images, embeddings, …).
const NOT_CHAT =
  /(audio|realtime|transcribe|tts|image|embed|moderation|whisper|dall-e|computer-use|robotics|native-audio|live|veo|imagen|aqa)/i;

const byNewest = (a: string, b: string) => b.localeCompare(a, "en", { numeric: true });

/** Lists the chat models a provider offers to these credentials. */
export async function listModels(
  provider: ProviderId,
  credentials: ProviderCredentials,
): Promise<string[]> {
  const info = providers[provider];
  if (info.needsKey && !credentials.apiKey) throw new Error("An API key is needed.");
  if (info.local && !localProvidersAllowed())
    throw new Error("Local providers are turned off on this server.");

  switch (provider) {
    case "openai": {
      const body = await getJson<{ data: { id: string }[] }>("https://api.openai.com/v1/models", {
        authorization: `Bearer ${credentials.apiKey}`,
      });
      return body.data
        .map((model) => model.id)
        .filter(
          (id) =>
            /^(gpt-|o\d|chatgpt-)/.test(id) && !NOT_CHAT.test(id) && !/search|instruct/.test(id),
        )
        .sort(byNewest);
    }
    case "anthropic": {
      const body = await getJson<{ data: { id: string }[] }>(
        "https://api.anthropic.com/v1/models?limit=100",
        {
          "x-api-key": credentials.apiKey ?? "",
          "anthropic-version": "2023-06-01",
        },
      );
      return body.data.map((model) => model.id);
    }
    case "google": {
      const body = await getJson<{
        models?: { name: string; supportedGenerationMethods?: string[] }[];
      }>("https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000", {
        "x-goog-api-key": credentials.apiKey ?? "",
      });
      return (body.models ?? [])
        .filter((model) => model.supportedGenerationMethods?.includes("generateContent"))
        .map((model) => model.name.replace(/^models\//, ""))
        .filter((id) => id.startsWith("gemini") && !NOT_CHAT.test(id))
        .sort(byNewest);
    }
    case "ollama": {
      const base = parseBaseURL(credentials.baseURL, info.defaultBaseURL ?? "");
      const body = await getJson<{ models: { name: string }[] }>(
        new URL("/api/tags", base).toString(),
      );
      return body.models.map((model) => model.name).filter((id) => !NOT_CHAT.test(id));
    }
    case "lmstudio": {
      const base = parseBaseURL(credentials.baseURL, info.defaultBaseURL ?? "");
      const body = await getJson<{ data: { id: string }[] }>(
        new URL("/v1/models", base).toString(),
      );
      return body.data.map((model) => model.id).filter((id) => !NOT_CHAT.test(id));
    }
  }
}
