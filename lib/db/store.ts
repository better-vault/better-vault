import { desktopBridge } from "@/lib/desktop/bridge";
import type { Backend } from "./backend";
import { createDesktopBackend } from "./desktop-backend";
import { createDexieBackend } from "./dexie-backend";

let current: Backend | undefined;

/** The store in use: SQLite in the desktop app, IndexedDB in a browser. */
export function store(): Backend {
  if (!current) {
    const bridge = desktopBridge();
    current = bridge ? createDesktopBackend(bridge) : createDexieBackend();
  }
  return current;
}

/** Replaces the store. Only for tests, which run the same suite on each backend. */
export function setStoreForTests(backend: Backend) {
  current = backend;
}
