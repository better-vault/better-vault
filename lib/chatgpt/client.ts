/**
 * The page's side of Sign in with ChatGPT: it asks the local server
 * (`server/routes/chatgpt.ts`), which holds the tokens. Safe to import in the browser.
 */
export interface ChatGPTAccount {
  email: string;
  name: string;
  /** Whether the person allowed better-vault to use their ChatGPT plan. */
  planUsage: boolean;
}

export type ChatGPTLoginState =
  | { status: "idle" }
  | { status: "waiting"; id: string }
  | { status: "done"; id: string; account: ChatGPTAccount }
  | { status: "failed"; id: string; error: string };

/** Where people review and limit what apps use of their plan. */
export const chatGPTUsageUrl = "https://chatgpt.com/settings/usage";

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const response = await fetch("/api/chatgpt", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(result.error ?? response.statusText);
  return result;
}

/** Who is signed in, and whether this server offers the sign-in at all. */
export function chatGPTStatus() {
  return call<{
    account: ChatGPTAccount | null;
    available: boolean;
    /** Why it is unavailable: a web app ("desktopOnly"), or turned off in the desktop app. */
    reason?: "desktopOnly" | "off";
  }>({ action: "status" });
}

export function startChatGPTLogin(newAccount: boolean) {
  return call<{ id: string; url: string }>({ action: "start", newAccount });
}

export function pollChatGPTLogin(id: string) {
  return call<ChatGPTLoginState>({ action: "poll", id });
}

export function cancelChatGPTLogin() {
  return call<{ ok: true }>({ action: "cancel" });
}

/** Resolves to whether ChatGPT confirmed the end of the session. */
export async function signOutChatGPT(): Promise<boolean> {
  return (await call<{ revoked: boolean }>({ action: "signOut" })).revoked;
}

/** A short label for the account: its email, else its name. */
export function accountLabel(account: { email: string; name: string }): string {
  return account.email || account.name;
}
