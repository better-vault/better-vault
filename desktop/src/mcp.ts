import { randomBytes } from "node:crypto";
import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { createServer, type IncomingMessage, type Server } from "node:http";
import path from "node:path";
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { app, BrowserWindow, ipcMain, type WebFrameMain } from "electron";
import { z } from "zod";
import type { TableName } from "../../lib/db/backend";
import type { SyncBackend } from "../../lib/db/sqlite/store";
import type { Note, Skill } from "../../lib/db/types";
import type { McpActivity, McpState } from "../../lib/desktop/bridge";
import { selectPassages } from "../../lib/grounding/passages";
import { analyse, sameName } from "../../lib/notes/syntax";
import { skillSlug } from "../../lib/skills/format";

/**
 * A Model Context Protocol server in the desktop app, so AI agents (Claude
 * Code, Cursor, Codex, Claude Desktop…) can read the user's notebooks and
 * notes and share skills with them. It listens on 127.0.0.1 only, needs a
 * token, refuses requests from web pages, and is off until turned on in
 * Settings → MCP. Writes go through the same SQLite store as the window, so
 * open windows refresh at once.
 */

interface McpSettings {
  enabled: boolean;
  port: number;
  token: string;
  /** Agents may only read. */
  readOnly: boolean;
  allowNotes: boolean;
  allowSkills: boolean;
}

const DEFAULT_PORT = 8765;
const file = () => path.join(app.getPath("userData"), "mcp.json");
const newToken = () => randomBytes(24).toString("base64url");

