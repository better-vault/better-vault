/**
 * What a source is, for people: "CSV", "Word document", "YouTube video". The
 * stored `kind` says how the text is read and shown (Markdown is rendered,
 * a YouTube transcript has a player); the format says what the file or page
 * was, from its name, address or kind. Old sources have no format saved and
 * get theirs from their file name, so nothing needs migrating.
 *
 * Shared by the page and the server: no React or icons here (those are in
 * components/sources/source-format.ts).
 */

/** How a source's text is read and shown. */
export const sourceKinds = ["text", "markdown", "pdf", "url", "youtube"] as const;
export type SourceKind = (typeof sourceKinds)[number];

export const sourceFormats = [
  "text",
  "markdown",
  "pdf",
  "web",
  "youtube",
  "csv",
  "tsv",
  "json",
  "xml",
  "yaml",
  "html",
  "code",
  "log",
  "docx",
  "xlsx",
  "pptx",
  "epub",
] as const;
export type SourceFormat = (typeof sourceFormats)[number];

/** File extensions and the format each one is. */
const byExtension: Record<string, SourceFormat> = {
  pdf: "pdf",
  md: "markdown",
  markdown: "markdown",
  mdx: "markdown",
  txt: "text",
  text: "text",
  csv: "csv",
  tsv: "tsv",
  tab: "tsv",
  json: "json",
  jsonl: "json",
  ndjson: "json",
  geojson: "json",
  xml: "xml",
  rss: "xml",
  atom: "xml",
  svg: "xml",
  yaml: "yaml",
  yml: "yaml",
  toml: "yaml",
  ini: "yaml",
  html: "html",
  htm: "html",
  xhtml: "html",
  log: "log",
  docx: "docx",
  xlsx: "xlsx",
  pptx: "pptx",
  epub: "epub",
  // Source code: read as text, shown as code.
  js: "code",
  mjs: "code",
  cjs: "code",
  jsx: "code",
  ts: "code",
  tsx: "code",
  py: "code",
  rb: "code",
  go: "code",
  rs: "code",
  java: "code",
  kt: "code",
  swift: "code",
  c: "code",
  h: "code",
  cpp: "code",
  hpp: "code",
  cs: "code",
  php: "code",
  sh: "code",
  bash: "code",
  zsh: "code",
  sql: "code",
  css: "code",
  scss: "code",
  lua: "code",
  r: "code",
  dart: "code",
  scala: "code",
  tex: "code",
};

/** Formats the browser reads as plain text, without the server. */
export const textFormats: ReadonlySet<SourceFormat> = new Set([
  "text",
  "csv",
  "tsv",
  "json",
  "xml",
  "yaml",
  "code",
  "log",
]);

/** Formats the server turns into text (uploaded as files). */
export const serverFormats: ReadonlySet<SourceFormat> = new Set([
  "pdf",
  "html",
  "docx",
  "xlsx",
  "pptx",
  "epub",
]);

/** Every extension the file picker and storage browser offer. */
export const SOURCE_EXTENSIONS = Object.keys(byExtension);

const MIME: Record<string, SourceFormat> = {
  "application/pdf": "pdf",
  "text/markdown": "markdown",
  "text/csv": "csv",
  "text/tab-separated-values": "tsv",
  "application/json": "json",
  "application/xml": "xml",
  "text/xml": "xml",
  "application/yaml": "yaml",
  "text/yaml": "yaml",
  "text/html": "html",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "application/epub+zip": "epub",
};

export function extensionOf(name: string): string {
  const base = name.split(/[?#]/)[0].split("/").pop() ?? "";
  return base.includes(".") ? (base.split(".").pop() ?? "").toLowerCase() : "";
}

/** The format of a file from its name, then its media type; null when it can't be read. */
export function formatOfFile(name: string, mime = ""): SourceFormat | null {
  const fromName = byExtension[extensionOf(name)];
  if (fromName) return fromName;
  const fromMime = MIME[mime.split(";")[0].trim().toLowerCase()];
  if (fromMime) return fromMime;
  if (mime.startsWith("text/")) return "text";
  return null;
}

/** The format to show for a source: saved, or worked out from its kind, file name or address. */
export function sourceFormatOf(source: {
  kind: SourceKind;
  format?: SourceFormat;
  fileName?: string;
}): SourceFormat {
  if (source.format) return source.format;
  switch (source.kind) {
    case "markdown":
      return "markdown";
    case "pdf":
      return "pdf";
    case "url":
      return "web";
    case "youtube":
      return "youtube";
    case "text":
      return (source.fileName && formatOfFile(source.fileName)) || "text";
  }
}

/** How a file of this format is stored: its kind. */
export function kindOfFormat(format: SourceFormat): SourceKind {
  if (format === "markdown") return "markdown";
  if (format === "pdf") return "pdf";
  return "text";
}
