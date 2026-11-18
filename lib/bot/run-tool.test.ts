import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deleteAllData } from "@/lib/db/backup";
import { createDexieBackend } from "@/lib/db/dexie-backend";
import { createNotebook } from "@/lib/db/notebooks";
import { createNote } from "@/lib/db/notes";
import { addSource } from "@/lib/db/sources";
import { setStoreForTests, store } from "@/lib/db/store";
import { createVault, DEFAULT_VAULT } from "@/lib/db/vaults";
import { botToolsFor } from "./access";
import { calendarEntry, localInstant, runBotTool, type ToolContext } from "./run-tool";

const asked: [string, string][] = [];
const context: ToolContext = {
  currentVault: DEFAULT_VAULT,
  vaultLabel: (vault) => vault.name || "My vault",
  askBot: async (bot, task) => {
    asked.push([bot, task]);
    return { answer: "done" };
  },
  timeZone: "Europe/Paris",
};

describe("bot tools", () => {
  beforeEach(async () => {
    setStoreForTests(createDexieBackend());
    await deleteAllData();
    asked.length = 0;
  });

  it("reads notebooks, sources and notes", async () => {
    const notebookId = await createNotebook("Biology");
    await addSource({
      notebookId,
      title: "Cells",
      kind: "text",
      text: "Mitochondria make energy.",
    });
    await createNote({ vaultId: DEFAULT_VAULT, title: "Plan", body: "Study #biology" });
    const notebooks = (await runBotTool("list_notebooks", {}, context)) as {
      title: string;
      vault: string;
      sources: unknown[];
    }[];
    expect(notebooks).toEqual([expect.objectContaining({ title: "Biology", vault: "My vault" })]);
    expect(notebooks[0].sources).toHaveLength(1);
    const found = (await runBotTool("search_sources", { query: "energy" }, context)) as {
      title: string;
    }[];
    expect(found[0].title).toBe("Cells");
    expect(await runBotTool("search_notes", { query: "biology" }, context)).toEqual([
      expect.objectContaining({ title: "Plan" }),
    ]);
    expect(await runBotTool("read_note", { title: "plan" }, context)).toEqual(
      expect.objectContaining({ body: "Study #biology" }),
    );
  });

  it("writes notes and calendar events, and reports errors", async () => {
    const made = (await runBotTool("create_note", { title: "Ideas", body: "One" }, context)) as {
      id: string;
    };
    await runBotTool("append_to_note", { id: made.id, text: "Two" }, context);
    expect((await store().getNote(made.id))?.body).toBe("One\n\nTwo\n");
    await runBotTool("add_calendar_event", { title: "Exam", start: "2026-11-20T09:00" }, context);
    const events = (await runBotTool(
      "list_calendar",
      { from: "2026-11-20", to: "2026-11-20" },
      context,
    )) as { title: string }[];
    expect(events.map((event) => event.title)).toEqual(["Exam"]);
    expect(await runBotTool("read_note", { title: "Missing" }, context)).toEqual({
      error: "No such note.",
    });
    expect(await runBotTool("create_note", { body: "x" }, context)).toEqual({
      error: expect.stringContaining("Invalid input"),
    });
  });

  it("hands tasks to other bots", async () => {
    expect(await runBotTool("ask_bot", { bot: "Planner", task: "Plan" }, context)).toEqual({
      answer: "done",
    });
    expect(asked).toEqual([["Planner", "Plan"]]);
  });
});

describe("calendar entries", () => {
  it("makes timed entries an hour long by default", () => {
    const entry = calendarEntry({ title: " Exam ", start: "2026-11-20T09:00" }, "Europe/Paris");
    expect(entry.title).toBe("Exam");
    expect(entry.start).toBe(localInstant(new Date(2026, 10, 20, 9, 0)));
    expect(entry.end).toBe(localInstant(new Date(2026, 10, 20, 10, 0)));
    expect(entry.allDay).toBeUndefined();
  });

  it("makes all-day entries with an exclusive end", () => {
    const one = calendarEntry({ title: "Trip", start: "2026-12-24" }, "UTC");
    expect([one.allDay, one.start, one.end]).toEqual([true, "2026-12-24", "2026-12-25"]);
    const three = calendarEntry({ title: "Trip", start: "2026-12-24", end: "2026-12-26" }, "UTC");
    expect(three.end).toBe("2026-12-27");
    expect(() =>
      calendarEntry({ title: "Bad", start: "2026-12-24T10:00", end: "2026-12-24T09:00" }, "UTC"),
    ).toThrow();
  });
});

