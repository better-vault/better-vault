import { useStoreQuery } from "@/lib/db/live";
import { getSettings, updateProvider } from "@/lib/db/settings";
import { store } from "@/lib/db/store";
import { desktopBridge } from "@/lib/desktop/bridge";
import { BACKEND_URL } from "./config";

/**
 * The optional better-vault account: who is signed in, and their plan. Only
 * the session token and what /v1/me says are kept, on this device. The
 * user's own AI keys stay in their provider settings and never go to the
 * backend; Better Vault AI is a provider of its own whose "key" is this
 * session.
 */
export interface AccountUser {
  id: string;
  email: string;
  name: string;
  username: string | null;
  image: string | null;
}

export interface AccountPlan {
  plan: "pro" | "max" | null;
  status: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  credits: { included: number; used: number };
  storage: { included: number; used: number };
  overage: { enabled: boolean; capCents: number };
}

export interface AccountState {
  token: string;
  user: AccountUser;
  account: AccountPlan;
  /** When it was last read from the backend. */
  checkedAt: number;
  /** The plan the welcome dialog last thanked the user for. */
  welcomed: string | null;
  /** "soon" while plans can't be bought yet (the backend says which). */
  subscriptions?: "open" | "soon";
}

type Me = { user: AccountUser; account: AccountPlan; subscriptions?: "open" | "soon" };

/** Whether plans can be bought yet. Without an account, or from an older backend, they can't. */
export function subscriptionsOpen(state: AccountState | null | undefined): boolean {
  return state?.subscriptions === "open";
}

const KEY = "account";

export async function getAccount(): Promise<AccountState | null> {
  return ((await store().getSetting(KEY)) as AccountState | undefined) ?? null;
}

export function useAccount(): AccountState | null | undefined {
  return useStoreQuery(getAccount, [], ["settings"]);
}

async function api<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${BACKEND_URL}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      ...init.headers,
    },
  });
  const body = (await response.json().catch(() => ({}))) as T & {
    error?: string;
    message?: string;
  };
  if (!response.ok)
    throw new Error(
      body.error ?? body.message ?? `The account service answered ${response.status}.`,
    );
  return body;
}

/** Turns Better Vault AI on (with the session as its key) while a plan is active, off otherwise. */
async function syncProvider(state: AccountState | null) {
  const active = !!state?.account.plan;
  const settings = await getSettings();
  const current = settings.providers.bettervault;
  if (current.enabled === active && current.apiKey === (active ? state!.token : "")) return;
  await updateProvider("bettervault", {
    enabled: active,
    apiKey: active ? state!.token : "",
    models: active ? ["better-vault"] : [],
  });
}

/** Reads the account and plan again. Returns null (and signs out here) when the session has ended. */
export async function refreshAccount(): Promise<AccountState | null> {
  const saved = await getAccount();
  if (!saved) return null;
  try {
    const { user, account, subscriptions } = await api<Me>("/v1/me", saved.token);
    const next: AccountState = { ...saved, user, account, subscriptions, checkedAt: Date.now() };
    await store().putSetting(KEY, next);
    await syncProvider(next);
    return next;
  } catch (error) {
    if (error instanceof Error && /401|Not signed in/.test(error.message)) {
      await forget();
      return null;
    }
    throw error;
  }
}

async function forget() {
  await store().putSetting(KEY, null);
  await syncProvider(null);
}

