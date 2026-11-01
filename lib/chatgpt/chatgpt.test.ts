import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { mkdtemp, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { generateText, Output, wrapLanguageModel } from "ai";
import { convertArrayToReadableStream, MockLanguageModelV4 } from "ai/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { loginState, startLogin } from "./login";
import { planRules } from "./model";
import { authorizeUrl, createPkce, planScope, registrationClientId } from "./oauth";
import { accessToken, currentAccount, signOut } from "./session";
import { hostId, readAuth, writeAuth } from "./store";

let dir: string;
const realFetch = globalThis.fetch;

beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "bv-chatgpt-"));
  process.env.BETTER_VAULT_DATA_DIR = dir;
});

afterEach(async () => {
  globalThis.fetch = realFetch;
  vi.useRealTimers();
  delete process.env.BETTER_VAULT_DATA_DIR;
  await rm(dir, { recursive: true, force: true });
});

describe("authorization request", () => {
  it("registers the app on the first sign-in", () => {
    const pkce = createPkce();
    const url = new URL(
      authorizeUrl({
        redirectUri: "http://127.0.0.1:1455/auth/callback",
        pkce,
        state: "s",
        nonce: "n",
        hostId: "urn:uuid:host",
      }),
    );
    expect(url.origin + url.pathname).toBe("https://auth.openai.com/api/accounts/authorize");
    const params = url.searchParams;
    expect(params.get("client_id")).toBe(registrationClientId);
    expect(params.get("agent_name_hint")).toBe("better-vault");
    expect(params.get("ext_agent_host_id")).toBe("urn:uuid:host");
    expect(params.get("scope")?.split(" ")).toContain(planScope);
    expect(params.get("resource")).toBe("https://api.openai.com/v1");
    expect(params.get("code_challenge_method")).toBe("S256");
    expect(params.get("code_challenge")).toBe(
      createHash("sha256").update(pkce.verifier).digest("base64url"),
    );
  });

  it("reuses the issued client id afterwards, without the name hint", () => {
    const params = new URL(
      authorizeUrl({
        redirectUri: "http://127.0.0.1:1455/auth/callback",
        pkce: createPkce(),
        state: "s",
        nonce: "n",
        hostId: "urn:uuid:host",
        clientId: "oaiapp_123",
        loginHint: "a@example.com",
      }),
    ).searchParams;
    expect(params.get("client_id")).toBe("oaiapp_123");
    expect(params.has("agent_name_hint")).toBe(false);
    expect(params.get("login_hint")).toBe("a@example.com");
  });
});

describe("store", () => {
  it("keeps one host id, and writes files only the owner can read", async () => {
    const first = await hostId();
    expect(first).toMatch(/^urn:uuid:[0-9a-f-]{36}$/);
    expect(await hostId()).toBe(first);
    await writeAuth({ registration: null, tokens: null });
    const mode = (await stat(path.join(dir, "chatgpt-auth.json"))).mode & 0o777;
    if (process.platform !== "win32") expect(mode).toBe(0o600);
  });
});

/** A fake auth.openai.com: signs ID tokens with its own key and answers the token endpoint. */
function fakeOpenAI(options: { sub?: string; scope?: string } = {}) {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const jwk = { ...publicKey.export({ format: "jwk" }), kid: "k1", alg: "RS256", use: "sig" };
  const calls: URLSearchParams[] = [];
  let nonce = "";
  const idToken = (clientId: string) => {
    const head = Buffer.from(JSON.stringify({ alg: "RS256", kid: "k1" })).toString("base64url");
    const body = Buffer.from(
      JSON.stringify({
        iss: "https://auth.openai.com",
        aud: clientId,
        exp: Math.floor(Date.now() / 1000) + 3600,
        nonce,
        sub: options.sub ?? "user-1",
        email: "a@example.com",
        name: "Ada",
      }),
    ).toString("base64url");
    const signature = sign("RSA-SHA256", Buffer.from(`${head}.${body}`), privateKey);
    return `${head}.${body}.${signature.toString("base64url")}`;
  };
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.startsWith("http://127.0.0.1")) return realFetch(input, init);
    if (url.endsWith("/.well-known/jwks.json")) return Response.json({ keys: [jwk] });
    if (url.endsWith("/.well-known/openid-configuration"))
      return Response.json({ revocation_endpoint: "https://auth.openai.com/oauth/revoke" });
    if (url.endsWith("/oauth/revoke")) return new Response(null, { status: 200 });
    if (url.endsWith("/api/accounts/oauth/token")) {
      const form = new URLSearchParams(String(init?.body));
      calls.push(form);
      return Response.json({
        access_token: `access-${calls.length}`,
        refresh_token: `refresh-${calls.length}`,
        id_token: idToken(form.get("client_id") ?? ""),
        expires_in: 3600,
        scope: options.scope ?? `openid profile email offline_access resource.invoke ${planScope}`,
      });
    }
    throw new Error(`Unexpected request to ${url}`);
  }) as typeof fetch;
  return {
    calls,
    setNonce(value: string) {
      nonce = value;
    },
  };
}

