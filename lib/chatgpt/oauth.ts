import { createHash, createPublicKey, randomBytes, verify, type JsonWebKey } from "node:crypto";

/**
 * Sign in with ChatGPT for open-source apps ("ChatGPT plan usage"), as OpenAI
 * documents it at https://developers.openai.com/siwc/token-sharing-open-source.
 * The tokens it issues are used like an API key on https://api.openai.com/v1.
 */
export const issuer = "https://auth.openai.com";
export const authorizeEndpoint = `${issuer}/api/accounts/authorize`;
export const tokenEndpoint = `${issuer}/api/accounts/oauth/token`;
const jwksEndpoint = `${issuer}/.well-known/jwks.json`;
const discoveryEndpoint = `${issuer}/.well-known/openid-configuration`;

export const resource = "https://api.openai.com/v1";
/** The scope that lets the app use the person's ChatGPT plan. */
export const planScope = "chatgpt.tokens.use.direct";
const scopes = `openid profile email offline_access resource.invoke ${planScope}`;
/** Used for the first sign-in; OpenAI then issues the app its own client id. */
export const registrationClientId = "dynamic_agent_client";
/** The name people see on the consent page and in ChatGPT's settings. */
export const agentName = "better-vault";

const TIMEOUT = 20_000;

export interface Pkce {
  verifier: string;
  challenge: string;
}

export function randomValue(): string {
  return randomBytes(32).toString("base64url");
}

export function createPkce(): Pkce {
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function authorizeUrl(options: {
  redirectUri: string;
  pkce: Pkce;
  state: string;
  nonce: string;
  hostId: string;
  /** The client id issued at an earlier sign-in. Without it, OpenAI registers one. */
  clientId?: string;
  loginHint?: string;
}): string {
  const params = new URLSearchParams({
    client_id: options.clientId ?? registrationClientId,
    ...(options.clientId ? {} : { agent_name_hint: agentName }),
    ext_agent_host_id: options.hostId,
    response_type: "code",
    redirect_uri: options.redirectUri,
    scope: scopes,
    resource,
    state: options.state,
    nonce: options.nonce,
    code_challenge_method: "S256",
    code_challenge: options.pkce.challenge,
    ...(options.loginHint ? { login_hint: options.loginHint } : {}),
  });
  return `${authorizeEndpoint}?${params}`;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  id_token?: string;
  expires_in?: number;
  scope?: string;
}

/** A refusal from the token endpoint, with OpenAI's machine-readable code. */
export class TokenError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
  ) {
    super(`ChatGPT refused the sign-in (${code}).`);
  }
}

/** Codes after which the saved refresh token can never work again. */
const unusableRefresh = new Set([
  "invalid_grant",
  "invalid_refresh_token",
  "token_expired",
  "refresh_token_expired",
  "refresh_token_invalidated",
  "refresh_token_reused",
]);

export function isUnusableRefresh(error: unknown): boolean {
  return error instanceof TokenError && unusableRefresh.has(error.code);
}

async function postForm(url: string, form: Record<string, string>): Promise<Response> {
  return fetch(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(form).toString(),
    signal: AbortSignal.timeout(TIMEOUT),
    cache: "no-store",
  });
}

async function tokenRequest(form: Record<string, string>): Promise<TokenResponse> {
  const response = await postForm(tokenEndpoint, form);
  if (!response.ok) {
    let code = `http_${response.status}`;
    try {
      const body = (await response.json()) as { error?: string | { code?: string } };
      code = (typeof body.error === "string" ? body.error : body.error?.code) ?? code;
    } catch {
      // Not JSON; the status will do.
    }
    throw new TokenError(code, response.status);
  }
  return (await response.json()) as TokenResponse;
}

export function exchangeCode(options: {
  code: string;
  clientId: string;
  redirectUri: string;
  verifier: string;
}): Promise<TokenResponse> {
  return tokenRequest({
    grant_type: "authorization_code",
    client_id: options.clientId,
    code: options.code,
    code_verifier: options.verifier,
    redirect_uri: options.redirectUri,
    resource,
  });
}

export function refreshTokens(clientId: string, refreshToken: string): Promise<TokenResponse> {
  return tokenRequest({
    grant_type: "refresh_token",
    client_id: clientId,
    refresh_token: refreshToken,
    resource,
  });
}

/** Ends the renewable session. Returns whether OpenAI confirmed it. */
export async function revokeRefreshToken(clientId: string, refreshToken: string): Promise<boolean> {
  try {
    const discovery = (await (
      await fetch(discoveryEndpoint, { signal: AbortSignal.timeout(TIMEOUT) })
    ).json()) as { revocation_endpoint?: string };
    if (!discovery.revocation_endpoint) return false;
    for (let attempt = 0; attempt < 3; attempt++) {
      const response = await postForm(discovery.revocation_endpoint, {
        token: refreshToken,
        token_type_hint: "refresh_token",
        client_id: clientId,
      });
      if (response.ok) return true;
      if (response.status < 500) return false;
      await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
    }
  } catch {
    // Offline: the caller still signs out here.
  }
  return false;
}

export interface IdTokenClaims {
  sub: string;
  email?: string;
  name?: string;
}

function decodePart<T>(part: string): T {
  return JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as T;
}

/**
 * Checks the ID token's signature against OpenAI's published keys, then its
 * issuer, audience, expiry and nonce.
 */
export async function verifyIdToken(
  token: string,
  clientId: string,
  nonce: string,
): Promise<IdTokenClaims> {
  const [head, body, signature] = token.split(".");
  if (!head || !body || !signature) throw new Error("ChatGPT returned an invalid ID token.");
  const header = decodePart<{ alg?: string; kid?: string }>(head);
  if (header.alg !== "RS256") throw new Error("ChatGPT returned an invalid ID token.");

  const jwks = (await (
    await fetch(jwksEndpoint, { signal: AbortSignal.timeout(TIMEOUT) })
  ).json()) as { keys: (JsonWebKey & { kid?: string })[] };
  const jwk = jwks.keys.find((key) => key.kid === header.kid);
  if (!jwk) throw new Error("ChatGPT returned an invalid ID token.");
  const valid = verify(
    "RSA-SHA256",
    Buffer.from(`${head}.${body}`),
    createPublicKey({ key: jwk, format: "jwk" }),
    Buffer.from(signature, "base64url"),
  );
  if (!valid) throw new Error("ChatGPT returned an invalid ID token.");

  const claims = decodePart<{
    iss?: string;
    aud?: string | string[];
    exp?: number;
    nonce?: string;
    sub?: string;
    email?: string;
    name?: string;
  }>(body);
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  const now = Date.now() / 1000;
  if (
    claims.iss !== issuer ||
    !audiences.includes(clientId) ||
    typeof claims.exp !== "number" ||
    claims.exp < now - 60 ||
    claims.nonce !== nonce ||
    typeof claims.sub !== "string" ||
    !claims.sub.trim()
  ) {
    throw new Error("ChatGPT returned an invalid ID token.");
  }
  return { sub: claims.sub, email: claims.email, name: claims.name };
}