/** Opens the backend's sign-in page and waits for the token it hands back. */
async function obtainToken(mode: "signin" | "signup"): Promise<string> {
  const bridge = desktopBridge();
  if (bridge?.account) return bridge.account.signIn(mode);
  // A long random state: the app alone knows it, and collects its token with it.
  const state = `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, "");
  const url = `${BACKEND_URL}/v1/login?${new URLSearchParams({ return: window.location.origin, state, mode })}`;
  const popup = window.open(url, "better-vault-sign-in", "width=480,height=720");
  if (!popup) throw new Error("popup-blocked");
  return new Promise<string>((resolve, reject) => {
    const backend = new URL(BACKEND_URL).origin;
    let finished = false;
    const done = (token: string | null) => {
      if (finished) return;
      finished = true;
      clearInterval(timer);
      window.removeEventListener("message", onMessage);
      if (token) resolve(token);
      else reject(new Error("cancelled"));
    };
    // The popup can say so directly, unless visiting Google's page cut it off from this window…
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; token?: string; state?: string };
      if (event.origin !== backend || data?.type !== "better-vault-auth" || data.state !== state)
        return;
      done(data.token ?? null);
    };
    // …so the token also waits at the backend, collected here with the state.
    let closedAt: number | null = null;
    const timer = setInterval(async () => {
      try {
        const response = await fetch(
          `${BACKEND_URL}/v1/login/claim?${new URLSearchParams({ state })}`,
        );
        const body = (await response.json().catch(() => ({}))) as { token?: string };
        if (body.token) return done(body.token);
      } catch {
        // Offline for a moment: try again on the next tick.
      }
      // A closed window gets a few more seconds, for a token saved just before it closed.
      if (popup.closed) {
        closedAt ??= Date.now();
        if (Date.now() - closedAt > 4000) done(null);
      }
    }, 1200);
    window.addEventListener("message", onMessage);
  });
}

export async function signIn(mode: "signin" | "signup" = "signin"): Promise<AccountState> {
  const token = await obtainToken(mode);
  const { user, account, subscriptions } = await api<Me>("/v1/me", token);
  const previous = await getAccount();
  const state: AccountState = {
    token,
    user,
    account,
    checkedAt: Date.now(),
    welcomed: previous?.user.id === user.id ? previous.welcomed : account.plan,
    subscriptions,
  };
  await store().putSetting(KEY, state);
  await syncProvider(state);
  return state;
}

export async function signOut(): Promise<void> {
  const saved = await getAccount();
  if (saved)
    await api("/api/auth/sign-out", saved.token, { method: "POST", body: "{}" }).catch(() => {});
  await forget();
}

/** Opens Polar's checkout for a plan, in the browser. */
export async function startCheckout(plan: "pro" | "max"): Promise<void> {
  const saved = await getAccount();
  if (!saved) throw new Error("Sign in first.");
  const returnUrl = desktopBridge()
    ? "https://better-vault.dev/subscribed"
    : `${window.location.origin}/?subscribed=1`;
  const { url } = await api<{ url: string }>("/v1/billing/checkout", saved.token, {
    method: "POST",
    body: JSON.stringify({ plan, returnUrl }),
  });
  window.open(url, "_blank", "noopener");
}

/** Polar's customer portal: change plan, invoices, cancel. */
export async function openPortal(): Promise<void> {
  const saved = await getAccount();
  if (!saved) throw new Error("Sign in first.");
  const { url } = await api<{ url: string }>("/v1/billing/portal", saved.token, {
    method: "POST",
    body: "{}",
  });
  window.open(url, "_blank", "noopener");
}

export async function setOverage(enabled: boolean, capCents: number): Promise<void> {
  const saved = await getAccount();
  if (!saved) return;
  const { account } = await api<{ account: AccountPlan }>("/v1/billing/overage", saved.token, {
    method: "POST",
    body: JSON.stringify({ enabled, capCents }),
  });
  await store().putSetting(KEY, { ...saved, account, checkedAt: Date.now() });
}

/** Marks the current plan as thanked for, so the welcome dialog shows once per new plan. */
export async function markWelcomed(): Promise<void> {
  const saved = await getAccount();
  if (saved) await store().putSetting(KEY, { ...saved, welcomed: saved.account.plan });
}

export async function usernameAvailable(username: string): Promise<boolean> {
  const response = await fetch(
    `${BACKEND_URL}/v1/username/available?${new URLSearchParams({ username })}`,
  );
  const body = (await response.json().catch(() => ({}))) as { available?: boolean };
  return body.available === true;
}

export async function setUsername(username: string): Promise<void> {
  const saved = await getAccount();
  if (!saved) throw new Error("Sign in first.");
  await api("/api/auth/update-user", saved.token, {
    method: "POST",
    body: JSON.stringify({ username }),
  });
  await refreshAccount();
}
