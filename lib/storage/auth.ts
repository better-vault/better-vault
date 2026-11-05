import { desktopBridge } from "@/lib/desktop/bridge";
import type { OAuthService } from "./apps";
import type { StorageAccount } from "./desktop-oauth";
import {
  dropGoogleToken,
  forgetGoogle,
  forgetMicrosoft,
  googleAccessToken,
  microsoftAccessToken,
  microsoftSignIn,
  webAccount,
} from "./web-oauth";

/**
 * Signing in to Google Drive and OneDrive, the same way for the page in both
 * apps: the desktop app asks its main process (`/api/storage/oauth`), the
 * web app signs in in the browser (lib/storage/web-oauth.ts).
 */
async function desktopCall<T>(body: object): Promise<T> {
  const response = await fetch("/api/storage/oauth", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const answer = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(answer.error ?? response.statusText);
  return answer;
}

/** Signs in and answers who did. */
export async function connect(service: OAuthService): Promise<StorageAccount> {
  if (desktopBridge()) {
    const { id, url } = await desktopCall<{ id: string; url: string }>({
      action: "start",
      service,
    });
    window.open(url, "_blank");
    // The person signs in in their browser; ask how it is going.
    for (;;) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const state = await desktopCall<{ status: string; account?: StorageAccount; error?: string }>(
        {
          action: "poll",
          id,
        },
      );
      if (state.status === "done" && state.account) return state.account;
      if (state.status === "failed") throw new Error(state.error ?? "Sign-in failed.");
      if (state.status === "idle") throw new Error("Sign-in was cancelled or took too long.");
    }
  }
  const token = service === "google" ? await googleAccessToken("consent") : await microsoftSignIn();
  return webAccount(service, token);
}

/** Forgets an access token the service refused (web only; the desktop app refreshes its own). */
export function dropAccessToken(service: OAuthService) {
  if (!desktopBridge() && service === "google") dropGoogleToken();
}

/** An access token for the service's API, signing in again if needed. */
export async function accessToken(service: OAuthService): Promise<string> {
  if (desktopBridge())
    return (await desktopCall<{ accessToken: string }>({ action: "token", service })).accessToken;
  return service === "google" ? googleAccessToken() : microsoftAccessToken();
}

export async function disconnect(service: OAuthService) {
  if (desktopBridge()) {
    await desktopCall({ action: "signOut", service });
    return;
  }
  if (service === "google") forgetGoogle();
  else forgetMicrosoft();
}
