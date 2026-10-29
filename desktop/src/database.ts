import { app, BrowserWindow, ipcMain, type WebFrameMain } from "electron";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { backendMethods, writes, type BackendMethod } from "../../lib/db/backend";
import { createSqliteStore, type SyncBackend } from "../../lib/db/sqlite/store";

/**
 * Notebooks live in one SQLite file in the app's data folder. The window
 * reaches it through the `db` IPC channel; each call is one store method, run
 * here in the main process. After a write, every window is told which tables
 * changed, so its live queries run again.
 */
export function openDatabase(isTrusted: (frame: WebFrameMain | null) => boolean) {
  const file = path.join(app.getPath("userData"), "better-vault.sqlite");
  const db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL");
  const store = createSqliteStore(db);
  const allowed = new Set<string>(backendMethods);

  ipcMain.handle("db", (event, method: unknown, args: unknown) => {
    if (!isTrusted(event.senderFrame)) throw new Error("This page cannot use the database.");
    if (typeof method !== "string" || !allowed.has(method) || !Array.isArray(args))
      throw new Error("Unknown database call.");
    const run = store[method as BackendMethod] as (...a: unknown[]) => unknown;
    const result = run(...args);
    const changed = (writes as Partial<Record<BackendMethod, readonly string[]>>)[
      method as BackendMethod
    ];
    if (changed)
      for (const window of BrowserWindow.getAllWindows())
        window.webContents.send("db:changed", changed);
    return result;
  });

  return { file, store: store as SyncBackend, close: () => db.close() };
}
