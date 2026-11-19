import { randomBytes } from "node:crypto";
import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { createServer, type IncomingMessage, type Server } from "node:http";
import path from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { app, BrowserWindow, ipcMain, type WebFrameMain } from "electron";
import type { TableName } from "../../../lib/db/backend";
import type { SyncBackend } from "../../../lib/db/sqlite/store";
import type { McpActivity, McpPermission, McpState } from "../../../lib/desktop/bridge";
import { registerActivityTools } from "./activity";
import { registerCalendarTools } from "./calendar";
import type { McpArea, ToolContext } from "./context";
import { registerDescribeTool } from "./describe";
import { registerNoteTools } from "./notes";
import { registerNotebookTools } from "./notebooks";
import { pluginGuide, registerPluginTools } from "./plugins";

/**
 * A Model Context Protocol server in the desktop app, so AI agents (Claude
 * Code, Cursor, Codex, Claude Desktop…) can use everything in better-vault:
 * notebooks and sources, notes, skills, the calendar, chats, Studio outputs,
 * bots and plugins. It listens on 127.0.0.1 only, needs a token, refuses
 * requests from web pages, and is off until turned on in Settings → MCP.
 * Agents may always read; each area's changes can be turned off, and Read
 * only turns them all off. Writes go through the same SQLite store as the
 * window, so open windows refresh at once. Settings and keys are never
 * exposed.
 */

type McpSettings = { enabled: boolean; port: number; token: string; readOnly: boolean } & Record<
  McpPermission,
  boolean
>;

/** Each area's switch in Settings → MCP. */
const permissionKeys = [
  "allowNotebooks",
  "allowSources",
  "allowNotes",
  "allowSkills",
  "allowCalendar",
  "allowPlugins",
] as const satisfies readonly McpPermission[];

const areaPermission: Record<McpArea, McpPermission> = {
  notebooks: "allowNotebooks",
  sources: "allowSources",
  notes: "allowNotes",
  skills: "allowSkills",
  calendar: "allowCalendar",
  plugins: "allowPlugins",
};

const DEFAULT_PORT = 8765;
const file = () => path.join(app.getPath("userData"), "mcp.json");
const newToken = () => randomBytes(24).toString("base64url");

function loadSettings(): McpSettings {
  const fallback: McpSettings = {
    enabled: false,
    port: DEFAULT_PORT,
    token: newToken(),
    readOnly: false,
    allowNotebooks: true,
    allowSources: true,
    allowNotes: true,
    allowSkills: true,
    allowCalendar: true,
    // Plugins run code in the app: agents install them only once the user allows it.
    allowPlugins: false,
  };
  try {
    if (existsSync(file()))
      return { ...fallback, ...(JSON.parse(readFileSync(file(), "utf8")) as Partial<McpSettings>) };
  } catch {
    // A broken file starts over with MCP off.
  }
  return fallback;
}

function saveSettings(settings: McpSettings) {
  writeFileSync(file(), JSON.stringify(settings, null, 2), { mode: 0o600 });
  chmodSync(file(), 0o600);
}

/** More tool groups, added by other parts of the desktop app (plugins). */
export type ToolGroup = (ctx: ToolContext) => void;
const groups: ToolGroup[] = [];
let describeExtras: () => Record<string, unknown> = () => ({});

export function addMcpTools(group: ToolGroup, describe?: () => Record<string, unknown>) {
  groups.push(group);
  if (describe) {
    const previous = describeExtras;
    describeExtras = () => ({ ...previous(), ...describe() });
  }
}