function loadSettings(): McpSettings {
  const fallback: McpSettings = {
    enabled: false,
    port: DEFAULT_PORT,
    token: newToken(),
    readOnly: false,
    allowNotes: true,
    allowSkills: true,
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

const text = (value: unknown) => ({
  content: [
    {
      type: "text" as const,
      text: typeof value === "string" ? value : JSON.stringify(value, null, 2),
    },
  ],
});
const failure = (message: string) => ({ ...text(message), isError: true });

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
  const log = (client: string, tool: string) => {
    activity.unshift({ client, tool, at: Date.now() });
    activity.length = Math.min(activity.length, 30);
    broadcast();
  };
  const state = (): McpState => ({
    enabled: settings.enabled,
    running: server !== null,
    port: settings.port,
    url: `http://127.0.0.1:${settings.port}/mcp`,
    token: settings.token,
    readOnly: settings.readOnly,
    allowNotes: settings.allowNotes,
    allowSkills: settings.allowSkills,
    error,
    activity,
  });
  const broadcast = () => {
    for (const window of BrowserWindow.getAllWindows())
      window.webContents.send("mcp:state", state());
  };

  const vaultName = (id: string) => {
    const vault = store.listVaults().find((each) => each.id === id);
    return vault?.name || (id === "default" ? "My vault" : id);
  };
  const findVault = (name?: string) => {
    if (!name) return "default";
    const vaults = store.listVaults();
    const match = vaults.find(
      (each) => sameName(each.name || "My vault", name) || each.id === name,
    );
    if (!match && name !== "default") throw new Error(`No vault named "${name}".`);
    return match?.id ?? "default";
  };

  /** One MCP server per request (stateless), so tools and skill prompts are always current. */
  function build(client: string): McpServer {
    const mcp = new McpServer({ name: "better-vault", version });
    const canWrite = (kind: "notes" | "skills") =>
      !settings.readOnly && (kind === "notes" ? settings.allowNotes : settings.allowSkills);

    mcp.registerTool(
      "list_vaults",
      {
        description: "List the user's vaults (spaces of notebooks, notes and skills).",
        annotations: { readOnlyHint: true },
      },
      async () => {
        log(client, "list_vaults");
        const vaults = store.listVaults();
        const all = vaults.some((vault) => vault.id === "default")
          ? vaults
          : [{ id: "default", name: "" }, ...vaults];
        return text(all.map((vault) => ({ id: vault.id, name: vault.name || "My vault" })));
      },
    );

    mcp.registerTool(
      "list_notebooks",
      {
        description: "List notebooks with their sources. Optionally only one vault's.",
        inputSchema: { vault: z.string().optional().describe("Vault name or id") },
        annotations: { readOnlyHint: true },
      },
      async ({ vault }) => {
        log(client, "list_notebooks");
        const vaultId = vault ? findVault(vault) : null;
        const notebooks = store
          .listNotebooks()
          .filter((each) => !vaultId || (each.vaultId ?? "default") === vaultId);
        return text(
          notebooks.map((notebook) => ({
            id: notebook.id,
            title: notebook.title,
            vault: vaultName(notebook.vaultId ?? "default"),
            sources: store
              .listSources(notebook.id)
              .map((source) => ({ id: source.id, title: source.title, kind: source.kind })),
          })),
        );
      },
    );

    mcp.registerTool(
      "search_sources",
      {
        description:
          "Find the passages of a notebook's sources (or every notebook's) that best match a question.",
        inputSchema: {
          query: z.string().min(1),
          notebookId: z.string().optional(),
          limit: z.number().int().min(1).max(30).optional(),
        },
        annotations: { readOnlyHint: true },
      },
      async ({ query, notebookId, limit = 8 }) => {
        log(client, "search_sources");
        const sources = notebookId ? store.listSources(notebookId) : store.listAllSources();
        const chunks = store.getChunks(sources.map((source) => source.id));
        const passages = selectPassages({ sources, chunks, budget: 12_000, query }).slice(0, limit);
        return text(
          passages.map(({ sourceId, title, text: passage }) => ({
            sourceId,
            title,
            text: passage,
          })),
        );
      },
    );

    mcp.registerTool(
      "read_source",
      {
        description: "Read a source's full text.",
        inputSchema: { sourceId: z.string() },
        annotations: { readOnlyHint: true },
      },
      async ({ sourceId }) => {
        log(client, "read_source");
        const source = store.getSource(sourceId);
        return source
          ? text(`# ${source.title}\n\n${source.text}`)
          : failure("No source with that id.");
      },
    );

    const noteSummary = (note: Note) => ({
      id: note.id,
      title: note.title,
      vault: vaultName(note.vaultId),
      folder: note.folder || undefined,
      tags: note.tags,
      updatedAt: new Date(note.updatedAt).toISOString(),
    });

    mcp.registerTool(
      "list_notes",
      {
        description:
          "List notes (Markdown, Obsidian-style with [[links]] and #tags). Optionally one vault's.",
        inputSchema: { vault: z.string().optional() },
        annotations: { readOnlyHint: true },
      },
      async ({ vault }) => {
        log(client, "list_notes");
        const vaultId = vault ? findVault(vault) : null;
        return text(
          store
            .listNotes()
            .filter((note) => !vaultId || note.vaultId === vaultId)
            .map(noteSummary),
        );
      },
    );

    mcp.registerTool(
      "search_notes",
      {
        description: "Find notes whose title, text or tags contain every word of the query.",
        inputSchema: { query: z.string().min(1) },
        annotations: { readOnlyHint: true },
      },
      async ({ query }) => {
        log(client, "search_notes");
        const words = query.toLowerCase().split(/\s+/).filter(Boolean);
        const found = store
          .listNotes()
          .filter((note) =>
            words.every((word) =>
              `${note.title}\n${note.body}\n${note.tags.join(" ")}`.toLowerCase().includes(word),
            ),
          );
        return text(found.slice(0, 30).map(noteSummary));
      },
    );

    mcp.registerTool(
      "read_note",
      {
        description: "Read a note by id, or by title (in a vault).",
        inputSchema: {
          id: z.string().optional(),
          title: z.string().optional(),
          vault: z.string().optional(),
        },
        annotations: { readOnlyHint: true },
      },
      async ({ id, title, vault }) => {
        log(client, "read_note");
        const vaultId = vault ? findVault(vault) : null;
        const note = id
          ? store.getNote(id)
          : store
              .listNotes()
              .find(
                (each) =>
                  title && sameName(each.title, title) && (!vaultId || each.vaultId === vaultId),
              );
        return note ? text(`# ${note.title}\n\n${note.body}`) : failure("No such note.");
      },
    );

    mcp.registerTool(
      "write_note",
      {
        description:
          "Create a note, or replace the text of the note with that title in the vault. Use Obsidian Markdown: [[Note]] links, #tags, - [ ] tasks.",
        inputSchema: {
          title: z.string().min(1).max(200),
          body: z.string().max(200_000),
          vault: z.string().optional(),
          folder: z.string().optional(),
        },
      },
      async ({ title, body, vault, folder }) => {
        if (!canWrite("notes"))
          return failure("Writing notes is turned off in better-vault's MCP settings.");
        log(client, "write_note");
        const vaultId = findVault(vault);
        const now = Date.now();
        const existing = store
          .listNotes()
          .find((note) => note.vaultId === vaultId && sameName(note.title, title));
        const note: Note = existing
          ? {
              ...existing,
              body,
              ...analyse(body),
              folder: folder ?? existing.folder,
              updatedAt: now,
            }
          : {
              id: randomBytes(12).toString("base64url"),
              vaultId,
              title: title.replace(/[[\]|#^\\/:]/g, " ").trim(),
              body,
              folder: folder ?? "",
              notebookId: null,
              ...analyse(body),
              createdAt: now,
              updatedAt: now,
            };
        store.putNote(note);
        changed(["notes"]);
        return text({ saved: noteSummary(note), created: !existing });
      },
    );

    const skillOut = (skill: Skill) => ({
      id: skill.id,
      name: skill.name,
      description: skill.description,
      vault: vaultName(skill.vaultId),
      updatedBy: skill.updatedBy,
    });

    mcp.registerTool(
      "list_skills",
      {
        description:
          "List the skills (SKILL.md instructions) shared through better-vault. Optionally one vault's.",
        inputSchema: { vault: z.string().optional() },
        annotations: { readOnlyHint: true },
      },
      async ({ vault }) => {
        log(client, "list_skills");
        const vaultId = vault ? findVault(vault) : null;
        return text(
          store
            .listSkills()
            .filter((skill) => !vaultId || skill.vaultId === vaultId)
            .map(skillOut),
        );
      },
    );

    mcp.registerTool(
      "read_skill",
      {
        description: "Read a skill's instructions by name (and vault).",
        inputSchema: { name: z.string(), vault: z.string().optional() },
        annotations: { readOnlyHint: true },
      },
      async ({ name, vault }) => {
        log(client, "read_skill");
        const vaultId = vault ? findVault(vault) : null;
        const skill = store
          .listSkills()
          .find((each) => each.name === skillSlug(name) && (!vaultId || each.vaultId === vaultId));
        return skill
          ? text(
              `---\nname: ${skill.name}\ndescription: ${skill.description}\n---\n\n${skill.body}`,
            )
          : failure("No such skill.");
      },
    );

    mcp.registerTool(
      "write_skill",
      {
        description:
          "Create a skill, or update the skill with that name in the vault. Other agents and the user share it.",
        inputSchema: {
          name: z.string().min(1).max(64),
          description: z.string().max(1000),
          body: z.string().max(100_000),
          vault: z.string().optional(),
        },
      },
      async ({ name, description, body, vault }) => {
        if (!canWrite("skills"))
          return failure("Writing skills is turned off in better-vault's MCP settings.");
        log(client, "write_skill");
        const vaultId = findVault(vault);
        const slug = skillSlug(name);
        const now = Date.now();
        const existing = store
          .listSkills()
          .find((skill) => skill.vaultId === vaultId && skill.name === slug);
        const skill: Skill = existing
          ? { ...existing, description, body, updatedBy: client, updatedAt: now }
          : {
              id: randomBytes(12).toString("base64url"),
              vaultId,
              name: slug,
              description,
              body,
              updatedBy: client,
              createdAt: now,
              updatedAt: now,
            };
        store.putSkill(skill);
        changed(["skills"]);
        return text({ saved: skillOut(skill), created: !existing });
      },
    );

    mcp.registerTool(
      "delete_skill",
      {
        description: "Delete a skill by name (and vault).",
        inputSchema: { name: z.string(), vault: z.string().optional() },
        annotations: { destructiveHint: true },
      },
      async ({ name, vault }) => {
        if (!canWrite("skills"))
          return failure("Writing skills is turned off in better-vault's MCP settings.");
        log(client, "delete_skill");
        const vaultId = findVault(vault);
        const skill = store
          .listSkills()
          .find((each) => each.vaultId === vaultId && each.name === skillSlug(name));
        if (!skill) return failure("No such skill.");
        store.deleteSkill(skill.id);
        changed(["skills"]);
        return text({ deleted: skill.name });
      },
    );

    // Skills as resources (skill://vault/name) and as prompts an agent can run.
    mcp.registerResource(
      "skill",
      new ResourceTemplate("skill://{vault}/{name}", {
        list: async () => ({
          resources: store.listSkills().map((skill) => ({
            uri: `skill://${encodeURIComponent(vaultName(skill.vaultId))}/${skill.name}`,
            name: skill.name,
            description: skill.description,
            mimeType: "text/markdown",
          })),
        }),
      }),
      { description: "A skill's SKILL.md", mimeType: "text/markdown" },
      async (uri, { vault, name }) => {
        const vaultId = findVault(decodeURIComponent(String(vault)));
        const skill = store
          .listSkills()
          .find((each) => each.vaultId === vaultId && each.name === String(name));
        if (!skill) throw new Error("No such skill.");
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "text/markdown",
              text: `---\nname: ${skill.name}\ndescription: ${skill.description}\n---\n\n${skill.body}`,
            },
          ],
        };
      },
    );
    const seen = new Set<string>();
    for (const skill of store.listSkills()) {
      if (seen.has(skill.name)) continue;
      seen.add(skill.name);
      mcp.registerPrompt(
        skill.name,
        { description: skill.description || `The ${skill.name} skill` },
        async () => ({
          messages: [{ role: "user", content: { type: "text", text: skill.body } }],
        }),
      );
    }
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
      ...(typeof next.allowNotes === "boolean" ? { allowNotes: next.allowNotes } : {}),
      ...(typeof next.allowSkills === "boolean" ? { allowSkills: next.allowSkills } : {}),
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
