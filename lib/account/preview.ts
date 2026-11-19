import type { AccountState } from "./account";
import type { CloudSyncState } from "./cloud-sync";

/**
 * A look at what a subscriber sees, without a plan: in development only,
 * `?preview=subscribed` in the address shows Settings → Subscription and
 * the welcome dialog with the sample account below. Nothing is saved, and
 * the actions only say it's a preview. Production builds never show it.
 */
export function subscriptionPreview(): boolean {
  if (!import.meta.env.DEV || typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("preview") === "subscribed";
}

const DAY = 24 * 60 * 60 * 1000;

export function previewAccount(real: AccountState | null | undefined): AccountState {
  const now = Date.now();
  return {
    token: "preview",
    user: real?.user ?? {
      id: "preview",
      email: "you@example.com",
      name: "You",
      username: null,
      image: null,
    },
    account: {
      plan: "pro",
      status: "active",
      periodStart: new Date(now - 12 * DAY).toISOString(),
      periodEnd: new Date(now + 18 * DAY).toISOString(),
      cancelAtPeriodEnd: false,
      credits: { included: 1250, used: 437.25 },
      storage: { included: 20 * 1024 ** 3, used: 3.4 * 1024 ** 3 },
      overage: { enabled: false, capCents: 1000 },
    },
    checkedAt: now,
    welcomed: null,
    subscriptions: "open",
  };
}

export function previewSync(): CloudSyncState {
  return {
    enabled: true,
    lastPulled: { skill: 0, plugin: 0 },
    known: { skill: {}, plugin: {} },
    syncedAt: Date.now() - 2 * 60 * 1000,
    error: null,
  };
}