export function startMcp(
  store: SyncBackend,
  isTrusted: (frame: WebFrameMain | null) => boolean,
  version: string,
) {
  let settings = loadSettings();
  let server: Server | null = null;
  let error: string | null = null;
  const activity: McpActivity[] = [];

  const changed = (tables: TableName[]) => {
    for (const window of BrowserWindow.getAllWindows())
      window.webContents.send("db:changed", tables);
  };
  const state = (): McpState =>
    ({
      enabled: settings.enabled,
      running: server !== null,
      port: settings.port,
      url: `http://127.0.0.1:${settings.port}/mcp`,
      token: settings.token,
      readOnly: settings.readOnly,
      ...Object.fromEntries(permissionKeys.map((key) => [key, settings[key]])),
      error,
      activity,
    }) as McpState;
  const broadcast = () => {
    for (const window of BrowserWindow.getAllWindows())
      window.webContents.send("mcp:state", state());
  };

  /** One MCP server per request (stateless), so tools and skill prompts are always current. */
  function build(client: string): McpServer {
    const mcp = new McpServer({ name: "better-vault", version });
    const ctx: ToolContext = {
      mcp,
      store,
      version,
      client,
      canWrite: (area) => !settings.readOnly && settings[areaPermission[area]],
      changed,
      log: (tool) => {
        activity.unshift({ client, tool, at: Date.now() });
        activity.length = Math.min(activity.length, 30);
        broadcast();
      },
    };
    registerDescribeTool(ctx, () => ({ ...pluginGuide(), ...describeExtras() }));
    registerNotebookTools(ctx);
    registerNoteTools(ctx);
    registerCalendarTools(ctx);
    registerActivityTools(ctx);
    registerPluginTools(ctx);
    for (const group of groups) group(ctx);
    return mcp;
  }

  /** Only this machine, only with the token, never from a web page (DNS rebinding, CSRF). */
  function allowed(request: IncomingMessage): boolean {
    const host = (request.headers.host ?? "").replace(/:\d+$/, "");
    if (host !== "127.0.0.1" && host !== "localhost") return false;
    if (request.headers.origin) return false;
    return request.headers.authorization === `Bearer ${settings.token}`;
  }

  function start() {
    stop();
    error = null;
    if (!settings.enabled) return broadcast();
    const http = createServer(async (request, response) => {
      try {
        if (!allowed(request)) {
          response
            .writeHead(401, { "content-type": "application/json" })
            .end(JSON.stringify({ error: "Unauthorized" }));
          return;
        }
        if (request.url?.split("?")[0] !== "/mcp") return void response.writeHead(404).end();
        if (request.method !== "POST") return void response.writeHead(405, { allow: "POST" }).end();
        const chunks: Buffer[] = [];
        for await (const chunk of request) chunks.push(chunk as Buffer);
        const body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "null") as unknown;
        const clientInfo = (body as { params?: { clientInfo?: { name?: string } } } | null)?.params
          ?.clientInfo?.name;
        const client =
          String(request.headers["user-agent"] ?? clientInfo ?? "agent").split(/[/ ]/)[0] ||
          "agent";
        const mcp = build(client);
        const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
        response.on("close", () => {
          void transport.close();
          void mcp.close();
        });
        await mcp.connect(transport);
        await transport.handleRequest(request, response, body);
      } catch (cause) {
        if (!response.headersSent)
          response
            .writeHead(500, { "content-type": "application/json" })
            .end(JSON.stringify({ error: String(cause) }));
      }
    });
    http.on("error", (cause) => {
      error = cause instanceof Error ? cause.message : String(cause);
      server = null;
      broadcast();
    });
    http.listen(settings.port, "127.0.0.1", () => {
      server = http;
      broadcast();
    });
  }

  function stop() {
    server?.close();
    server = null;
  }

  ipcMain.handle("mcp:state", (event) => {
    if (!isTrusted(event.senderFrame)) throw new Error("Not allowed.");
    return state();
  });
  ipcMain.handle("mcp:update", (event, patch: unknown) => {
    if (!isTrusted(event.senderFrame)) throw new Error("Not allowed.");
    const next = patch as Partial<McpSettings>;
    settings = {
      ...settings,
      ...(typeof next.enabled === "boolean" ? { enabled: next.enabled } : {}),
      ...(typeof next.readOnly === "boolean" ? { readOnly: next.readOnly } : {}),
      ...Object.fromEntries(
        permissionKeys.flatMap((key) => (typeof next[key] === "boolean" ? [[key, next[key]]] : [])),
      ),
      ...(typeof next.port === "number" && next.port >= 1024 && next.port <= 65535
        ? { port: Math.round(next.port) }
        : {}),
    };
    saveSettings(settings);
    start();
    return state();
  });
  ipcMain.handle("mcp:regenerate", (event) => {
    if (!isTrusted(event.senderFrame)) throw new Error("Not allowed.");
    settings = { ...settings, token: newToken() };
    saveSettings(settings);
    broadcast();
    return state();
  });

  start();
  return { stop };
}
