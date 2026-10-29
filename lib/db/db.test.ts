import "fake-indexeddb/auto";
import { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it } from "vitest";
import { deleteAllData, exportBackup, importBackup } from "./backup";
import type { Backend } from "./backend";
import { createDexieBackend } from "./dexie-backend";
import { createNotebook, deleteNotebook } from "./notebooks";
import { createOutput, markInterruptedOutputs } from "./outputs";
import { asBackend, createSqliteStore } from "./sqlite/store";
import { setStoreForTests, store } from "./store";
import { conversationTitle } from "@/lib/chat/title";
import {
  deleteConversation,
  latestConversation,
  loadChat,
  renameConversation,
  saveChat,
} from "./messages";
import {
  activeModel,
  availableModels,
  defaultSettings,
  getSettings,
  isProviderReady,
  updateProvider,
} from "./settings";
import { addSource, getChunks } from "./sources";

const userMessage = (id: string, text = id) => ({
  id,
  role: "user" as const,
  parts: [{ type: "text" as const, text }],
});

/**
 * The same tests run on each store: IndexedDB for the web app and SQLite for
 * the desktop app. A change to `lib/db` must pass on both.
 */
const backends: [string, () => Backend][] = [
  ["IndexedDB", () => createDexieBackend()],
  ["SQLite", () => asBackend(createSqliteStore(new DatabaseSync(":memory:")))],
];

