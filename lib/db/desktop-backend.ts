import type { DesktopBridge } from "@/lib/desktop/bridge";
import { backendMethods, type Backend } from "./backend";

/** The desktop app's backend: each call runs in the main process, against SQLite. */
export function createDesktopBackend(bridge: DesktopBridge): Backend {
  return Object.fromEntries(
    backendMethods.map((method) => [method, (...args: unknown[]) => bridge.db.call(method, args)]),
  ) as unknown as Backend;
}
