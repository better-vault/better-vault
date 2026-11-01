import {
  isUnusableRefresh,
  planScope,
  refreshTokens,
  revokeRefreshToken,
  type TokenResponse,
} from "./oauth";
import { readAuth, writeAuth, type ChatGPTTokens } from "./store";

import type { ChatGPTAccount } from "./client";

export class ChatGPTSignInNeeded extends Error {
  constructor() {
    super("Sign in with ChatGPT again in Settings → AI providers → OpenAI.");
  }
}

export function tokensFrom(response: TokenResponse, previous?: ChatGPTTokens): ChatGPTTokens {
  return {
    accessToken: response.access_token,
    refreshToken: response.refresh_token || previous?.refreshToken || "",
    idToken: response.id_token || previous?.idToken || "",
    expiresAt: Date.now() + (response.expires_in ?? 3600) * 1000,
    scopes: response.scope?.split(" ").filter(Boolean) ?? previous?.scopes ?? [],
  };
}

export async function currentAccount(): Promise<ChatGPTAccount | null> {
  const { registration, tokens } = await readAuth();
  if (!registration || !tokens) return null;
  return {
    email: registration.email,
    name: registration.name,
    planUsage: tokens.scopes.includes(planScope),
  };
}

// One refresh at a time: OpenAI rotates the refresh token on every use.
const globalState = globalThis as typeof globalThis & { __bvChatGPTRefresh?: Promise<string> };

/** A valid access token for the signed-in account, refreshed when it is near expiry. */
export async function accessToken(): Promise<string> {
  const { tokens } = await readAuth();
  if (!tokens) throw new ChatGPTSignInNeeded();
  if (!tokens.scopes.includes(planScope))
    throw new Error("Allow better-vault to use your ChatGPT plan: sign in with ChatGPT again.");
  if (tokens.expiresAt - Date.now() > 5 * 60_000) return tokens.accessToken;

  globalState.__bvChatGPTRefresh ??= refresh().finally(() => {
    globalState.__bvChatGPTRefresh = undefined;
  });
  return globalState.__bvChatGPTRefresh;
}

async function refresh(): Promise<string> {
  const auth = await readAuth();
  if (!auth.registration || !auth.tokens) throw new ChatGPTSignInNeeded();
  // Another request may have refreshed it while this one waited.
  if (auth.tokens.expiresAt - Date.now() > 5 * 60_000) return auth.tokens.accessToken;
  try {
    const response = await refreshTokens(auth.registration.clientId, auth.tokens.refreshToken);
    const tokens = tokensFrom(response, auth.tokens);
    await writeAuth({ ...auth, tokens });
    return tokens.accessToken;
  } catch (error) {
    if (isUnusableRefresh(error)) {
      await writeAuth({ ...auth, tokens: null });
      throw new ChatGPTSignInNeeded();
    }
    throw error;
  }
}

/**
 * Signs out: ends the session at OpenAI, then forgets the tokens. The account
 * and its client id are kept, so the next sign-in is the same registration.
 * Returns whether OpenAI confirmed the end of the session.
 */
export async function signOut(): Promise<boolean> {
  const auth = await readAuth();
  let confirmed = true;
  if (auth.registration && auth.tokens?.refreshToken) {
    confirmed = await revokeRefreshToken(auth.registration.clientId, auth.tokens.refreshToken);
  }
  await writeAuth({ ...auth, tokens: null });
  return confirmed;
}
