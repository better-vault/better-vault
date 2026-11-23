import { DatabaseSync } from "node:sqlite";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { beforeEach, describe, expect, it } from "vitest";
import { createSqliteStore, type SyncBackend } from "../../../lib/db/sqlite/store";
import type { McpArea, ToolContext } from "./context";
import { registerDescribeTool } from "./describe";
import { registerNoteTools } from "./notes";
import { registerNotebookTools } from "./notebooks";
import { captureTools, registerScriptTools, type CapturedTool } from "./script";

let store: SyncBackend;
let allowed: Set<McpArea>;

async function connect({ only = false } = {}) {
  const mcp = new McpServer({ name: "better-vault", version: "test" });
  const captured = new Map<string, CapturedTool>();
  const ctx: ToolContext = {
    mcp: captureTools(mcp, captured, { exposeAll: !only, keep: new Set(["describe_app"]) }),
    store,
    version: "test",
    client: "tester",
    canWrite: (area) => allowed.has(area),
    changed: () => undefined,
    log: () => undefined,
  };
  registerDescribeTool(ctx, () => ({}));
  registerNotebookTools(ctx);
  registerNoteTools(ctx);
  registerScriptTools(mcp, captured, ctx.log);
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await mcp.connect(serverSide);
  const client = new Client({ name: "tester", version: "1" });
  await client.connect(clientSide);
  return client;
}

async function run(code: string) {
  const client = await connect();
  const result = (await client.callTool({ name: "run_vault_script", arguments: { code } })) as {
    content: { text: string }[];
    isError?: boolean;
  };
  return { text: result.content[0]?.text ?? "", error: result.isError === true };
}

beforeEach(() => {
  store = createSqliteStore(new DatabaseSync(":memory:"));
  allowed = new Set(["notebooks", "sources", "notes"]);
});

describe("Vault script", () => {
  it("lists only describe_app and the script tools when asked to", async () => {
    const client = await connect({ only: true });
    const names = (await client.listTools()).tools.map((tool) => tool.name).sort();
    expect(names).toEqual(["describe_app", "run_vault_script", "vault_api"]);
  });

  it("describes the tools a script can call", async () => {
    const client = await connect();
    const result = (await client.callTool({ name: "vault_api", arguments: {} })) as {
      content: { text: string }[];
    };
    expect(result.content[0].text).toContain("tools.write_note(input: {");
    expect(result.content[0].text).toContain("tools.list_notes(");
  });

  it("does several steps in one call and returns only what was asked", async () => {
    const { text, error } = await run(`
      await tools.write_note({ title: "Alpha", body: "one" });
      await tools.write_note({ title: "Beta", body: "two" });
      const notes = await tools.list_notes({});
      return notes.map((note) => note.title).sort();
    `);
    expect(error).toBe(false);
    expect(JSON.parse(text)).toEqual(["Alpha", "Beta"]);
  });

  it("keeps the permissions of the tools it calls", async () => {
    allowed.delete("notes");
    const { text } = await run(`return await tools.write_note({ title: "No", body: "x" });`);
    expect(text, text).toContain("turned off");
    expect(store.listNotes()).toHaveLength(0);
  });

  it("has no Node APIs to escape to", async () => {
    const { text } = await run(`return [typeof process, typeof require, typeof fetch];`);
    expect(JSON.parse(text)).toEqual(["undefined", "undefined", "undefined"]);
  });
});