describe.each(backends)("%s store", (name, create) => {
  /** Conversation ids differ per store: a deleted one is remembered for the page's life. */
  const id = (base: string) => `${name}-${base}`;

  beforeEach(async () => {
    setStoreForTests(create());
    await deleteAllData();
    await store().clearSettings();
  });

  describe("sources", () => {
    it("stores normalised text and its passages", async () => {
      const notebookId = await createNotebook("Test");
      const source = await addSource({
        notebookId,
        title: "Notes",
        kind: "text",
        text: "First paragraph.\r\n\r\n\r\nSecond   paragraph.",
      });
      expect(source.text).toBe("First paragraph.\n\nSecond paragraph.");
      expect(source.selected).toBe(true);
      const chunks = await getChunks([source.id]);
      expect(chunks).toHaveLength(1);
      expect(chunks[0].text).toBe(source.text);
    });

    it("refuses empty sources", async () => {
      const notebookId = await createNotebook("Test");
      await expect(
        addSource({ notebookId, title: "x", kind: "text", text: "  " }),
      ).rejects.toThrow();
    });
  });

  describe("notebooks", () => {
    it("deletes a notebook with everything in it", async () => {
      const notebookId = await createNotebook("Test");
      await addSource({ notebookId, title: "a", kind: "text", text: "hello" });
      await saveChat({ id: id("c1"), notebookId }, [
        { id: "m1", role: "user", parts: [{ type: "text", text: "hi" }] },
      ]);
      await deleteNotebook(notebookId);
      expect(await store().count("sources")).toBe(0);
      expect(await store().count("chunks")).toBe(0);
      expect(await store().count("messages")).toBe(0);
      expect(await store().count("conversations")).toBe(0);
      expect(await store().count("notebooks")).toBe(0);
    });
  });

  describe("chat", () => {
    it("keeps message order", async () => {
      const notebookId = await createNotebook("Test");
      await saveChat(
        { id: id("c1"), notebookId },
        ["a", "b", "c"].map((id) => userMessage(id)),
      );
      expect((await loadChat(id("c1"))).map((m) => m.id)).toEqual(["a", "b", "c"]);
    });

    it("keeps conversations apart, titled by their first question", async () => {
      const notebookId = await createNotebook("Test");
      await saveChat({ id: id("c1"), notebookId }, [userMessage("a", "What is a  cache?")]);
      await saveChat({ id: id("c2"), notebookId }, [userMessage("b", "Summarise the key ideas")]);
      expect((await loadChat(id("c1"))).map((m) => m.id)).toEqual(["a"]);
      expect((await store().getConversation(id("c1")))?.title).toBe("What is a cache?");
      expect((await latestConversation(notebookId))?.id).toBe(id("c2"));
    });

    it("keeps a renamed title when the chat goes on, and deletes a conversation", async () => {
      const notebookId = await createNotebook("Test");
      await saveChat({ id: id("c1"), notebookId }, [userMessage("a", "First")]);
      await renameConversation(id("c1"), "  Mine ");
      await saveChat({ id: id("c1"), notebookId }, [
        userMessage("a", "First"),
        userMessage("b", "Second"),
      ]);
      expect((await store().getConversation(id("c1")))?.title).toBe("Mine");
      await deleteConversation(id("c1"));
      expect(await store().count("conversations")).toBe(0);
      expect(await store().count("messages")).toBe(0);
    });
  });

  describe("conversation titles", () => {
    it("shortens long questions at a word", () => {
      const title = conversationTitle([userMessage("a", "word ".repeat(40))]);
      expect(title.length).toBeLessThanOrEqual(73);
      expect(title.endsWith("…")).toBe(true);
    });

    it("is empty without a question", () => {
      expect(conversationTitle([])).toBe("");
    });
  });

  describe("outputs", () => {
    it("marks abandoned generations as interrupted", async () => {
      const notebookId = await createNotebook("Test");
      const model = { provider: "openai" as const, modelId: "m" };
      const running = await createOutput({
        notebookId,
        toolId: "quiz",
        title: "Q",
        options: {},
        sourceIds: [],
        model,
      });
      const stale = await createOutput({
        notebookId,
        toolId: "quiz",
        title: "Q",
        options: {},
        sourceIds: [],
        model,
      });
      await markInterruptedOutputs(new Set([running]), "interrupted");
      expect((await store().getOutput(running))?.status).toBe("generating");
      expect((await store().getOutput(stale))?.status).toBe("error");
    });
  });

  describe("backup", () => {
    it("round-trips notebooks and rebuilds passages, without settings", async () => {
      const notebookId = await createNotebook("Kept");
      await addSource({ notebookId, title: "a", kind: "text", text: "hello world" });
      await updateProvider("openai", { enabled: true, apiKey: "secret" });
      const backup = await exportBackup();
      expect(JSON.stringify(backup)).not.toContain("secret");
      await deleteAllData();
      expect(await importBackup(JSON.parse(JSON.stringify(backup)))).toBe(1);
      expect((await store().listNotebooks())[0].title).toBe("Kept");
      expect(await store().count("chunks")).toBe(1);
    });

    it("round-trips conversations", async () => {
      const notebookId = await createNotebook("Kept");
      await saveChat({ id: id("backup-c"), notebookId }, [userMessage("a", "Hello there")]);
      const backup = await exportBackup();
      expect(backup.format).toBe(2);
      await deleteAllData();
      await importBackup(JSON.parse(JSON.stringify(backup)));
      expect((await store().getConversation(id("backup-c")))?.title).toBe("Hello there");
      expect((await loadChat(id("backup-c"))).map((m) => m.id)).toEqual(["a"]);
    });

    it("imports a format 1 backup, turning each notebook's chat into a conversation", async () => {
      await importBackup({
        app: "better-vault",
        format: 1,
        exportedAt: 1,
        notebooks: [{ id: "n1", title: "Old", createdAt: 1, updatedAt: 1 }],
        sources: [],
        messages: [
          { id: "n1:a", notebookId: "n1", createdAt: 5, message: userMessage("a", "Old question") },
        ],
        outputs: [],
      });
      expect((await store().getConversation("n1"))?.title).toBe("Old question");
      expect((await loadChat("n1")).map((m) => m.id)).toEqual(["a"]);
    });

    it("rejects files that are not backups", async () => {
      await expect(importBackup({ hello: 1 })).rejects.toThrow("invalid-backup");
    });
  });

  describe("settings", () => {
    it("starts with no provider ready", async () => {
      const settings = await getSettings();
      expect(availableModels(settings)).toEqual([]);
      expect(activeModel(settings)).toBeNull();
    });

    it("needs a key for cloud providers and an address for local ones", () => {
      const settings = defaultSettings();
      settings.providers.anthropic.enabled = true;
      expect(isProviderReady(settings, "anthropic")).toBe(false);
      settings.providers.anthropic.apiKey = "k";
      expect(isProviderReady(settings, "anthropic")).toBe(true);
      settings.providers.ollama.enabled = true;
      expect(isProviderReady(settings, "ollama")).toBe(true);
    });

    it("falls back to the first available model when the chosen one is gone", () => {
      const settings = defaultSettings();
      settings.providers.anthropic = {
        ...settings.providers.anthropic,
        enabled: true,
        apiKey: "k",
        models: ["x", "y"],
      };
      settings.model = { provider: "openai", modelId: "gone" };
      expect(activeModel(settings)).toEqual({ provider: "anthropic", modelId: "x" });
      settings.model = { provider: "anthropic", modelId: "y" };
      expect(activeModel(settings)).toEqual({ provider: "anthropic", modelId: "y" });
    });
  });
});

