import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { deleteAllData } from "@/lib/db/backup";
import { createDexieBackend } from "@/lib/db/dexie-backend";
import { createNotebook } from "@/lib/db/notebooks";
import { createNote } from "@/lib/db/notes";
import { addSource } from "@/lib/db/sources";
import { setStoreForTests, store } from "@/lib/db/store";
import { DEFAULT_VAULT } from "@/lib/db/vaults";
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
