import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { TableName } from "../../../lib/db/backend";
import type { SyncBackend } from "../../../lib/db/sqlite/store";
import { sameName } from "../../../lib/notes/syntax";

/** What agents may change, each turned on or off in Settings → MCP. */
export const mcpAreas = ["notebooks", "sources", "notes", "skills", "calendar", "plugins"] as const;
export type McpArea = (typeof mcpAreas)[number];

/** Everything a group of tools needs: the store, who is calling, and the permissions. */
export interface ToolContext {
  mcp: McpServer;
  store: SyncBackend;
  /** The app's version. */
  version: string;
  /** The agent's name, from its User-Agent or its MCP client info. */
  client: string;
  /** Whether agents may change this area now. */
  canWrite(area: McpArea): boolean;
  /** Tells open windows which tables changed, so they refresh. */
  changed(tables: TableName[]): void;
  /** Adds a call to Settings → MCP → Recent activity. */
  log(tool: string): void;
}

export const DEFAULT_VAULT = "default";

export const text = (value: unknown) => ({
  content: [
    {
      type: "text" as const,
      text: typeof value === "string" ? value : JSON.stringify(value, null, 2),
    },
  ],
});

export const failure = (message: string) => ({ ...text(message), isError: true });

/** The message an agent gets when an area is turned off. */
export const turnedOff = (area: McpArea) =>
  failure(
    `Changing ${area} is turned off in better-vault's MCP settings (Settings → MCP). Ask the user to allow it.`,
  );

/** A vault's name as the user sees it. */
export function vaultName(store: SyncBackend, id: string | undefined): string {
  const vaultId = id ?? DEFAULT_VAULT;
  const vault = store.listVaults().find((each) => each.id === vaultId);
  return vault?.name || (vaultId === DEFAULT_VAULT ? "My vault" : vaultId);
}

/** The id of the vault with this name or id; the default vault when none is given. */
export function findVault(store: SyncBackend, name?: string): string {
  if (!name) return DEFAULT_VAULT;
  const match = store
    .listVaults()
    .find((each) => sameName(each.name || "My vault", name) || each.id === name);
  if (!match && name !== DEFAULT_VAULT && !sameName(name, "My vault"))
    throw new Error(`No vault named "${name}".`);
  return match?.id ?? DEFAULT_VAULT;
}

/** Long text cut for an agent, saying how much was left out. */
export function cut(value: string, max = 100_000): string {
  return value.length > max
    ? `${value.slice(0, max)}\n\n[… ${value.length - max} more characters]`
    : value;
}

/** Runs a tool's body, turning a thrown error into an MCP error result. */
export async function guarded<T>(run: () => T | Promise<T>) {
  try {
    return await run();
  } catch (error) {
    return failure(error instanceof Error ? error.message : String(error));
  }
}