describe("version 2 upgrade", () => {
  it("cleans sources and passages saved before text cleaning, keeping their ids", async () => {
    const { default: Dexie } = await import("dexie");
    const name = "better-vault-upgrade-test";
    const old = new Dexie(name);
    old.version(1).stores({
      notebooks: "id, updatedAt",
      sources: "id, notebookId, createdAt",
      chunks: "id, notebookId, sourceId, [sourceId+index]",
      messages: "id, notebookId, [notebookId+createdAt]",
      outputs: "id, notebookId, status, [notebookId+createdAt]",
      settings: "key",
    });
    await old.open();
    await old.table("sources").add({
      id: "s1",
      notebookId: "n1",
      title: "PDF",
      kind: "pdf",
      text: "Q What CO5?",
      charCount: 18,
      selected: true,
      createdAt: 1,
    });
    await old
      .table("chunks")
      .add({ id: "s1:0", notebookId: "n1", sourceId: "s1", index: 0, text: "Q What CO5?" });
    old.close();

    const { BetterVaultDatabase } = await import("./database");
    const upgraded = new BetterVaultDatabase(name);
    const source = await upgraded.sources.get("s1");
    const chunk = await upgraded.chunks.get("s1:0");
    expect(source?.text).toBe("Q What CO5?");
    expect(source?.charCount).toBe("Q What CO5?".length);
    expect(chunk?.text).toBe("Q What CO5?");
    upgraded.close();
    await Dexie.delete(name);
  });
});

describe("version 3 upgrade", () => {
  it("turns each notebook's chat into its first conversation", async () => {
    const { default: Dexie } = await import("dexie");
    const name = "better-vault-upgrade-3-test";
    const old = new Dexie(name);
    old.version(2).stores({
      notebooks: "id, updatedAt",
      sources: "id, notebookId, createdAt",
      chunks: "id, notebookId, sourceId, [sourceId+index]",
      messages: "id, notebookId, [notebookId+createdAt]",
      outputs: "id, notebookId, status, [notebookId+createdAt]",
      settings: "key",
    });
    await old.open();
    await old.table("messages").bulkAdd([
      {
        id: "n1:a",
        notebookId: "n1",
        createdAt: 10,
        message: userMessage("a", "Why is the sky blue?"),
      },
      {
        id: "n1:b",
        notebookId: "n1",
        createdAt: 11,
        message: { id: "b", role: "assistant", parts: [] },
      },
    ]);
    await old.table("sources").add({
      id: "s1",
      notebookId: "n1",
      title: "PDF",
      kind: "pdf",
      text: "Contents\n Course outcome",
      charCount: 25,
      selected: true,
      createdAt: 1,
    });
    old.close();

    const { BetterVaultDatabase } = await import("./database");
    const upgraded = new BetterVaultDatabase(name);
    const conversation = await upgraded.conversations.get("n1");
    expect(conversation).toMatchObject({
      notebookId: "n1",
      title: "Why is the sky blue?",
      createdAt: 10,
      updatedAt: 11,
    });
    expect((await upgraded.messages.toArray()).map((row) => row.conversationId)).toEqual([
      "n1",
      "n1",
    ]);
    expect((await upgraded.sources.get("s1"))?.text).toBe("Contents\nCourse outcome");
    upgraded.close();
    await Dexie.delete(name);
  });
});
