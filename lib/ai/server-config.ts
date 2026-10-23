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

/** Checks a local provider address: http(s) only. */
export function parseBaseURL(value: string | undefined, fallback: string): URL {
  const url = new URL(value?.trim() || fallback);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("The server address must start with http:// or https://.");
  }
  return url;
}
