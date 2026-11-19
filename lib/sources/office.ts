import { strFromU8, unzipSync } from "fflate";
import { parseHTML } from "linkedom";
import { cleanText } from "@/lib/grounding/clean";

/**
 * Word, Excel, PowerPoint and EPUB files are zip archives of XML. These read
 * the text out of them on the server, without the programs: paragraphs from
 * a document, each sheet as tab-separated rows, each slide's text, and a
 * book's chapters in reading order.
 */

/** No archive member is read past this size, so a "zip bomb" can't fill the memory. */
const MAX_MEMBER_BYTES = 60 * 1024 * 1024;

type Archive = Record<string, Uint8Array>;

function open(data: Uint8Array, wanted: (name: string) => boolean): Archive {
  return unzipSync(data, {
    filter: (file) => wanted(file.name) && file.originalSize <= MAX_MEMBER_BYTES,
  });
}

function read(archive: Archive, name: string): string | undefined {
  const bytes = archive[name];
  return bytes ? strFromU8(bytes) : undefined;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&amp;/g, "&");
}

/** The text runs (`<w:t>`, `<a:t>`) of each paragraph (`<w:p>`, `<a:p>`) in some Office XML. */
function paragraphs(xml: string, prefix: "w" | "a"): string[] {
  const out: string[] = [];
  const paragraph = new RegExp(`<${prefix}:p[ >][\\s\\S]*?</${prefix}:p>`, "g");
  const run = new RegExp(`<${prefix}:(t|tab|br)(?: [^>]*)?(?:/>|>([\\s\\S]*?)</${prefix}:t>)`, "g");
  for (const [block] of xml.matchAll(paragraph)) {
    let line = "";
    for (const match of block.matchAll(run)) {
      if (match[1] === "tab") line += "\t";
      else if (match[1] === "br") line += "\n";
      else line += decodeEntities(match[2] ?? "");
    }
    out.push(line);
  }
  return out;
}

/** A Word document (.docx): its body's paragraphs, then footnotes. */
export function docxToText(data: Uint8Array): string {
  const archive = open(data, (name) =>
    ["word/document.xml", "word/footnotes.xml", "word/endnotes.xml"].includes(name),
  );
  const body = read(archive, "word/document.xml");
  if (!body) throw new Error("This is not a Word document.");
  const notes = ["word/footnotes.xml", "word/endnotes.xml"]
    .map((name) => read(archive, name))
    .filter((xml): xml is string => Boolean(xml))
    .flatMap((xml) => paragraphs(xml, "w"));
  return cleanText([...paragraphs(body, "w"), ...notes].join("\n"));
}

/** Column letters ("AB") to a zero-based index. */
function columnIndex(ref: string): number {
  const letters = /^[A-Z]+/.exec(ref)?.[0] ?? "A";
  return [...letters].reduce((sum, letter) => sum * 26 + letter.charCodeAt(0) - 64, 0) - 1;
}

/** An Excel workbook (.xlsx): each sheet under its name, one row per line, cells split by " | ". */
export function xlsxToText(data: Uint8Array): string {
  const archive = open(
    data,
    (name) =>
      name === "xl/workbook.xml" ||
      name === "xl/sharedStrings.xml" ||
      name === "xl/_rels/workbook.xml.rels" ||
      /^xl\/worksheets\/sheet\d+\.xml$/.test(name),
  );
  const workbook = read(archive, "xl/workbook.xml");
  if (!workbook) throw new Error("This is not an Excel workbook.");

  const shared = [
    ...(read(archive, "xl/sharedStrings.xml") ?? "").matchAll(/<si>([\s\S]*?)<\/si>/g),
  ].map(([, item]) =>
    decodeEntities([...item.matchAll(/<t(?: [^>]*)?>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join("")),
  );
  const targets = new Map(
    [...(read(archive, "xl/_rels/workbook.xml.rels") ?? "").matchAll(/<Relationship [^>]*>/g)].map(
      ([tag]) => [/Id="([^"]+)"/.exec(tag)?.[1], /Target="([^"]+)"/.exec(tag)?.[1]],
    ),
  );
  const sheets = [...workbook.matchAll(/<sheet [^>]*\/>/g)].map(([tag], at) => {
    const name = decodeEntities(/name="([^"]*)"/.exec(tag)?.[1] ?? `Sheet ${at + 1}`);
    const rel = /r:id="([^"]+)"/.exec(tag)?.[1];
    const target = rel ? targets.get(rel) : undefined;
    const path = target
      ? `xl/${target.replace(/^\/?xl\//, "")}`
      : `xl/worksheets/sheet${at + 1}.xml`;
    return { name, xml: read(archive, path) ?? "" };
  });

  const parts: string[] = [];
  for (const sheet of sheets) {
    const rows: string[] = [];
    for (const [, row] of sheet.xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
      const cells: string[] = [];
      for (const [, attrs, inner] of row.matchAll(/<c([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const ref = /r="([A-Z]+)\d+"/.exec(attrs)?.[1];
        const type = /t="([^"]+)"/.exec(attrs)?.[1];
        const value = /<v>([\s\S]*?)<\/v>/.exec(inner ?? "")?.[1];
        const inline = /<is>[\s\S]*?<t(?: [^>]*)?>([\s\S]*?)<\/t>/.exec(inner ?? "")?.[1];
        let text = "";
        if (type === "s" && value !== undefined) text = shared[Number(value)] ?? "";
        else if (type === "inlineStr") text = decodeEntities(inline ?? "");
        else if (type === "b") text = value === "1" ? "TRUE" : "FALSE";
        else text = decodeEntities(value ?? "");
        const index = ref ? columnIndex(ref) : cells.length;
        while (cells.length < index) cells.push("");
        cells[index] = text.replace(/[\t\n|]+/g, " ").trim();
      }
      if (cells.some((cell) => cell.trim() !== ""))
        rows.push(cells.join(" | ").replace(/(?:\s*\|\s*)+$/, ""));
    }
    if (rows.length > 0) parts.push(`## ${sheet.name}\n${rows.join("\n")}`);
  }
  return parts.join("\n\n");
}

