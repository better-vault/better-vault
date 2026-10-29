import type { BackendMethod, TableName } from "@/lib/db/backend";

/**
 * What the desktop app's preload script (`desktop/src/preload.ts`) puts on
 * `window.betterVault`. On the web it is missing.
 */
export interface DesktopBridge {
  /** The desktop app's version. */
  version: string;
  db: {
    /** Runs one backend method in the main process, against the SQLite file. */
    call(method: BackendMethod, args: unknown[]): Promise<unknown>;
    /** Called with the tables a write changed, from any window. Returns an unsubscribe. */
    onChange(listener: (tables: TableName[]) => void): () => void;
  };
}

declare global {
  interface Window {
    betterVault?: DesktopBridge;
  }
}

/** The desktop bridge, or `undefined` in a browser or on the server. */
export function desktopBridge(): DesktopBridge | undefined {
  return typeof window === "undefined" ? undefined : window.betterVault;
}
