import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { deleteAllData, exportBackup, importBackup } from "./backup";
import { db } from "./database";
import { createNotebook, deleteNotebook } from "./notebooks";
import { createOutput, markInterruptedOutputs } from "./outputs";
import { loadChat, saveChat } from "./messages";
import {
  activeModel,
  availableModels,
  defaultSettings,
  getSettings,
  isProviderReady,
  updateProvider,
} from "./settings";
import { addSource, getChunks } from "./sources";

beforeEach(async () => {
  await deleteAllData();
  await db.settings.clear();
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
    await expect(addSource({ notebookId, title: "x", kind: "text", text: "  " })).rejects.toThrow();
  });
});

describe("notebooks", () => {
  it("deletes a notebook with everything in it", async () => {
    const notebookId = await createNotebook("Test");
    await addSource({ notebookId, title: "a", kind: "text", text: "hello" });
    await saveChat(notebookId, [{ id: "m1", role: "user", parts: [{ type: "text", text: "hi" }] }]);
    await deleteNotebook(notebookId);
    expect(await db.sources.count()).toBe(0);
    expect(await db.chunks.count()).toBe(0);
    expect(await db.messages.count()).toBe(0);
    expect(await db.notebooks.count()).toBe(0);
  });
});

describe("chat", () => {
  it("keeps message order", async () => {
    const notebookId = await createNotebook("Test");
    const messages = ["a", "b", "c"].map((id) => ({
      id,
      role: "user" as const,
      parts: [{ type: "text" as const, text: id }],
    }));
    await saveChat(notebookId, messages);
    expect((await loadChat(notebookId)).map((m) => m.id)).toEqual(["a", "b", "c"]);
  });
});

describe("outputs", () => {
  it("marks abandoned generations as interrupted", async () => {
    const notebookId = await createNotebook("Test");
    const model = { provider: "openai" as const, modelId: "m" };
    const running = await createOutput({ notebookId, toolId: "quiz", title: "Q", options: {}, sourceIds: [], model });
    const stale = await createOutput({ notebookId, toolId: "quiz", title: "Q", options: {}, sourceIds: [], model });
    await markInterruptedOutputs(new Set([running]), "interrupted");
    expect((await db.outputs.get(running))?.status).toBe("generating");
    expect((await db.outputs.get(stale))?.status).toBe("error");
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
    expect((await db.notebooks.toArray())[0].title).toBe("Kept");
    expect(await db.chunks.count()).toBe(1);
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
    settings.providers.anthropic = { ...settings.providers.anthropic, enabled: true, apiKey: "k", models: ["x", "y"] };
    settings.model = { provider: "openai", modelId: "gone" };
    expect(activeModel(settings)).toEqual({ provider: "anthropic", modelId: "x" });
    settings.model = { provider: "anthropic", modelId: "y" };
    expect(activeModel(settings)).toEqual({ provider: "anthropic", modelId: "y" });
  });
});
