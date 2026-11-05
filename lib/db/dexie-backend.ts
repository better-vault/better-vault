import type { Backend } from "./backend";
import { BetterVaultDatabase } from "./database";
import type { Source, StudioOutput } from "./types";

/** The web app's backend: the IndexedDB database in `./database`. */
export function createDexieBackend(db = new BetterVaultDatabase()): Backend & {
  db: BetterVaultDatabase;
} {
  const content = [
    db.calendar,
    db.vaults,
    db.folders,
    db.notebooks,
    db.sources,
    db.chunks,
    db.conversations,
    db.messages,
    db.outputs,
    db.blobs,
  ];

  return {
    db,

    listNotebooks: () => db.notebooks.orderBy("updatedAt").reverse().toArray(),
    getNotebook: (id) => db.notebooks.get(id),
    addNotebook: async (notebook) => {
      await db.notebooks.add(notebook);
    },
    patchNotebook: async (id, patch) => {
      await db.notebooks.update(id, patch);
    },
    deleteNotebook: (id) =>
      db.transaction("rw", content, async () => {
        await db.sources.where("notebookId").equals(id).delete();
        await db.chunks.where("notebookId").equals(id).delete();
        await db.messages.where("notebookId").equals(id).delete();
        await db.conversations.where("notebookId").equals(id).delete();
        await db.outputs.where("notebookId").equals(id).delete();
        await db.blobs.where("notebookId").equals(id).delete();
        await db.notebooks.delete(id);
      }),
    countSources: async () => {
      const counts: Record<string, number> = {};
      await db.sources.each((source) => {
        counts[source.notebookId] = (counts[source.notebookId] ?? 0) + 1;
      });
      return counts;
    },

    listCalendar: () => db.calendar.toArray(),
    saveCalendar: (entries) =>
      db.transaction("rw", db.calendar, async () => {
        await db.calendar.clear();
        await db.calendar.bulkPut(entries);
      }),

    listVaults: () => db.vaults.toArray(),
    putVault: async (vault) => {
      await db.vaults.put(vault);
    },
    deleteVault: async (id) => {
      await db.vaults.delete(id);
    },

    listFolders: () => db.folders.toArray(),
    addFolder: async (folder) => {
      await db.folders.add(folder);
    },
    patchFolder: async (id, patch) => {
      await db.folders.update(id, patch);
    },
    deleteFolder: (id) =>
      db.transaction("rw", [db.folders, db.notebooks], async () => {
        const folder = await db.folders.get(id);
        if (!folder) return;
        await db.folders.where("parentId").equals(id).modify({ parentId: folder.parentId });
        await db.notebooks
          .filter((notebook) => notebook.folderId === id)
          .modify({ folderId: folder.parentId });
        await db.folders.delete(id);
      }),

    addSource: (source, chunks, now) =>
      db.transaction("rw", [db.sources, db.chunks, db.notebooks], async () => {
        await db.sources.add(source);
        await db.chunks.bulkAdd(chunks);
        await db.notebooks.update(source.notebookId, { updatedAt: now });
      }),
    getSource: (id) => db.sources.get(id),
    getSources: async (ids) =>
      (await db.sources.bulkGet(ids)).filter((source): source is Source => source !== undefined),
    listAllSources: () => db.sources.toArray(),
    listSources: (notebookId) =>
      db.sources.where("notebookId").equals(notebookId).sortBy("createdAt"),
    patchSource: async (id, patch) => {
      await db.sources.update(id, patch);
    },
    patchNotebookSources: async (notebookId, patch) => {
      await db.sources.where("notebookId").equals(notebookId).modify(patch);
    },
    deleteSource: (id) =>
      db.transaction("rw", [db.sources, db.chunks, db.blobs], async () => {
        await db.chunks.where("sourceId").equals(id).delete();
        await db.blobs.where("sourceId").equals(id).delete();
        await db.sources.delete(id);
      }),
    getChunks: (sourceIds) => db.chunks.where("sourceId").anyOf(sourceIds).toArray(),

    getConversation: (id) => db.conversations.get(id),
    listConversations: (notebookId) =>
      db.conversations
        .where("[notebookId+updatedAt]")
        .between([notebookId, -Infinity], [notebookId, Infinity])
        .reverse()
        .toArray(),
    loadMessages: (conversationId) =>
      db.messages
        .where("[conversationId+createdAt]")
        .between([conversationId, -Infinity], [conversationId, Infinity])
        .toArray(),
    saveChat: (conversation, rows) =>
      db.transaction("rw", [db.messages, db.conversations, db.notebooks], async () => {
        await db.messages.where("conversationId").equals(conversation.id).delete();
        await db.messages.bulkPut(rows);
        const saved = await db.conversations.get(conversation.id);
        await db.conversations.put({
          ...conversation,
          title: saved?.title || conversation.title,
          createdAt: saved?.createdAt ?? conversation.createdAt,
        });
        await db.notebooks.update(conversation.notebookId, { updatedAt: conversation.updatedAt });
      }),
    patchConversation: async (id, patch) => {
      await db.conversations.update(id, patch);
    },
    deleteConversation: (id) =>
      db.transaction("rw", [db.messages, db.conversations], async () => {
        await db.messages.where("conversationId").equals(id).delete();
        await db.conversations.delete(id);
      }),

    getOutput: (id) => db.outputs.get(id),
    listAllOutputs: () => db.outputs.toArray(),
    listOutputs: async (notebookId) =>
      (await db.outputs.where("notebookId").equals(notebookId).sortBy("createdAt")).reverse(),
    addOutput: (output) =>
      db.transaction("rw", [db.outputs, db.notebooks], async () => {
        await db.outputs.add(output);
        await db.notebooks.update(output.notebookId, { updatedAt: output.createdAt });
      }),
    patchOutput: async (id, patch) => {
      await db.outputs.update(id, patch);
    },
    patchReadyOutput: async (id, patch) => {
      const changed = await db.outputs
        .where("id")
        .equals(id)
        .and((output) => output.status === "ready")
        .modify(patch);
      return changed > 0;
    },
    interruptOutputs: async (running, error) => {
      const keep = new Set(running);
      await db.outputs
        .where("status")
        .equals("generating")
        .filter((output) => !keep.has(output.id))
        .modify({ status: "error", error } satisfies Partial<StudioOutput>);
    },
    deleteOutput: (id) =>
      db.transaction("rw", [db.outputs, db.blobs], async () => {
        await db.blobs.where("outputId").equals(id).delete();
        await db.outputs.delete(id);
      }),

    putBlob: async (blob) => {
      await db.blobs.put(blob);
    },
    getBlob: (id) => db.blobs.get(id),

    getSetting: async (key) => (await db.settings.get(key))?.value,
    putSetting: async (key, value) => {
      await db.settings.put({ key, value });
    },
    clearSettings: () => db.settings.clear(),

    exportAll: async () => {
      const [
        calendar,
        vaults,
        folders,
        notebooks,
        sources,
        conversations,
        messages,
        outputs,
        blobs,
      ] = await Promise.all([
        db.calendar.toArray(),
        db.vaults.toArray(),
        db.folders.toArray(),
        db.notebooks.toArray(),
        db.sources.toArray(),
        db.conversations.toArray(),
        db.messages.toArray(),
        db.outputs.toArray(),
        db.blobs.toArray(),
      ]);
      return {
        calendar,
        vaults,
        folders,
        notebooks,
        sources,
        conversations,
        messages,
        outputs,
        blobs,
      };
    },
    importAll: (data, chunks) =>
      db.transaction("rw", content, async () => {
        await db.calendar.bulkPut(data.calendar);
        await db.vaults.bulkPut(data.vaults);
        await db.folders.bulkPut(data.folders);
        await db.notebooks.bulkPut(data.notebooks);
        await db.conversations.bulkPut(data.conversations);
        await db.sources.bulkPut(data.sources);
        await db.chunks
          .where("sourceId")
          .anyOf(data.sources.map((source) => source.id))
          .delete();
        await db.chunks.bulkPut(chunks);
        await db.messages.bulkPut(data.messages);
        await db.outputs.bulkPut(data.outputs);
        await db.blobs.bulkPut(data.blobs);
      }),
    clearAll: () =>
      db.transaction("rw", content, async () => {
        await Promise.all(content.map((table) => table.clear()));
      }),
    count: (table) => db.table(table).count(),
  };
}
