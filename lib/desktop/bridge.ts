import type { BackendMethod, TableName } from "@/lib/db/backend";

/** Where the desktop app's updater is (desktop/src/updates.ts). */
export type UpdateState =
  /** Not checked yet, or updates are off (a development build). */
  | { status: "idle"; supported: boolean }
  | { status: "checking" }
  | { status: "upToDate"; checkedAt: number }
  /** A newer version is out; the person chooses to download it. */
  | { status: "available"; version: string }
  | { status: "downloading"; version: string; percent: number }
  /** Downloaded; a restart installs it. */
  | { status: "ready"; version: string }
  | { status: "error"; message: string };

/** One call an agent made through MCP, for Settings → MCP. */
export interface McpActivity {
  client: string;
  tool: string;
  at: number;
}

/** The desktop app's MCP server (desktop/src/mcp.ts), as Settings → MCP shows it. */
export interface McpState {
  enabled: boolean;
  running: boolean;
  port: number;
  url: string;
  token: string;
  readOnly: boolean;
  allowNotes: boolean;
  allowSkills: boolean;
  /** Why it could not start, such as the port being taken. */
  error: string | null;
  activity: McpActivity[];
}

/**
 * What the desktop app's preload script (`desktop/src/preload.ts`) puts on
 * `window.betterVault`. On the web it is missing.
 */
export interface DesktopBridge {
  /** The desktop app's version. */
  version: string;
  /** The system it runs on (Node's `process.platform`), for shortcut labels. */
  platform: string;
  db: {
    /** Runs one backend method in the main process, against the SQLite file. */
    call(method: BackendMethod, args: unknown[]): Promise<unknown>;
    /** Called with the tables a write changed, from any window. Returns an unsubscribe. */
    onChange(listener: (tables: TableName[]) => void): () => void;
  };
  updates: {
    state(): Promise<UpdateState>;
    /** Called with every new state. Returns an unsubscribe. */
    onState(listener: (state: UpdateState) => void): () => void;
    check(): Promise<void>;
    download(): Promise<void>;
    /** Quits, installs the downloaded update and opens the app again. */
    install(): Promise<void>;
    /** Called when the app menu's "Check for Updates…" is chosen. Returns an unsubscribe. */
    onOpen(listener: () => void): () => void;
  };
  mcp: {
    state(): Promise<McpState>;
    onState(listener: (state: McpState) => void): () => void;
    update(
      patch: Partial<Pick<McpState, "enabled" | "port" | "readOnly" | "allowNotes" | "allowSkills">>,
    ): Promise<McpState>;
    regenerateToken(): Promise<McpState>;
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
