import type { Backend, StoreContent, TableName } from "../backend";
import type {
  Chunk,
  Conversation,
  Folder,
  Notebook,
  Source,
  StoredBlob,
  StoredMessage,
  StudioOutput,
  Vault,
  Note,
  Skill,
  CalendarEntry,
} from "../types";

/**
 * The desktop app's store: one SQLite file. Each row is kept whole as JSON in
 * `doc`, with the fields that are searched or sorted copied into columns, the
 * same ones the web app indexes in IndexedDB.
 *
 * This module only takes a database handle, so it runs under Node's built-in
 * `node:sqlite` in the desktop app and in tests alike.
 */

type SqlValue = string | number | null | Uint8Array;

/** The parts of a SQLite driver this store uses (`node:sqlite`'s `DatabaseSync`). */
export interface SqliteDatabase {
  exec(sql: string): void;
  prepare(sql: string): {
    run(...params: SqlValue[]): unknown;
    get(...params: SqlValue[]): unknown;
    all(...params: SqlValue[]): unknown[];
  };
}

/** `Backend` with plain return values: the main process runs it synchronously. */
export type SyncBackend = {
  [K in keyof Backend]: Backend[K] extends (...args: infer A) => Promise<infer R>
    ? (...args: A) => R
    : never;
};

/** Tables that keep each row as JSON. Settings and blobs have columns of their own. */
type DocTable = Exclude<TableName, "settings" | "blobs">;

/** The columns of each table, besides `id` and `doc`, and the fields they copy. */
const columns: Record<DocTable, Record<string, string>> = {
  calendar: { start: "start" },
  vaults: { updated_at: "updatedAt" },
  notes: { vault_id: "vaultId", updated_at: "updatedAt" },
  skills: { vault_id: "vaultId", name: "name" },
  folders: { parent_id: "parentId", updated_at: "updatedAt" },
  notebooks: { updated_at: "updatedAt" },
  sources: { notebook_id: "notebookId", created_at: "createdAt" },
  chunks: { notebook_id: "notebookId", source_id: "sourceId", idx: "index" },
  conversations: { notebook_id: "notebookId", updated_at: "updatedAt" },
  messages: {
    notebook_id: "notebookId",
    conversation_id: "conversationId",
    created_at: "createdAt",
  },
  outputs: { notebook_id: "notebookId", status: "status", created_at: "createdAt" },
};

/**
 * Schema versions, kept in `PRAGMA user_version`. Add a step for each change
 * and never edit one that has shipped.
 */