async function signIn(fake: ReturnType<typeof fakeOpenAI>, clientIdOnCallback = "oaiapp_new") {
  const { id, url } = await startLogin(false);
  const params = new URL(url).searchParams;
  fake.setNonce(params.get("nonce") ?? "");
  const callback = new URL(params.get("redirect_uri") ?? "");
  callback.searchParams.set("code", "the-code");
  callback.searchParams.set("state", params.get("state") ?? "");
  callback.searchParams.set("client_id", clientIdOnCallback);
  const page = await realFetch(callback);
  return { id, params, page };
}

describe("sign-in", () => {
  it("receives the redirect, checks the ID token and keeps the tokens on the server", async () => {
    const fake = fakeOpenAI();
    const { id, params, page } = await signIn(fake);
    expect(page.status).toBe(200);
    expect(params.get("client_id")).toBe(registrationClientId);

    const state = loginState(id);
    expect(state).toMatchObject({
      status: "done",
      account: { email: "a@example.com", name: "Ada", planUsage: true },
    });
    const exchange = fake.calls[0];
    expect(exchange.get("grant_type")).toBe("authorization_code");
    expect(exchange.get("client_id")).toBe("oaiapp_new");
    expect(exchange.get("code_verifier")).toBeTruthy();
    expect(exchange.get("resource")).toBe("https://api.openai.com/v1");

    expect(await currentAccount()).toEqual({
      email: "a@example.com",
      name: "Ada",
      planUsage: true,
    });
    expect(await accessToken()).toBe("access-1");

    // The next sign-in uses the issued client id.
    const again = await signIn(fake);
    expect(again.params.get("client_id")).toBe("oaiapp_new");
  });

  it("refuses a callback with the wrong state", async () => {
    fakeOpenAI();
    const { id, url } = await startLogin(false);
    const callback = new URL(new URL(url).searchParams.get("redirect_uri") ?? "");
    callback.searchParams.set("code", "c");
    callback.searchParams.set("state", "forged");
    expect((await realFetch(callback)).status).toBe(400);
    expect(loginState(id).status).toBe("waiting");
  });

  it("reports a declined consent", async () => {
    fakeOpenAI();
    const { id, url } = await startLogin(false);
    const params = new URL(url).searchParams;
    const callback = new URL(params.get("redirect_uri") ?? "");
    callback.searchParams.set("error", "access_denied");
    callback.searchParams.set("state", params.get("state") ?? "");
    await realFetch(callback);
    expect(loginState(id)).toMatchObject({ status: "failed" });
    expect(await readAuth()).toEqual({ registration: null, tokens: null });
  });

  it("will not use a plan the person did not allow", async () => {
    const fake = fakeOpenAI({ scope: "openid profile email offline_access" });
    await signIn(fake);
    expect((await currentAccount())?.planUsage).toBe(false);
    await expect(accessToken()).rejects.toThrow(/Allow better-vault/);
  });

  it("refreshes an expiring token once, and signs out keeping the registration", async () => {
    const fake = fakeOpenAI();
    await signIn(fake);
    const auth = await readAuth();
    await writeAuth({ ...auth, tokens: { ...auth.tokens!, expiresAt: Date.now() + 1000 } });

    const tokens = await Promise.all([accessToken(), accessToken(), accessToken()]);
    expect(new Set(tokens)).toEqual(new Set(["access-2"]));
    expect(fake.calls.filter((call) => call.get("grant_type") === "refresh_token")).toHaveLength(1);
    expect(fake.calls[1].get("refresh_token")).toBe("refresh-1");

    expect(await signOut()).toBe(true);
    const after = await readAuth();
    expect(after.tokens).toBeNull();
    expect(after.registration?.clientId).toBe("oaiapp_new");
    expect(await currentAccount()).toBeNull();
  });
});

describe("plan rules", () => {
  function streamingModel() {
    return new MockLanguageModelV4({
      doStream: {
        stream: convertArrayToReadableStream([
          { type: "stream-start", warnings: [] },
          { type: "response-metadata", id: "r1", modelId: "gpt-x" },
          { type: "text-start", id: "t" },
          { type: "text-delta", id: "t", delta: '{"answer":' },
          { type: "text-delta", id: "t", delta: '"yes"}' },
          { type: "text-end", id: "t" },
          {
            type: "finish",
            finishReason: { unified: "stop", raw: "stop" },
            usage: {
              inputTokens: { total: 3, noCache: 3, cacheRead: 0, cacheWrite: 0 },
              outputTokens: { total: 2, text: 2, reasoning: 0 },
            },
          },
        ]),
      },
    });
  }

  it("streams even a whole answer, unstored and without rejected settings", async () => {
    const mock = streamingModel();
    const model = wrapLanguageModel({ model: mock, middleware: planRules });
    const { output } = await generateText({
      model,
      output: Output.object({ schema: z.object({ answer: z.string() }) }),
      prompt: "Yes?",
      temperature: 0.2,
      maxOutputTokens: 100,
    });
    expect(output).toEqual({ answer: "yes" });
    const call = mock.doStreamCalls[0];
    expect(call.temperature).toBeUndefined();
    expect(call.maxOutputTokens).toBeUndefined();
    expect(call.providerOptions?.openai).toMatchObject({
      store: false,
      systemMessageMode: "developer",
    });
  });
});