describe("bot access", () => {
  beforeEach(async () => {
    setStoreForTests(createDexieBackend());
    await deleteAllData();
  });

  it("refuses tools the bot may not use, and keeps a bot to its vault", async () => {
    const other = await createVault({ name: "Work" });
    await createNote({ vaultId: DEFAULT_VAULT, title: "Home note" });
    await createNote({ vaultId: other, title: "Work note" });
    const scoped: ToolContext = { ...context, allowed: new Set(["list_notes"]), vault: other };
    expect(await runBotTool("list_notes", {}, scoped)).toEqual([
      expect.objectContaining({ title: "Work note" }),
    ]);
    expect(await runBotTool("read_note", { title: "Home note" }, scoped)).toEqual({
      error: expect.stringContaining("isn't allowed"),
    });
    expect(
      await runBotTool("read_note", { title: "Home note" }, { ...context, vault: other }),
    ).toEqual({ error: "No such note." });
  });

  it("chooses tools from a bot's access", () => {
    const planner = {
      canDelegate: false,
      access: { notebooks: false, notes: "read", calendar: "write", skills: "none" } as const,
    };
    expect(botToolsFor(planner)).toEqual([
      "list_notes",
      "search_notes",
      "read_note",
      "list_calendar",
      "add_calendar_event",
    ]);
    const chief = { canDelegate: true };
    expect(botToolsFor(chief)).toContain("create_bot");
    expect(botToolsFor(chief, { handedOver: true })).not.toContain("ask_bot");
    expect(botToolsFor(chief, { handedOver: true })).not.toContain("create_bot");
  });

  it("makes bots with the access asked for", async () => {
    const made = (await runBotTool(
      "create_bot",
      {
        name: "Vault Summarizer",
        title: "Sums up my vault",
        instructions: "Be short.",
        shape: "raven",
        calendar: "none",
      },
      context,
    )) as { ok: boolean; id: string };
    expect(made.ok).toBe(true);
    const bot = await store().getBot(made.id);
    expect(bot?.avatar.shape).toBe("raven");
    expect(bot?.access).toEqual({
      notebooks: true,
      notes: "read",
      calendar: "none",
      skills: "read",
    });
    expect(
      await runBotTool(
        "create_bot",
        { name: "X", title: "", instructions: "", shape: "dragon" },
        context,
      ),
    ).toEqual({
      error: expect.stringContaining("Invalid input"),
    });
  });
});

describe("bot skill tools", () => {
  beforeEach(async () => {
    setStoreForTests(createDexieBackend());
    await deleteAllData();
  });
  afterEach(() => vi.unstubAllGlobals());

  const remote = {
    repo: "acme/skills",
    ref: "main",
    truncated: false,
    skills: [
      {
        name: "design",
        description: "Design well",
        body: "# Design",
        path: "skills/design/SKILL.md",
      },
    ],
  };

  it("finds skills without their bodies, and adds them after an OK", async () => {
    const asked: unknown[] = [];
    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
      asked.push(JSON.parse(String(init.body)));
      return Response.json(remote);
    });
    const found = (await runBotTool(
      "find_skills",
      { source: "npx skills add acme/skills" },
      context,
    )) as {
      skills: Record<string, unknown>[];
    };
    expect(found.skills).toEqual([
      { name: "design", description: "Design well", path: "skills/design/SKILL.md" },
    ]);
    expect(
      await runBotTool("add_skills", { source: "acme/skills", names: ["design"] }, context),
    ).toEqual({
      ok: true,
      added: ["design"],
      from: "acme/skills",
    });
    expect(asked.at(-1)).toEqual({ source: "acme/skills", names: ["design"] });
    expect((await store().listSkills()).map((skill) => skill.name)).toEqual(["design"]);
  });

  it("writes a skill, and reports GitHub's errors", async () => {
    expect(
      await runBotTool(
        "create_skill",
        { name: "Meeting Notes", description: "Notes", body: "Do it" },
        context,
      ),
    ).toEqual({ ok: true, name: "meeting-notes" });
    vi.stubGlobal("fetch", async () =>
      Response.json({ error: "No skills were found." }, { status: 404 }),
    );
    expect(await runBotTool("find_skills", { source: "acme/empty" }, context)).toEqual({
      error: "No skills were found.",
    });
  });

  it("reads old on/off skills access as today's levels", () => {
    expect(botToolsFor({ canDelegate: false, access: { skills: true } as never })).toContain(
      "add_skills",
    );
    expect(botToolsFor({ canDelegate: false, access: { skills: false } as never })).not.toContain(
      "find_skills",
    );
  });
});
