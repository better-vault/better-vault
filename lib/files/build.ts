import type { List, PhrasingContent, Root, RootContent, Table } from "mdast";
import { fromMarkdown } from "mdast-util-from-markdown";
import { gfmFromMarkdown } from "mdast-util-gfm";
import { gfm } from "micromark-extension-gfm";
import type { Content, TDocumentDefinitions } from "pdfmake/interfaces";
import { isRightToLeft } from "@/lib/text/direction";
import type { CreateFileInput, FileFormat } from "./tools";

/**
 * Builds the file `create_file` asked for, in the page. Each format's library
 * loads only when needed. Documents are written from Markdown; spreadsheets,
 * CSV and slides from their own fields.
 */

const mimes: Record<FileFormat, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  csv: "text/csv",
  md: "text/markdown",
  html: "text/html",
  txt: "text/plain",
  json: "application/json",
};

export class FileBuildError extends Error {
  constructor(readonly reason: "empty" | "invalid-json") {
    super(reason);
  }
}

/** A safe file name: the model's name without path characters, with the format's extension. */
export function fileNameFor(input: Pick<CreateFileInput, "name" | "format">) {
  const base =
    input.name
      // Path characters and control characters become spaces.
      .replace(/[\\/:*?"<>|]+/g, " ")
      .replace(/\p{Cc}+/gu, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\.[a-z0-9]{1,5}$/i, "")
      .slice(0, 100) || "Untitled";
  return `${base}.${input.format}`;
}

export async function buildFile(input: CreateFileInput): Promise<{ blob: Blob; name: string }> {
  const name = fileNameFor(input);
  const type = mimes[input.format];
  const markdown = [input.title ? `# ${input.title}` : "", input.markdown ?? ""]
    .filter(Boolean)
    .join("\n\n");
  const needsMarkdown = ["pdf", "docx", "md", "html", "txt"].includes(input.format);
  if (needsMarkdown && !input.markdown?.trim()) throw new FileBuildError("empty");

  switch (input.format) {
    case "md":
      return { name, blob: new Blob([markdown], { type }) };
    case "txt":
      return { name, blob: new Blob([plainText(parse(markdown))], { type }) };
    case "html":
      return { name, blob: new Blob([htmlPage(input.title ?? input.name, markdown)], { type }) };
    case "json": {
      const text = input.json ?? "";
      try {
        return { name, blob: new Blob([JSON.stringify(JSON.parse(text), null, 2)], { type }) };
      } catch {
        throw new FileBuildError("invalid-json");
      }
    }
    case "csv": {
      const rows = input.sheets?.[0]?.rows;
      if (!rows?.length) throw new FileBuildError("empty");
      return { name, blob: new Blob([toCsv(rows)], { type }) };
    }
    case "xlsx": {
      if (!input.sheets?.length) throw new FileBuildError("empty");
      const { default: writeExcelFile } = await import("write-excel-file/universal");
      const blob = await writeExcelFile(
        input.sheets.map((sheet, at) => ({
          sheet: sheet.name || `Sheet ${at + 1}`,
          data: sheet.rows.map((row, line) =>
            row.map((value) =>
              value === null
                ? null
                : { value, ...(line === 0 ? { fontWeight: "bold" as const } : {}) },
            ),
          ),
        })),
      ).toBlob();
      return { name, blob: new Blob([blob], { type }) };
    }
    case "pptx": {
      if (!input.slides?.length) throw new FileBuildError("empty");
      const { default: PptxGenJS } = await import("pptxgenjs");
      const deck = new PptxGenJS();
      deck.layout = "LAYOUT_WIDE";
      if (input.title) {
        const cover = deck.addSlide();
        cover.addText(input.title, { x: 0.6, y: 2.6, w: 12, h: 1.4, fontSize: 40, bold: true });
      }
      for (const each of input.slides) {
        const slide = deck.addSlide();
        const rtl = isRightToLeft(each.title + each.bullets.join(" "));
        slide.addText(each.title, {
          x: 0.6,
          y: 0.4,
          w: 12,
          h: 1,
          fontSize: 30,
          bold: true,
          rtlMode: rtl,
        });
        if (each.bullets.length)
          slide.addText(
            each.bullets.map((text) => ({ text, options: { bullet: true, breakLine: true } })),
            { x: 0.8, y: 1.6, w: 11.6, h: 5.2, fontSize: 20, valign: "top", rtlMode: rtl },
          );
        if (each.notes) slide.addNotes(each.notes);
      }
      const data = (await deck.write({ outputType: "blob" })) as Blob;
      return { name, blob: new Blob([data], { type }) };
    }
    case "docx": {
      const { markdownToBlocks, wordDocument } = await import("@/studio/exports/docx");
      const rtl = isRightToLeft(markdown);
      const blob = await wordDocument({
        title: input.title ?? "",
        children: markdownToBlocks(input.markdown ?? "", [], rtl),
        rtl,
      });
      return { name, blob: new Blob([blob], { type }) };
    }
    case "pdf": {
      const blob = await pdfFromMarkdown(markdown);
      return { name, blob: new Blob([blob], { type }) };
    }
  }
}

function parse(markdown: string): Root {
  return fromMarkdown(markdown, { extensions: [gfm()], mdastExtensions: [gfmFromMarkdown()] });
}

function inlineText(nodes: PhrasingContent[]): string {
  return nodes
    .map((node) =>
      "value" in node ? node.value : "children" in node ? inlineText(node.children) : "",
    )
    .join("");
}

function plainText(root: Root): string {
  const block = (node: RootContent): string => {
    switch (node.type) {
      case "heading":
      case "paragraph":
        return inlineText(node.children);
      case "list":
        return node.children
          .map(
            (item, at) =>
              `${node.ordered ? `${at + 1}.` : "-"} ${item.children.map(block).join(" ")}`,
          )
          .join("\n");
      case "table":
        return node.children
          .map((row) => row.children.map((cell) => inlineText(cell.children)).join("\t"))
          .join("\n");
      case "code":
        return node.value;
      case "blockquote":
        return node.children.map(block).join("\n");
      case "thematicBreak":
        return "—";
      default:
        return "";
    }
  };
  return root.children.map(block).filter(Boolean).join("\n\n");
}

function toCsv(rows: (string | number | boolean | null)[][]) {
  const cell = (value: string | number | boolean | null) => {
    const text = value === null ? "" : String(value);
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return rows.map((row) => row.map(cell).join(",")).join("\r\n");
}

const escape = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function inlineHtml(nodes: PhrasingContent[]): string {
  return nodes
    .map((node) => {
      switch (node.type) {
        case "text":
          return escape(node.value);
        case "strong":
          return `<strong>${inlineHtml(node.children)}</strong>`;
        case "emphasis":
          return `<em>${inlineHtml(node.children)}</em>`;
        case "delete":
          return `<del>${inlineHtml(node.children)}</del>`;
        case "inlineCode":
          return `<code>${escape(node.value)}</code>`;
        case "link":
          return /^https?:|^mailto:/i.test(node.url)
            ? `<a href="${escape(node.url)}">${inlineHtml(node.children)}</a>`
            : inlineHtml(node.children);
        case "break":
          return "<br>";
        default:
          return "value" in node ? escape(String(node.value)) : "";
      }
    })
    .join("");
}

function blockHtml(node: RootContent): string {
  switch (node.type) {
    case "heading":
      return `<h${node.depth}>${inlineHtml(node.children)}</h${node.depth}>`;
    case "paragraph":
      return `<p>${inlineHtml(node.children)}</p>`;
    case "list": {
      const tag = node.ordered ? "ol" : "ul";
      return `<${tag}>${node.children
        .map((item) => `<li>${item.children.map(blockHtml).join("")}</li>`)
        .join("")}</${tag}>`;
    }
    case "table":
      return `<table>${node.children
        .map(
          (row, at) =>
            `<tr>${row.children
              .map(
                (cell) => `<${at ? "td" : "th"}>${inlineHtml(cell.children)}</${at ? "td" : "th"}>`,
              )
              .join("")}</tr>`,
        )
        .join("")}</table>`;
    case "code":
      return `<pre><code>${escape(node.value)}</code></pre>`;
    case "blockquote":
      return `<blockquote>${node.children.map(blockHtml).join("")}</blockquote>`;
    case "thematicBreak":
      return "<hr>";
    default:
      return "";
  }
}

function htmlPage(title: string, markdown: string) {
  const body = parse(markdown).children.map(blockHtml).join("\n");
  const dir = isRightToLeft(markdown) ? "rtl" : "ltr";
  return `<!doctype html>
<html dir="${dir}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)}</title>
<style>
body{font-family:system-ui,sans-serif;line-height:1.6;max-width:46rem;margin:3rem auto;padding:0 1.25rem;color:#1a1a1a}
table{border-collapse:collapse}th,td{border:1px solid #ddd;padding:.4rem .7rem;text-align:start}
pre{background:#f5f5f5;padding:1rem;border-radius:.5rem;overflow:auto}code{font-family:ui-monospace,monospace}
blockquote{border-inline-start:3px solid #ddd;margin:0;padding-inline-start:1rem;color:#555}
</style>
</head>
<body>
${body}
</body>
</html>
`;
}

function inlinePdf(nodes: PhrasingContent[], style: Record<string, unknown> = {}): Content[] {
  return nodes.flatMap((node): Content[] => {
    switch (node.type) {
      case "text":
        return [{ text: node.value, ...style }];
      case "strong":
        return inlinePdf(node.children, { ...style, bold: true });
      case "emphasis":
        return inlinePdf(node.children, { ...style, italics: true });
      case "delete":
        return inlinePdf(node.children, { ...style, decoration: "lineThrough" });
      case "inlineCode":
        return [{ text: node.value, ...style, background: "#f1f1f1", fontSize: 10 }];
      case "link":
        return inlinePdf(node.children, { ...style, link: node.url, color: "#2563eb" });
      case "break":
        return [{ text: "\n" }];
      default:
        return "value" in node ? [{ text: String(node.value), ...style }] : [];
    }
  });
}

function blockPdf(node: RootContent): Content | null {
  switch (node.type) {
    case "heading":
      return { text: inlinePdf(node.children), style: `h${Math.min(node.depth, 3)}` };
    case "paragraph":
      return { text: inlinePdf(node.children), margin: [0, 0, 0, 8] };
    case "list": {
      const items = (node as List).children.map((item) => {
        const parts = item.children.map(blockPdf).filter((part): part is Content => part !== null);
        return item.checked === undefined || item.checked === null
          ? { stack: parts }
          : { stack: [{ text: `${item.checked ? "☑" : "☐"} ` }, ...parts] };
      });
      return node.ordered
        ? { ol: items, margin: [0, 0, 0, 8] }
        : { ul: items, margin: [0, 0, 0, 8] };
    }
    case "table": {
      const rows = (node as Table).children.map((row, at) =>
        row.children.map((cell) => ({ text: inlinePdf(cell.children), bold: at === 0 })),
      );
      const columns = Math.max(...rows.map((row) => row.length));
      return {
        table: {
          headerRows: 1,
          widths: Array.from({ length: columns }, () => "*"),
          body: rows.map((row) => [...row, ...Array(columns - row.length).fill("")]),
        },
        layout: "lightHorizontalLines",
        margin: [0, 4, 0, 12],
      };
    }
    case "code":
      return {
        table: {
          widths: ["*"],
          body: [[{ text: node.value, fontSize: 9, preserveLeadingSpaces: true }]],
        },
        layout: {
          fillColor: () => "#f5f5f5",
          hLineWidth: () => 0,
          vLineWidth: () => 0,
          paddingLeft: () => 8,
          paddingTop: () => 6,
          paddingBottom: () => 6,
        },
        margin: [0, 2, 0, 10],
      };
    case "blockquote":
      return {
        stack: node.children.map(blockPdf).filter((part): part is Content => part !== null),
        color: "#555555",
        italics: true,
        margin: [14, 0, 0, 8],
      };
    case "thematicBreak":
      return {
        canvas: [
          { type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: "#cccccc" },
        ],
        margin: [0, 6, 0, 12],
      };
    default:
      return null;
  }
}

async function pdfFromMarkdown(markdown: string): Promise<Blob> {
  const [{ default: pdfMake }, { default: fonts }] = await Promise.all([
    import("pdfmake/build/pdfmake"),
    import("pdfmake/build/vfs_fonts"),
  ]);
  pdfMake.addVirtualFileSystem(fonts);
  const content = parse(markdown)
    .children.map(blockPdf)
    .filter((part): part is Content => part !== null);
  const document: TDocumentDefinitions = {
    content,
    pageMargins: [40, 48, 40, 48],
    defaultStyle: { fontSize: 11, lineHeight: 1.3 },
    styles: {
      h1: { fontSize: 22, bold: true, margin: [0, 0, 0, 10] },
      h2: { fontSize: 16, bold: true, margin: [0, 10, 0, 6] },
      h3: { fontSize: 13, bold: true, margin: [0, 8, 0, 4] },
    },
  };
  return pdfMake.createPdf(document).getBlob();
}
