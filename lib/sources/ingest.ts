import type { Source, SourceFormat, SourceKind } from "@/lib/db/database";
import { addSource, attachImages } from "@/lib/db/sources";
import {
  SOURCE_EXTENSIONS,
  formatOfFile,
  kindOfFormat,
  serverFormats,
  textFormats,
} from "@/lib/sources/formats";

export const MAX_FILE_BYTES = 20 * 1024 * 1024;

/** What the file picker offers. */
export const ACCEPTED_FILES = [
  ...SOURCE_EXTENSIONS.map((ext) => `.${ext}`),
  "application/pdf",
  "text/*",
].join(",");

export type IngestFailure = "type" | "tooLarge" | "empty" | "read" | "noCaptions" | "private";

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
    format?: SourceFormat;
    url?: string;
    error?: string;
    reason?: string;
  };
  if (!response.ok || json.text === undefined)
    throw new ParseError(json.error ?? response.statusText, json.reason);
  return json as {
    title: string;
    text: string;
    kind: SourceKind;
    format?: SourceFormat;
    url?: string;
  };
}

class ParseError extends Error {
  constructor(
    message: string,
    readonly reason?: string,
  ) {
    super(message);
  }
}

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * Reads a file and adds it to the notebook. Text files (CSV, JSON, code…) are
 * read here; PDF, HTML, Word, Excel, PowerPoint and EPUB go to the server.
 */
export async function ingestFile(notebookId: string, file: File): Promise<Source> {
  if (file.size > MAX_FILE_BYTES) throw new IngestError("tooLarge", file.name);
  const format = formatOfFile(file.name, file.type);
  if (!format) throw new IngestError("type", file.name);
  const base = { notebookId, title: titleFromFile(file.name), fileName: file.name, format };

  if (serverFormats.has(format)) {
    const form = new FormData();
    form.append("file", file);
    let parsed;
    try {
      parsed = await postForText(form);
    } catch (error) {
      throw new IngestError("read", file.name, message(error));
    }
    const source = await save({
      ...base,
      title: parsed.title || base.title,
      kind: parsed.kind,
      text: parsed.text,
    });
    if (format === "pdf") {
      // The pictures follow in the background; the source can be used at once.
      void import("./pdf-images")
        .then(({ pdfImages }) => pdfImages(file, source.text))
        .then((images) => attachImages(source, images))
        .catch(() => undefined);
    }
    return source;
  }
  if (format === "markdown" || textFormats.has(format)) {
    let text = await file.text();
    // Tabs are folded into spaces with the rest of the text; keep the columns apart.
    if (format === "tsv") text = text.replace(/\t/g, " | ");
    return save({ ...base, kind: kindOfFormat(format), text });
  }
  throw new IngestError("type", file.name);
}

/** Reads a web page, an online PDF or a YouTube video's transcript and adds its text. */
export async function ingestUrl(notebookId: string, address: string): Promise<Source> {
  let parsed;
  try {
    parsed = await postForText(JSON.stringify({ url: address }), {
      "content-type": "application/json",
    });
  } catch (error) {
    const reason = error instanceof ParseError ? error.reason : undefined;
    if (reason === "no-captions") throw new IngestError("noCaptions", address);
    if (reason === "private") throw new IngestError("private", address);
    throw new IngestError("read", address, message(error));
  }
  return save({
    notebookId,
    title: parsed.title,
    kind: parsed.kind,
    format: parsed.format,
    text: parsed.text,
    url: parsed.url ?? address,
  });
}

export function ingestText(notebookId: string, title: string, text: string): Promise<Source> {
  return save({ notebookId, title, kind: "text", text });
}
