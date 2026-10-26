import { APICallError } from "ai";

/** Hides anything that looks like an API key before an error is shown or sent. */
export function redactSecrets(text: string): string {
  return text
    .replace(/\b(sk|pk|rk)-[A-Za-z0-9_-]{8,}/g, "[key]")
    .replace(/\bAIza[0-9A-Za-z_-]{20,}/g, "[key]")
    .replace(/\b[A-Za-z0-9_-]{32,}\b/g, "[key]");
}

/** A short, human-readable reason for a failed provider call. */
export function describeError(error: unknown): string {
  let message: string;
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
