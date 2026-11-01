import { APICallError } from "ai";

/** Hides anything that looks like an API key before an error is shown or sent. */
export function redactSecrets(text: string): string {
  return text
    .replace(/\b(sk|pk|rk)-[A-Za-z0-9_-]{8,}/g, "[key]")
    .replace(/\bAIza[0-9A-Za-z_-]{20,}/g, "[key]")
    .replace(/\b[A-Za-z0-9_-]{32,}\b/g, "[key]");
}

/** What to tell people when their ChatGPT plan refuses a request (OpenAI's documented codes). */
const chatGPTErrors: [code: string, message: string][] = [
  [
    "subscription_sharing_usage_limit_exceeded",
    "You have reached a ChatGPT usage limit. Review it at chatgpt.com/settings/usage.",
  ],
  [
    "subscription_sharing_user_not_eligible",
    "This ChatGPT account or workspace can't use its plan in other apps. Use an API key instead.",
  ],
  [
    "subscription_sharing_unsupported_capability",
    "Your ChatGPT plan can't be used for this request. Try another model, or use an API key.",
  ],
  [
    "subscription_sharing_usage_unavailable",
    "ChatGPT could not check your usage just now. Try again in a moment.",
  ],
  [
    "subscription_sharing_user_unavailable",
    "ChatGPT is not available just now. Try again in a moment.",
  ],
  [
    "subscription_sharing_invalid_user",
    "ChatGPT did not accept this sign-in. Sign in with ChatGPT again in Settings.",
  ],
];

function chatGPTMessage(text: string | undefined): string | undefined {
  if (!text) return undefined;
  return chatGPTErrors.find(([code]) => text.includes(code))?.[1];
}

/** A short, human-readable reason for a failed provider call. */
export function describeError(error: unknown): string {
  let message: string;
  const plan = APICallError.isInstance(error)
    ? (chatGPTMessage(error.responseBody) ?? chatGPTMessage(error.message))
    : chatGPTMessage(error instanceof Error ? error.message : undefined);
  if (plan) return plan;
  if (APICallError.isInstance(error)) {
    message = error.message || `HTTP ${error.statusCode ?? "error"}`;
    if (error.statusCode === 401 || error.statusCode === 403) {
      message = `${error.statusCode}: ${message}`;
    }
  } else if (error instanceof Error) {
    message =
      error.name === "TimeoutError" ? "The provider did not answer in time." : error.message;
  } else {
    message = String(error);
  }
  return redactSecrets(message).slice(0, 500);
}