/** A PowerPoint deck (.pptx): each slide's text in order, then its speaker notes. */
export function pptxToText(data: Uint8Array): string {
  const archive = open(data, (name) => /^ppt\/(slides|notesSlides)\/\w+\.xml$/.test(name));
  const numbered = (folder: string, stem: string) =>
    Object.keys(archive)
      .map((name) => new RegExp(`^ppt/${folder}/${stem}(\\d+)\\.xml$`).exec(name))
      .filter((match): match is RegExpExecArray => match !== null)
      .map((match) => ({ n: Number(match[1]), xml: read(archive, match[0]) ?? "" }))
      .sort((a, b) => a.n - b.n);
  const slides = numbered("slides", "slide");
  if (slides.length === 0) throw new Error("This is not a PowerPoint deck.");
  const notes = new Map(numbered("notesSlides", "notesSlide").map((note) => [note.n, note.xml]));
  return cleanText(
    slides
      .map(({ n, xml }) => {
        const body = paragraphs(xml, "a")
          .filter((line) => line.trim())
          .join("\n");
        const note = paragraphs(notes.get(n) ?? "", "a")
          .filter((line) => line.trim() && !/^\d+$/.test(line.trim()))
          .join("\n");
        return [`Slide ${n}`, body, note ? `Notes: ${note}` : ""].filter(Boolean).join("\n");
      })
      .join("\n\n"),
  );
}

/** An EPUB book: its title and the text of its chapters, in the order of its spine. */
export function epubToText(data: Uint8Array): { title?: string; text: string } {
  const archive = open(data, (name) => /\.(opf|xml|x?html?)$/i.test(name));
  const container = read(archive, "META-INF/container.xml");
  const opfPath = container && /full-path="([^"]+)"/.exec(container)?.[1];
  const opf = opfPath ? read(archive, opfPath) : undefined;
  if (!opfPath || !opf) throw new Error("This is not an EPUB book.");
  const base = opfPath.includes("/") ? opfPath.slice(0, opfPath.lastIndexOf("/") + 1) : "";
  const title = /<dc:title[^>]*>([\s\S]*?)<\/dc:title>/.exec(opf)?.[1];
  const manifest = new Map(
    [...opf.matchAll(/<item [^>]*>/g)].map(([tag]) => [
      /id="([^"]+)"/.exec(tag)?.[1],
      /href="([^"]+)"/.exec(tag)?.[1],
    ]),
  );
  const chapters = [...opf.matchAll(/<itemref [^>]*idref="([^"]+)"/g)]
    .map(([, id]) => manifest.get(id))
    .filter((href): href is string => Boolean(href))
    .map((href) => read(archive, base + decodeURIComponent(href)) ?? "")
    .map((html) => {
      const { document } = parseHTML(html);
      for (const node of document.querySelectorAll("script, style")) node.remove();
      return document.body?.textContent ?? document.documentElement?.textContent ?? "";
    });
  return {
    title: title ? decodeEntities(title).trim() : undefined,
    text: cleanText(chapters.join("\n\n")),
  };
}