const migrations: string[] = [
  `
  CREATE TABLE notebooks (id TEXT PRIMARY KEY, updated_at REAL NOT NULL, doc TEXT NOT NULL);
  CREATE INDEX notebooks_updated ON notebooks (updated_at);

  CREATE TABLE sources (id TEXT PRIMARY KEY, notebook_id TEXT NOT NULL, created_at REAL NOT NULL, doc TEXT NOT NULL);
  CREATE INDEX sources_notebook ON sources (notebook_id, created_at);

  CREATE TABLE chunks (id TEXT PRIMARY KEY, notebook_id TEXT NOT NULL, source_id TEXT NOT NULL, idx INTEGER NOT NULL, doc TEXT NOT NULL);
  CREATE INDEX chunks_notebook ON chunks (notebook_id);
  CREATE INDEX chunks_source ON chunks (source_id, idx);

  CREATE TABLE conversations (id TEXT PRIMARY KEY, notebook_id TEXT NOT NULL, updated_at REAL NOT NULL, doc TEXT NOT NULL);
  CREATE INDEX conversations_notebook ON conversations (notebook_id, updated_at);

  CREATE TABLE messages (id TEXT PRIMARY KEY, notebook_id TEXT NOT NULL, conversation_id TEXT NOT NULL, created_at REAL NOT NULL, doc TEXT NOT NULL);
  CREATE INDEX messages_notebook ON messages (notebook_id);
  CREATE INDEX messages_conversation ON messages (conversation_id, created_at);

  CREATE TABLE outputs (id TEXT PRIMARY KEY, notebook_id TEXT NOT NULL, status TEXT NOT NULL, created_at REAL NOT NULL, doc TEXT NOT NULL);
  CREATE INDEX outputs_notebook ON outputs (notebook_id, created_at);
  CREATE INDEX outputs_status ON outputs (status);

  CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  `,
  // 2: folders on the notebooks page, and files kept with a notebook (an
  // audio overview's sound), stored as bytes. A notebook's icon, colour and
  // folder are optional fields of its row and need no column.
  `
  CREATE TABLE folders (id TEXT PRIMARY KEY, parent_id TEXT, updated_at REAL NOT NULL, doc TEXT NOT NULL);
  CREATE INDEX folders_parent ON folders (parent_id);

  CREATE TABLE blobs (id TEXT PRIMARY KEY, notebook_id TEXT NOT NULL, output_id TEXT, mime TEXT NOT NULL, created_at REAL NOT NULL, data BLOB NOT NULL);
  CREATE INDEX blobs_notebook ON blobs (notebook_id);
  CREATE INDEX blobs_output ON blobs (output_id);
  `,
  // 3: pictures taken from a PDF are kept as files of its source.
  `
  ALTER TABLE blobs ADD COLUMN source_id TEXT;
  CREATE INDEX blobs_source ON blobs (source_id);
  `,
  // 4: vaults. Notebooks and folders without a vault are in the default one.
  `
  CREATE TABLE vaults (id TEXT PRIMARY KEY, updated_at REAL NOT NULL, doc TEXT NOT NULL);
  `,
  // 5: calendar entries.
  `
  CREATE TABLE calendar (id TEXT PRIMARY KEY, start TEXT NOT NULL, doc TEXT NOT NULL);
  `,
  // 6: notes and skills, each in a vault.
  `
  CREATE TABLE notes (id TEXT PRIMARY KEY, vault_id TEXT NOT NULL, updated_at REAL NOT NULL, doc TEXT NOT NULL);
  CREATE INDEX notes_vault ON notes (vault_id);
  CREATE TABLE skills (id TEXT PRIMARY KEY, vault_id TEXT NOT NULL, name TEXT NOT NULL, doc TEXT NOT NULL);
  CREATE INDEX skills_vault ON skills (vault_id);
  `,
];

/** The schema version a database has once migrated. */
export const schemaVersion = migrations.length;

/** Brings the database's schema up to date. */
export function migrate(db: SqliteDatabase) {
  const { user_version: version } = db.prepare("PRAGMA user_version").get() as {
    user_version: number;
  };
  for (let at = version; at < migrations.length; at++) {
    transaction(db, () => {
      db.exec(migrations[at]);
      db.exec(`PRAGMA user_version = ${at + 1}`);
    });
  }
}

