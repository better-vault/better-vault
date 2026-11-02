/**
 * Server-side switches, set with environment variables when hosting
 * better-vault for others.
 *
 * BETTER_VAULT_ALLOW_LOCAL_PROVIDERS=false turns off Ollama and LM Studio.
 * Their address comes from the user, so on a public server they would let
 * anyone make the server fetch addresses on its own network.
 */
export function localProvidersAllowed(): boolean {
  return process.env.BETTER_VAULT_ALLOW_LOCAL_PROVIDERS !== "false";
}

let desktopRuntime = false;

/** Set by `createApi({ desktop: true })` when the API runs inside the desktop app. */
export function setDesktopRuntime(desktop: boolean) {
  desktopRuntime = desktop;
}

/** True when the API runs inside the desktop app's main process. */
export function isDesktopRuntime(): boolean {
  return desktopRuntime;
}

/**
 * Sign in with ChatGPT works in the desktop app only. Its tokens are kept by
 * the server, so on a web server, even one on your own computer, they would
 * belong to whoever reaches it; OpenAI also offers it only to apps that run
 * locally. BETTER_VAULT_ALLOW_CHATGPT=false turns it off in the desktop app too.
 */
export function chatGPTAllowed(): boolean {
  return desktopRuntime && process.env.BETTER_VAULT_ALLOW_CHATGPT !== "false";
}

/** Checks a local provider address: http(s) only. */
export function parseBaseURL(value: string | undefined, fallback: string): URL {
  const url = new URL(value?.trim() || fallback);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("The server address must start with http:// or https://.");
  }
  return url;
}
