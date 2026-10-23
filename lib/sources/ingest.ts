import type { Source, SourceKind } from "@/lib/db/database";
import { addSource } from "@/lib/db/sources";

export const MAX_FILE_BYTES = 20 * 1024 * 1024;

/** What the file picker offers. */
export const ACCEPTED_FILES =
  ".pdf,.md,.markdown,.mdx,.txt,.text,.csv,application/pdf,text/plain,text/markdown,text/csv";

export type IngestFailure = "type" | "tooLarge" | "empty" | "read";

/** A source that could not be added, with the reason and the file or page it came from. */
export class IngestError extends Error {
  constructor(
    readonly reason: IngestFailure,
    /** The file name or address. */
    readonly subject: string,
    readonly detail = "",
  ) {
    super(detail || reason);
    this.name = "IngestError";
  }
}

const extension = (name: string) => name.toLowerCase().split(".").pop() ?? "";
const titleFromFile = (name: string) => name.replace(/\.[^.]+$/, "") || name;

async function save(input: Parameters<typeof addSource>[0]): Promise<Source> {
  try {
    return await addSource(input);
  } catch (error) {
    if (error instanceof Error && error.message === "empty-source") {
      throw new IngestError("empty", input.fileName ?? input.url ?? input.title);
    }
    throw error;
  }
}

async function postForText(body: BodyInit, headers?: HeadersInit) {
  const response = await fetch("/api/sources/parse", { method: "POST", body, headers });
  const json = (await response.json().catch(() => ({}))) as {
    title?: string;
    text?: string;
    kind?: SourceKind;
    url?: string;
    error?: string;
  };
  if (!response.ok || json.text === undefined) throw new Error(json.error ?? response.statusText);
  return json as { title: string; text: string; kind: SourceKind; url?: string };
}

/** Reads a PDF, Markdown or text file and adds it to the notebook. */
export async function ingestFile(notebookId: string, file: File): Promise<Source> {
  if (file.size > MAX_FILE_BYTES) throw new IngestError("tooLarge", file.name);
  const ext = extension(file.name);
  const base = { notebookId, title: titleFromFile(file.name), fileName: file.name };

  if (ext === "pdf" || file.type === "application/pdf") {
    const form = new FormData();
    form.append("file", file);
    let parsed;
    try {
      parsed = await postForText(form);
    } catch (error) {
      throw new IngestError("read", file.name, error instanceof Error ? error.message : String(error));
    }
    return save({ ...base, kind: "pdf", text: parsed.text });
  }
  if (["md", "markdown", "mdx"].includes(ext) || file.type === "text/markdown") {
    return save({ ...base, kind: "markdown", text: await file.text() });
  }
  if (["txt", "text", "csv"].includes(ext) || file.type.startsWith("text/")) {
    return save({ ...base, kind: "text", text: await file.text() });
  }
  throw new IngestError("type", file.name);
}

/** Reads a web page (or an online PDF) and adds its main text. */
export async function ingestUrl(notebookId: string, address: string): Promise<Source> {
  let parsed;
  try {
    parsed = await postForText(JSON.stringify({ url: address }), { "content-type": "application/json" });
  } catch (error) {
    throw new IngestError("read", address, error instanceof Error ? error.message : String(error));
  }
  return save({ notebookId, title: parsed.title, kind: parsed.kind, text: parsed.text, url: parsed.url ?? address });
}

export function ingestText(notebookId: string, title: string, text: string): Promise<Source> {
  return save({ notebookId, title, kind: "text", text });
}