function transaction<T>(db: SqliteDatabase, run: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = run();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

/** Opens the store on a database, creating or upgrading its tables. */
export function createSqliteStore(db: SqliteDatabase): SyncBackend {
  migrate(db);

  const docs = <T>(rows: unknown[]) =>
    rows.map((row) => JSON.parse((row as { doc: string }).doc) as T);
  const one = <T>(row: unknown) =>
    row ? (JSON.parse((row as { doc: string }).doc) as T) : undefined;

  function write(table: DocTable, row: { id: string }, mode: "INSERT" | "INSERT OR REPLACE") {
    const names = Object.keys(columns[table]);
    const record = row as unknown as Record<string, unknown>;
    const values = names.map((name) => record[columns[table][name]] as SqlValue);
    db.prepare(
      `${mode} INTO ${table} (id, ${names.join(", ")}, doc) VALUES (?, ${names.map(() => "?").join(", ")}, ?)`,
    ).run(row.id, ...values, JSON.stringify(row));
  }
  const add = <T extends { id: string }>(table: DocTable, row: T) => write(table, row, "INSERT");
  const put = <T extends { id: string }>(table: DocTable, row: T) =>
    write(table, row, "INSERT OR REPLACE");

  function get<T>(table: DocTable, id: string): T | undefined {
    return one<T>(db.prepare(`SELECT doc FROM ${table} WHERE id = ?`).get(id));
  }

  /** Merges `patch` into a row, as Dexie's `update` does: `undefined` removes a field. */
  function patch<T extends { id: string }>(
    table: DocTable,
    id: string,
    change: Partial<T>,
  ): boolean {
    const row = get<T>(table, id);
    if (!row) return false;
    const merged: Record<string, unknown> = { ...row, ...change };
    for (const key of Object.keys(merged)) if (merged[key] === undefined) delete merged[key];
    put(table, merged as T);
    return true;
  }

  const touch = (notebookId: string, now: number) =>
    patch<Notebook>("notebooks", notebookId, { updatedAt: now });

  const deleteWhere = (table: DocTable, column: string, value: string) =>
    db.prepare(`DELETE FROM ${table} WHERE ${column} = ?`).run(value);

  const content: Exclude<TableName, "settings">[] = [
    "calendar",
    "vaults",
    "notes",
    "skills",
    "folders",
    "notebooks",
    "sources",
    "chunks",
    "conversations",
    "messages",
    "outputs",
    "blobs",
  ];

  type BlobRow = {
    id: string;
    notebook_id: string;
    output_id: string | null;
    source_id: string | null;
    mime: string;
    created_at: number;
    data: Uint8Array;
  };
  const blob = (row: BlobRow): StoredBlob => ({
    id: row.id,
    notebookId: row.notebook_id,
    ...(row.output_id ? { outputId: row.output_id } : {}),
    ...(row.source_id ? { sourceId: row.source_id } : {}),
    mime: row.mime,
    // node:sqlite returns a Uint8Array; copy it so it owns its bytes.
    data: new Uint8Array(row.data),
    createdAt: row.created_at,
  });
  const putBlob = (row: StoredBlob) =>
    db
      .prepare(
        "INSERT OR REPLACE INTO blobs (id, notebook_id, output_id, source_id, mime, created_at, data) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        row.id,
        row.notebookId,
        row.outputId ?? null,
        row.sourceId ?? null,
        row.mime,
        row.createdAt,
        row.data,
      );

  return {
    listNotebooks: () =>
      docs<Notebook>(
        db.prepare("SELECT doc FROM notebooks ORDER BY updated_at DESC, id DESC").all(),
      ),
    getNotebook: (id) => get<Notebook>("notebooks", id),
    addNotebook: (notebook) => add("notebooks", notebook),
    patchNotebook: (id, change) => {
      patch<Notebook>("notebooks", id, change);
    },
    deleteNotebook: (id) =>
      transaction(db, () => {
        for (const table of ["sources", "chunks", "messages", "conversations", "outputs"] as const)
          deleteWhere(table, "notebook_id", id);
        db.prepare("DELETE FROM blobs WHERE notebook_id = ?").run(id);
        deleteWhere("notebooks", "id", id);
      }),
    countSources: () => {
      const rows = db
        .prepare("SELECT notebook_id AS id, COUNT(*) AS n FROM sources GROUP BY notebook_id")
        .all() as { id: string; n: number }[];
      return Object.fromEntries(rows.map((row) => [row.id, Number(row.n)]));
    },

    listCalendar: () => docs<CalendarEntry>(db.prepare("SELECT doc FROM calendar").all()),
    saveCalendar: (entries) =>
      transaction(db, () => {
        db.exec("DELETE FROM calendar");
        for (const entry of entries) put("calendar", entry);
      }),

    listNotes: () => docs<Note>(db.prepare("SELECT doc FROM notes").all()),
    getNote: (id) => get<Note>("notes", id),
    putNote: (note) => {
      put("notes", note);
    },
    putNotes: (notes) =>
      transaction(db, () => {
        for (const note of notes) put("notes", note);
      }),
    deleteNote: (id) => {
      deleteWhere("notes", "id", id);
    },
    listSkills: () => docs<Skill>(db.prepare("SELECT doc FROM skills").all()),
    getSkill: (id) => get<Skill>("skills", id),
    putSkill: (skill) => {
      put("skills", skill);
    },
    deleteSkill: (id) => {
      deleteWhere("skills", "id", id);
    },

    listVaults: () => docs<Vault>(db.prepare("SELECT doc FROM vaults ORDER BY id").all()),
    putVault: (vault) => {
      put("vaults", vault);
    },
    deleteVault: (id) => {
      deleteWhere("vaults", "id", id);
    },

    listFolders: () => docs<Folder>(db.prepare("SELECT doc FROM folders ORDER BY id").all()),
    addFolder: (folder) => add("folders", folder),
    patchFolder: (id, change) => {
      patch<Folder>("folders", id, change);
    },
    deleteFolder: (id) =>
      transaction(db, () => {
        const folder = get<Folder>("folders", id);
        if (!folder) return;
        const children = db.prepare("SELECT id FROM folders WHERE parent_id = ?").all(id);
        for (const { id: child } of children as { id: string }[])
          patch<Folder>("folders", child, { parentId: folder.parentId });
        const notebooks = docs<Notebook>(db.prepare("SELECT doc FROM notebooks").all());
        for (const notebook of notebooks)
          if (notebook.folderId === id)
            patch<Notebook>("notebooks", notebook.id, { folderId: folder.parentId });
        deleteWhere("folders", "id", id);
      }),

    addSource: (source, chunks, now) =>
      transaction(db, () => {
        add("sources", source);
        for (const chunk of chunks) add("chunks", chunk);
        touch(source.notebookId, now);
      }),
    getSource: (id) => get<Source>("sources", id),
    getSources: (ids) => {
      const found = new Map(
        docs<Source>(
          db
            .prepare("SELECT doc FROM sources WHERE id IN (SELECT value FROM json_each(?))")
            .all(JSON.stringify(ids)),
        ).map((source) => [source.id, source]),
      );
      return ids.flatMap((id) => found.get(id) ?? []);
    },
    listAllSources: () => docs<Source>(db.prepare("SELECT doc FROM sources").all()),
    listSources: (notebookId) =>
      docs<Source>(
        db
          .prepare("SELECT doc FROM sources WHERE notebook_id = ? ORDER BY created_at, id")
          .all(notebookId),
      ),
    patchSource: (id, change) => {
      patch<Source>("sources", id, change);
    },
    patchNotebookSources: (notebookId, change) =>
      transaction(db, () => {
        const ids = db.prepare("SELECT id FROM sources WHERE notebook_id = ?").all(notebookId);
        for (const { id } of ids as { id: string }[]) patch<Source>("sources", id, change);
      }),
    deleteSource: (id) =>
      transaction(db, () => {
        deleteWhere("chunks", "source_id", id);
        db.prepare("DELETE FROM blobs WHERE source_id = ?").run(id);
        deleteWhere("sources", "id", id);
      }),
    getChunks: (sourceIds) =>
      docs<Chunk>(
        db
          .prepare("SELECT doc FROM chunks WHERE source_id IN (SELECT value FROM json_each(?))")
          .all(JSON.stringify(sourceIds)),
      ),

    getConversation: (id) => get<Conversation>("conversations", id),
    listConversations: (notebookId) =>
      docs<Conversation>(
        db
          .prepare(
            "SELECT doc FROM conversations WHERE notebook_id = ? ORDER BY updated_at DESC, id DESC",
          )
          .all(notebookId),
      ),
    loadMessages: (conversationId) =>
      docs<StoredMessage>(
        db
          .prepare("SELECT doc FROM messages WHERE conversation_id = ? ORDER BY created_at, id")
          .all(conversationId),
      ),
    saveChat: (conversation, rows) =>
      transaction(db, () => {
        deleteWhere("messages", "conversation_id", conversation.id);
        for (const row of rows) put("messages", row);
        const saved = get<Conversation>("conversations", conversation.id);
        put("conversations", {
          ...conversation,
          title: saved?.title || conversation.title,
          createdAt: saved?.createdAt ?? conversation.createdAt,
        });
        touch(conversation.notebookId, conversation.updatedAt);
      }),
    patchConversation: (id, change) => {
      patch<Conversation>("conversations", id, change);
    },
    deleteConversation: (id) =>
      transaction(db, () => {
        deleteWhere("messages", "conversation_id", id);
        deleteWhere("conversations", "id", id);
      }),

    getOutput: (id) => get<StudioOutput>("outputs", id),
    listAllOutputs: () => docs<StudioOutput>(db.prepare("SELECT doc FROM outputs").all()),
    listOutputs: (notebookId) =>
      docs<StudioOutput>(
        db
          .prepare(
            "SELECT doc FROM outputs WHERE notebook_id = ? ORDER BY created_at DESC, id DESC",
          )
          .all(notebookId),
      ),
    addOutput: (output) =>
      transaction(db, () => {
        add("outputs", output);
        touch(output.notebookId, output.createdAt);
      }),
    patchOutput: (id, change) => {
      patch<StudioOutput>("outputs", id, change);
    },
    patchReadyOutput: (id, change) =>
      transaction(db, () => {
        if (get<StudioOutput>("outputs", id)?.status !== "ready") return false;
        return patch<StudioOutput>("outputs", id, change);
      }),
    interruptOutputs: (running, error) =>
      transaction(db, () => {
        const keep = new Set(running);
        const ids = db.prepare("SELECT id FROM outputs WHERE status = 'generating'").all();
        for (const { id } of ids as { id: string }[])
          if (!keep.has(id)) patch<StudioOutput>("outputs", id, { status: "error", error });
      }),
    deleteOutput: (id) =>
      transaction(db, () => {
        db.prepare("DELETE FROM blobs WHERE output_id = ?").run(id);
        deleteWhere("outputs", "id", id);
      }),

    putBlob: (row) => {
      putBlob(row);
    },
    getBlob: (id) => {
      const row = db.prepare("SELECT * FROM blobs WHERE id = ?").get(id) as BlobRow | undefined;
      return row ? blob(row) : undefined;
    },

    getSetting: (key) => {
      const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as
        { value: string } | undefined;
      return row ? JSON.parse(row.value) : undefined;
    },
    putSetting: (key, value) => {
      db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run(
        key,
        JSON.stringify(value),
      );
    },
    clearSettings: () => {
      db.exec("DELETE FROM settings");
    },

    exportAll: (): StoreContent => ({
      calendar: docs(db.prepare("SELECT doc FROM calendar").all()),
      vaults: docs(db.prepare("SELECT doc FROM vaults").all()),
      notes: docs(db.prepare("SELECT doc FROM notes").all()),
      skills: docs(db.prepare("SELECT doc FROM skills").all()),
      folders: docs(db.prepare("SELECT doc FROM folders").all()),
      notebooks: docs(db.prepare("SELECT doc FROM notebooks").all()),
      sources: docs(db.prepare("SELECT doc FROM sources").all()),
      conversations: docs(db.prepare("SELECT doc FROM conversations").all()),
      messages: docs(db.prepare("SELECT doc FROM messages").all()),
      outputs: docs(db.prepare("SELECT doc FROM outputs").all()),
      blobs: (db.prepare("SELECT * FROM blobs").all() as BlobRow[]).map(blob),
    }),
    importAll: (data, chunks) =>
      transaction(db, () => {
        for (const row of data.calendar) put("calendar", row);
        for (const row of data.vaults) put("vaults", row);
        for (const row of data.notes) put("notes", row);
        for (const row of data.skills) put("skills", row);
        for (const row of data.folders) put("folders", row);
        for (const row of data.notebooks) put("notebooks", row);
        for (const row of data.conversations) put("conversations", row);
        for (const row of data.sources) {
          put("sources", row);
          deleteWhere("chunks", "source_id", row.id);
        }
        for (const row of chunks) put("chunks", row);
        for (const row of data.messages) put("messages", row);
        for (const row of data.outputs) put("outputs", row);
        for (const row of data.blobs) putBlob(row);
      }),
    clearAll: () =>
      transaction(db, () => {
        for (const table of content) db.exec(`DELETE FROM ${table}`);
      }),
    count: (table) => {
      const row = db.prepare(`SELECT COUNT(*) AS n FROM ${tableName(table)}`).get() as {
        n: number;
      };
      return Number(row.n);
    },
  };
}

/** Table names come from code, but check them before they go into SQL. */
function tableName(table: TableName): TableName {
  if (!(table in columns) && table !== "settings" && table !== "blobs")
    throw new Error(`Unknown table: ${table}`);
  return table;
}

/** Wraps the synchronous store in the `Backend` interface, for tests. */
export function asBackend(store: SyncBackend): Backend {
  return Object.fromEntries(
    Object.entries(store).map(([name, run]) => [
      name,
      async (...args: unknown[]) => (run as (...a: unknown[]) => unknown)(...args),
    ]),
  ) as unknown as Backend;
}
