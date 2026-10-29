import type { Backend, StoreContent, TableName } from "../backend";
import type { Chunk, Conversation, Notebook, Source, StoredMessage, StudioOutput } from "../types";

/**
 * The desktop app's store: one SQLite file. Each row is kept whole as JSON in
 * `doc`, with the fields that are searched or sorted copied into columns, the
 * same ones the web app indexes in IndexedDB.
 *
 * This module only takes a database handle, so it runs under Node's built-in
 * `node:sqlite` in the desktop app and in tests alike.
 */

type SqlValue = string | number | null;

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

type DocTable = Exclude<TableName, "settings">;

/** The columns of each table, besides `id` and `doc`, and the fields they copy. */
const columns: Record<DocTable, Record<string, string>> = {
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
];

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

  const content: DocTable[] = [
    "notebooks",
    "sources",
    "chunks",
    "conversations",
    "messages",
    "outputs",
  ];

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
        deleteWhere("notebooks", "id", id);
      }),
    countSources: () => {
      const rows = db
        .prepare("SELECT notebook_id AS id, COUNT(*) AS n FROM sources GROUP BY notebook_id")
        .all() as { id: string; n: number }[];
      return Object.fromEntries(rows.map((row) => [row.id, Number(row.n)]));
    },

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
    deleteOutput: (id) => {
      deleteWhere("outputs", "id", id);
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
      notebooks: docs(db.prepare("SELECT doc FROM notebooks").all()),
      sources: docs(db.prepare("SELECT doc FROM sources").all()),
      conversations: docs(db.prepare("SELECT doc FROM conversations").all()),
      messages: docs(db.prepare("SELECT doc FROM messages").all()),
      outputs: docs(db.prepare("SELECT doc FROM outputs").all()),
    }),
    importAll: (data, chunks) =>
      transaction(db, () => {
        for (const row of data.notebooks) put("notebooks", row);
        for (const row of data.conversations) put("conversations", row);
        for (const row of data.sources) {
          put("sources", row);
          deleteWhere("chunks", "source_id", row.id);
        }
        for (const row of chunks) put("chunks", row);
        for (const row of data.messages) put("messages", row);
        for (const row of data.outputs) put("outputs", row);
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
  if (!(table in columns) && table !== "settings") throw new Error(`Unknown table: ${table}`);
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
