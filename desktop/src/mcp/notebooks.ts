import { randomBytes } from "node:crypto";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Chunk, Notebook, Source } from "../../../lib/db/types";
import { chunkText, normaliseText } from "../../../lib/grounding/chunk";
import { selectPassages } from "../../../lib/grounding/passages";
import { sourceFormatOf } from "../../../lib/sources/formats";
import { readUrl } from "../../../lib/sources/read-url";
import {
  cut,
  DEFAULT_VAULT,
  failure,
  findVault,
  guarded,
  text,
  turnedOff,
  vaultName,
  type ToolContext,
} from "./context";

const newId = () => randomBytes(12).toString("base64url");

/** Vaults, folders, notebooks and their sources. */
export function registerNotebookTools(ctx: ToolContext) {
  const { mcp, store, log, changed, canWrite } = ctx;

  const sourceOut = (source: Source) => ({
    id: source.id,
    title: source.title,
    format: sourceFormatOf(source),
    url: source.url,
    fileName: source.fileName,
    selected: source.selected,
    characters: source.charCount,
  });

  const notebookOut = (notebook: Notebook) => ({
    id: notebook.id,
    title: notebook.title,
    vault: vaultName(store, notebook.vaultId),
    folderId: notebook.folderId ?? null,
    pinned: notebook.pinned ?? false,
    updatedAt: new Date(notebook.updatedAt).toISOString(),
  });

  const getNotebook = (id: string) => {
    const notebook = store.getNotebook(id);
    if (!notebook) throw new Error("No notebook with that id. list_notebooks gives the ids.");
    return notebook;
  };

  mcp.registerTool(
    "list_vaults",
    {
      description: "List the user's vaults (spaces of notebooks, notes and skills).",
      annotations: { readOnlyHint: true },
    },
    async () => {
      log("list_vaults");
      const vaults = store.listVaults();
      const all = vaults.some((vault) => vault.id === DEFAULT_VAULT)
        ? vaults
        : [{ id: DEFAULT_VAULT, name: "" }, ...vaults];
      return text(all.map((vault) => ({ id: vault.id, name: vault.name || "My vault" })));
    },
  );

  mcp.registerTool(
    "list_folders",
    {
      description: "List the folders notebooks are kept in (folders can hold folders).",
      inputSchema: { vault: z.string().optional().describe("Vault name or id") },
      annotations: { readOnlyHint: true },
    },
    async ({ vault }) =>
      guarded(() => {
        log("list_folders");
        const vaultId = vault ? findVault(store, vault) : null;
        return text(
          store
            .listFolders()
            .filter((folder) => !vaultId || (folder.vaultId ?? DEFAULT_VAULT) === vaultId)
            .map((folder) => ({
              id: folder.id,
              name: folder.name,
              parentId: folder.parentId,
              vault: vaultName(store, folder.vaultId),
            })),
        );
      }),
  );

  mcp.registerTool(
    "list_notebooks",
    {
      description: "List notebooks with their sources. Optionally only one vault's.",
      inputSchema: { vault: z.string().optional().describe("Vault name or id") },
      annotations: { readOnlyHint: true },
    },
    async ({ vault }) =>
      guarded(() => {
        log("list_notebooks");
        const vaultId = vault ? findVault(store, vault) : null;
        return text(
          store
            .listNotebooks()
            .filter((each) => !vaultId || (each.vaultId ?? DEFAULT_VAULT) === vaultId)
            .map((notebook) => ({
              ...notebookOut(notebook),
              sources: store.listSources(notebook.id).map(sourceOut),
            })),
        );
      }),
  );

  mcp.registerTool(
    "create_notebook",
    {
      description: "Create an empty notebook. Add sources to it with add_source.",
      inputSchema: {
        title: z.string().min(1).max(200),
        vault: z.string().optional().describe("Vault name; the default vault when left out"),
        folderId: z.string().optional().describe("A folder id from list_folders"),
      },
    },
    async ({ title, vault, folderId }) =>
      guarded(() => {
        if (!canWrite("notebooks")) return turnedOff("notebooks");
        log("create_notebook");
        const vaultId = findVault(store, vault);
        if (folderId && !store.listFolders().some((folder) => folder.id === folderId))
          return failure("No folder with that id.");
        const now = Date.now();
        const notebook: Notebook = {
          id: newId(),
          title: title.trim(),
          vaultId,
          folderId: folderId ?? null,
          createdAt: now,
          updatedAt: now,
        };
        store.addNotebook(notebook);
        changed(["notebooks"]);
        return text({ created: notebookOut(notebook) });
      }),
  );

  mcp.registerTool(
    "rename_notebook",
    {
      description: "Rename a notebook.",
      inputSchema: { notebookId: z.string(), title: z.string().min(1).max(200) },
    },
    async ({ notebookId, title }) =>
      guarded(() => {
        if (!canWrite("notebooks")) return turnedOff("notebooks");
        log("rename_notebook");
        getNotebook(notebookId);
        store.patchNotebook(notebookId, { title: title.trim(), updatedAt: Date.now() });
        changed(["notebooks"]);
        return text({ renamed: notebookOut(getNotebook(notebookId)) });
      }),
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
    async ({ query, notebookId, limit = 8 }) =>
      guarded(() => {
        log("search_sources");
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
      }),
  );

  mcp.registerTool(
    "read_source",
    {
      description:
        "Read a source's full text. YouTube transcripts have a [mm:ss] time at the start of each paragraph.",
      inputSchema: { sourceId: z.string() },
      annotations: { readOnlyHint: true },
    },
    async ({ sourceId }) => {
      log("read_source");
      const source = store.getSource(sourceId);
      return source
        ? text(`# ${source.title}\n\n${cut(source.text)}`)
        : failure("No source with that id.");
    },
  );

  mcp.registerTool(
    "add_source",
    {
      description:
        "Add a source to a notebook: pasted text, or a link to a web page, an online PDF or a public YouTube video with captions (its transcript is added). The notebook's chat and Studio then use it.",
      inputSchema: {
        notebookId: z.string(),
        url: z.string().url().optional().describe("A web page, PDF or YouTube address"),
        text: z.string().max(2_000_000).optional().describe("Text to add, when there is no url"),
        title: z.string().max(200).optional().describe("The source's title (pasted text)"),
      },
    },
    async ({ notebookId, url, text: pasted, title }) =>
      guarded(async () => {
        if (!canWrite("sources")) return turnedOff("sources");
        if (!url && !pasted?.trim()) return failure("Give a url or some text.");
        log("add_source");
        const notebook = getNotebook(notebookId);
        const read = url
          ? await readUrl(url)
          : {
              title: title?.trim() || "Pasted text",
              text: pasted ?? "",
              kind: "text" as const,
              format: "text" as const,
              url: undefined,
            };
        const body = normaliseText(read.text);
        if (!body) return failure("No text could be read from that.");
        const source: Source = {
          id: newId(),
          notebookId: notebook.id,
          title: (title?.trim() || read.title).slice(0, 200) || "Untitled",
          kind: read.kind,
          format: read.format,
          ...(read.url ? { url: read.url } : {}),
          text: body,
          charCount: body.length,
          selected: true,
          createdAt: Date.now(),
        };
        const chunks: Chunk[] = chunkText(body).map((piece, index) => ({
          id: `${source.id}:${index}`,
          notebookId: notebook.id,
          sourceId: source.id,
          index,
          text: piece,
        }));
        store.addSource(source, chunks, Date.now());
        changed(["sources", "chunks", "notebooks"]);
        return text({ added: sourceOut(source) });
      }),
  );

  mcp.registerTool(
    "set_source_selected",
    {
      description:
        "Select or deselect a source. Only selected sources are used by the notebook's chat and Studio.",
      inputSchema: { sourceId: z.string(), selected: z.boolean() },
    },
    async ({ sourceId, selected }) =>
      guarded(() => {
        if (!canWrite("sources")) return turnedOff("sources");
        log("set_source_selected");
        if (!store.getSource(sourceId)) return failure("No source with that id.");
        store.patchSource(sourceId, { selected });
        changed(["sources"]);
        return text({ sourceId, selected });
      }),
  );

  mcp.registerTool(
    "delete_source",
    {
      description: "Delete a source from its notebook, with its passages.",
      inputSchema: { sourceId: z.string() },
      annotations: { destructiveHint: true },
    },
    async ({ sourceId }) =>
      guarded(() => {
        if (!canWrite("sources")) return turnedOff("sources");
        log("delete_source");
        const source = store.getSource(sourceId);
        if (!source) return failure("No source with that id.");
        store.deleteSource(sourceId);
        changed(["sources", "chunks", "blobs"]);
        return text({ deleted: source.title });
      }),
  );

  mcp.registerResource(
    "source",
    // A source's text, by notebook and source id.
    new ResourceTemplate("source://{notebookId}/{sourceId}", { list: undefined }),
    { description: "A source's text", mimeType: "text/plain" },
    async (uri, { sourceId }) => {
      const source = store.getSource(String(sourceId));
      if (!source) throw new Error("No such source.");
      return { contents: [{ uri: uri.href, mimeType: "text/plain", text: source.text }] };
    },
  );
}
