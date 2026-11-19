import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { asBackend, createSqliteStore } from "@/lib/db/sqlite/store";
import { setStoreForTests, store } from "@/lib/db/store";
import type { Backend } from "@/lib/db/backend";
import type { Skill } from "@/lib/db/types";
import { parsePluginBundle } from "@/lib/plugins/manifest";
import { installPlugin, setPluginEnabled } from "@/lib/db/plugins";
import { getCloudSync, syncNow } from "./cloud-sync";

/** The backend's /v1/sync, in memory: newest updatedAt wins, pulls by receive time. */
function fakeServer() {
  const rows = new Map<
    string,
    { id: string; updatedAt: number; changedAt: number; deleted: boolean; data: unknown }
  >();
  let clock = 1_000;
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const type = url.pathname.split("/").pop()!;
    if (!init?.method || init.method === "GET") {
      const since = Number(url.searchParams.get("since") ?? 0);
      const now = ++clock;
      const records = [...rows.entries()]
        .filter(([key, row]) => key.startsWith(`${type}:`) && row.changedAt > since)
        .map(([, row]) => ({
          id: row.id,
          updatedAt: row.updatedAt,
          deleted: row.deleted,
          data: row.deleted ? undefined : row.data,
        }));
      return Response.json({ records, now });
    }
    const { records } = JSON.parse(String(init.body)) as {
      records: { id: string; updatedAt: number; deleted?: boolean; data?: unknown }[];
    };
    for (const record of records) {
      const key = `${type}:${record.id}`;
      const existing = rows.get(key);
      if (existing && existing.updatedAt >= record.updatedAt) continue;
      rows.set(key, {
        id: record.id,
        updatedAt: record.updatedAt,
        changedAt: ++clock,
        deleted: record.deleted === true,
        data: record.data ?? null,
      });
    }
    return Response.json({ saved: records.length });
  };
}

const devices: Backend[] = [];
const on = (index: number) => setStoreForTests(devices[index]);

async function signedIn() {
  await store().putSetting("account", {
    token: "t",
    user: { id: "u", email: "a@b.c", name: "A", username: null, image: null },
    account: { plan: "pro" },
    checkedAt: 0,
    welcomed: null,
  });
}

const skill = (id: string, body: string, updatedAt: number): Skill => ({
  id,
  vaultId: "default",
  name: id,
  description: "",
  body,
  updatedBy: "you",
  createdAt: 1,
  updatedAt,
});

beforeEach(async () => {
  devices.length = 0;
  for (let i = 0; i < 2; i++)
    devices.push(asBackend(createSqliteStore(new DatabaseSync(":memory:"))));
  vi.stubGlobal("fetch", vi.fn(fakeServer()));
  for (let i = 0; i < 2; i++) {
    on(i);
    await signedIn();
  }
});
afterEach(() => vi.unstubAllGlobals());

describe("cloud sync", () => {
  it("brings skills to another device, with edits and deletes", async () => {
    on(0);
    await store().putSkill(skill("summaries", "Be brief.", 10));
    await syncNow();
    on(1);
    await syncNow();
    expect((await store().getSkill("summaries"))?.body).toBe("Be brief.");

    // An edit on the second device wins over the older copy.
    await store().putSkill(skill("summaries", "Use bullets.", 20));
    await syncNow();
    on(0);
    await syncNow();
    expect((await store().getSkill("summaries"))?.body).toBe("Use bullets.");

    // A delete reaches the other device.
    await store().deleteSkill("summaries");
    await syncNow();
    on(1);
    await syncNow();
    expect(await store().getSkill("summaries")).toBeUndefined();
    expect((await getCloudSync()).error).toBeNull();
  });

  it("brings plugins turned off, and leaves another device's choice alone", async () => {
    on(0);
    const parsed = parsePluginBundle({
      manifest: {
        manifestVersion: 1,
        id: "stats",
        name: "Stats",
        version: "1.0.0",
        permissions: ["read:sources"],
        contributes: { panels: [{ id: "p", title: "P", slot: "studio" }] },
      },
      files: { "index.html": "<p>hi</p>" },
    });
    if (!parsed.ok) throw new Error(parsed.error);
    await installPlugin(parsed.bundle);
    await setPluginEnabled("stats", true, ["read:sources"]);
    await syncNow();
    on(1);
    await syncNow();
    expect(await store().getPlugin("stats")).toMatchObject({ enabled: false, granted: [] });
  });

  it("does nothing without a plan, or when turned off", async () => {
    on(0);
    await store().putSetting("account", null);
    await syncNow();
    expect(fetch).not.toHaveBeenCalled();
    await signedIn();
    await store().putSetting("cloudSync", { enabled: false });
    await syncNow();
    expect(fetch).not.toHaveBeenCalled();
  });
});
