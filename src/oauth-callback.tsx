import { useEffect } from "react";

/**
 * Where a sign-in popup lands (lib/storage/web-oauth.ts): it hands the code
 * to the page that opened it and closes. Nothing here is shown for long.
 */
export function OAuthCallback() {
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const channel = new BroadcastChannel("better-vault-oauth");
    channel.postMessage({
      state: params.get("state") ?? undefined,
      code: params.get("code") ?? undefined,
      error: params.get("error_description") ?? params.get("error") ?? undefined,
    });
    channel.close();
    window.close();
  }, []);
  return null;
}
