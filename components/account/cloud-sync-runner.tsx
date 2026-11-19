import { useEffect, useRef } from "react";
import { useAccount } from "@/lib/account/account";
import { syncNow, useCloudSync } from "@/lib/account/cloud-sync";
import { useSkills } from "@/lib/db/skills";
import { usePlugins } from "@/lib/db/plugins";

const EVERY_MS = 5 * 60 * 1000;
const AFTER_CHANGE_MS = 2000;

/**
 * Keeps a subscriber's skills and plugins in sync (lib/account/cloud-sync.ts):
 * when the app opens or a plan starts (so signing in restores them), when the
 * window comes back, every few minutes, and shortly after one changes here.
 */
export function CloudSyncRunner() {
  const account = useAccount();
  const sync = useCloudSync();
  const active = Boolean(account?.account.plan) && sync?.enabled !== false;
  const skills = useSkills();
  const plugins = usePlugins();
  const first = useRef(true);

  useEffect(() => {
    if (!active) return;
    void syncNow();
    const timer = window.setInterval(() => void syncNow(), EVERY_MS);
    const onFocus = () => void syncNow();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [active, account?.token]);

  // A local change goes up a moment later (several edits in a row, once).
  const stamp = [
    ...(skills ?? []).map((skill) => `${skill.id}:${skill.updatedAt}`),
    ...(plugins ?? []).map((plugin) => `${plugin.id}:${plugin.updatedAt}`),
  ].join("|");
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!active) return;
    const timer = window.setTimeout(() => void syncNow(), AFTER_CHANGE_MS);
    return () => window.clearTimeout(timer);
  }, [stamp, active]);

  return null;
}
