import { DatabaseSync } from "node:sqlite";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { beforeEach, describe, expect, it } from "vitest";
import { createSqliteStore, type SyncBackend } from "../../../lib/db/sqlite/store";
import { registerActivityTools } from "./activity";
import { registerCalendarTools } from "./calendar";
import type { McpArea, ToolContext } from "./context";
import { registerDescribeTool } from "./describe";
import { registerNoteTools } from "./notes";
import { registerNotebookTools } from "./notebooks";

let store: SyncBackend;
let allowed: Set<McpArea>;
let changes: string[];

async function connect() {
  const mcp = new McpServer({ name: "better-vault", version: "test" });
  const ctx: ToolContext = {
    mcp,
    store,
    version: "test",
    client: "tester",
    canWrite: (area) => allowed.has(area),
    changed: (tables) => changes.push(...tables),
    log: () => undefined,
  };
  registerDescribeTool(ctx);
  registerNotebookTools(ctx);
  registerNoteTools(ctx);
  registerCalendarTools(ctx);
  registerActivityTools(ctx);
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await mcp.connect(serverSide);
  const client = new Client({ name: "tester", version: "1" });
  await client.connect(clientSide);
  return client;
}

async function call(name: string, args: Record<string, unknown> = {}) {
  const client = await connect();
  const result = (await client.callTool({ name, arguments: args })) as {
    content: { text: string }[];
    isError?: boolean;
  };
  const raw = result.content[0]?.text ?? "";
  let value: unknown = raw;
  try {
    value = JSON.parse(raw);
  } catch {
    // Plain text.
  }
  return {
    value: value as Record<string, unknown> & unknown[],
    error: result.isError === true,
    raw,
  };
}

beforeEach(() => {
  store = createSqliteStore(new DatabaseSync(":memory:"));
  allowed = new Set(["notebooks", "sources", "notes", "skills", "calendar"]);
  changes = [];
});

describe("MCP tools", () => {
  it("describes every area and what may change", async () => {
    allowed.delete("calendar");
    const { value } = await call("describe_app");
    const areas = value.areas as Record<string, { reads: string[]; mayChange: boolean }>;
    expect(Object.keys(areas)).toEqual(
      expect.arrayContaining(["notebooks", "sources", "notes", "skills", "calendar", "activity"]),
    );
    expect(areas.calendar.mayChange).toBe(false);
    expect(areas.notes.mayChange).toBe(true);
    // Every tool named in the guide exists (plugins come with their own group).
    const client = await connect();
    const names = new Set((await client.listTools()).tools.map((tool) => tool.name));
    for (const [area, guide] of Object.entries(areas))
      if (area !== "plugins")
        for (const tool of [...guide.reads, ...(guide as unknown as { writes: string[] }).writes])
          expect(names, tool).toContain(tool);
  });

  it("creates a notebook, adds and reads a source, and searches it", async () => {
    const created = await call("create_notebook", { title: "Biology" });
    const notebookId = (created.value.created as { id: string }).id;
    const added = await call("add_source", {
      notebookId,
      title: "Cells",
      text: "Mitochondria are the powerhouse of the cell. Ribosomes make proteins.",
    });
    expect(added.error).toBe(false);
    const sourceId = (added.value.added as { id: string; format: string }).id;
    expect(changes).toContain("chunks");

    const read = await call("read_source", { sourceId });
    expect(read.raw).toContain("powerhouse");
    const found = await call("search_sources", { query: "ribosomes proteins", notebookId });
    expect(found.value[0]).toMatchObject({ sourceId, title: "Cells" });

    await call("set_source_selected", { sourceId, selected: false });
    expect(store.getSource(sourceId)?.selected).toBe(false);
    await call("delete_source", { sourceId });
    expect(store.getSource(sourceId)).toBeUndefined();
  });

  it("refuses changes that are turned off, and still reads", async () => {
    allowed = new Set();
    const refused = await call("create_notebook", { title: "Nope" });
    expect(refused.error).toBe(true);
    expect(refused.raw).toContain("turned off");
    expect(store.listNotebooks()).toHaveLength(0);
    expect((await call("list_notebooks")).error).toBe(false);
  });

  it("writes notes, finds backlinks and deletes them", async () => {
    await call("write_note", { title: "Cells", body: "The basic unit of life." });
    await call("write_note", {
      title: "Biology",
      body: "Everything starts with [[Cells]]. #science",
    });
    const back = await call("list_backlinks", { title: "Cells" });
    expect((back.value as { title: string }[]).map((note) => note.title)).toEqual(["Biology"]);
    const deleted = await call("delete_note", { title: "Biology" });
    expect(deleted.value).toEqual({ deleted: "Biology" });
    expect(store.listNotes()).toHaveLength(1);
  });

  it("adds, lists, changes and deletes calendar events", async () => {
    const made = await call("create_event", {
      title: "Exam",
      start: "2026-11-20T09:00",
      location: "Hall B",
    });
    const id = (made.value.created as { id: string }).id;
    const listed = await call("list_events", { from: "2026-11-20", to: "2026-11-20" });
    expect(listed.value).toHaveLength(1);
    await call("update_event", { id, title: "Final exam", start: "2026-11-21" });
    const moved = store.listCalendar()[0];
    expect(moved).toMatchObject({
      title: "Final exam",
      start: "2026-11-21",
      allDay: true,
      location: "Hall B",
    });
    await call("delete_event", { id });
    expect(store.listCalendar()).toHaveLength(0);
  });

  it("reads chats and Studio outputs", async () => {
    const now = Date.now();
    store.addNotebook({ id: "nb", title: "Notebook", createdAt: now, updatedAt: now });
    store.saveChat(
      { id: "c1", notebookId: "nb", title: "Question", createdAt: now, updatedAt: now },
      [
        {
          id: "m1",
          notebookId: "nb",
          conversationId: "c1",
          createdAt: now,
          message: { id: "m1", role: "user", parts: [{ type: "text", text: "What is a cell?" }] },
        },
      ],
    );
    store.addOutput({
      id: "o1",
      notebookId: "nb",
      toolId: "flashcards",
      title: "Cards",
      status: "ready",
      options: {},
      sourceIds: [],
      data: { cards: [{ front: "Cell", back: "Unit of life" }] },
      createdAt: now,
      updatedAt: now,
    });
    expect((await call("list_chats", { notebookId: "nb" })).value[0]).toMatchObject({ id: "c1" });
    const chat = await call("read_chat", { chatId: "c1" });
    expect(chat.value.messages).toEqual([{ role: "user", text: "What is a cell?" }]);
    const output = await call("read_output", { outputId: "o1" });
    expect(output.value).toMatchObject({
      tool: "flashcards",
      data: { cards: [{ front: "Cell" }] },
    });
  });
});
