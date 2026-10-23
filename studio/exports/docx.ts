import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  FootnoteReferenceRun,
  HeadingLevel,
  LevelFormat,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  type ParagraphChild,
} from "docx";
import type { List, PhrasingContent, RootContent, Table as MdTable } from "mdast";
import { fromMarkdown } from "mdast-util-from-markdown";
import { gfmFromMarkdown } from "mdast-util-gfm";
import { gfm } from "micromark-extension-gfm";
import type { PassageRef } from "@/lib/chat/types";

/** Mostly Arabic, Hebrew, Persian or Urdu letters: lay the document out right to left. */
export function isRightToLeft(text: string): boolean {
  const letters = text.match(/\p{L}/gu)?.length ?? 0;
  const rtl = text.match(/[\p{Script=Arabic}\p{Script=Hebrew}\p{Script=Syriac}\p{Script=Thaana}]/gu)?.length ?? 0;
  return letters > 0 && rtl / letters > 0.3;
}

const MONO = "Consolas";
const ORDERED = "better-vault-ordered";

interface Style {
  bold?: boolean;
  italics?: boolean;
  strike?: boolean;
  code?: boolean;
}

interface Context {
  rtl: boolean;
  /** Passages a "[n]" citation can point at. */
  passages: Map<number, PassageRef>;
  orderedLists: number;
}

const CITATION = /\[(\d{1,4}(?:\s*[,–-]\s*\d{1,4})*)\]/g;

function citationNumbers(inner: string): number[] {
  return inner.split(/\s*,\s*/).flatMap((part) => {
    const [from, to] = part.split(/\s*[–-]\s*/).map(Number);
    if (to !== undefined && to >= from && to - from < 50) return Array.from({ length: to - from + 1 }, (_, i) => from + i);
    return [from];
  });
}

function footnoteFor(n: number, context: Context): FootnoteReferenceRun | null {
  const passage = context.passages.get(n);
  if (!passage) return null;
  return new FootnoteReferenceRun({
    children: [
      new Paragraph({
        bidirectional: context.rtl,
        children: [new TextRun({ text: `${passage.title}: `, bold: true }), new TextRun(`“${passage.snippet}”`)],
      }),
    ],
  });
}

function textRuns(value: string, style: Style, context: Context): ParagraphChild[] {
  const runs: ParagraphChild[] = [];
  const run = (text: string) =>
    new TextRun({
      text,
      bold: style.bold,
      italics: style.italics,
      strike: style.strike,
      font: style.code ? MONO : undefined,
      rightToLeft: context.rtl,
    });
  let last = 0;
  for (const match of value.matchAll(CITATION)) {
    const notes = citationNumbers(match[1]).flatMap((n) => footnoteFor(n, context) ?? []);
    if (notes.length === 0) continue;
    if (match.index > last) runs.push(run(value.slice(last, match.index).replace(/\s+$/, "")));
    runs.push(...notes);
    last = match.index + match[0].length;
  }
  if (last < value.length) runs.push(run(value.slice(last)));
  return runs;
}

function inline(nodes: PhrasingContent[], style: Style, context: Context): ParagraphChild[] {
  return nodes.flatMap((node): ParagraphChild[] => {
    switch (node.type) {
      case "text":
        return textRuns(node.value, style, context);
      case "strong":
        return inline(node.children, { ...style, bold: true }, context);
      case "emphasis":
        return inline(node.children, { ...style, italics: true }, context);
      case "delete":
        return inline(node.children, { ...style, strike: true }, context);
      case "inlineCode":
        return [new TextRun({ text: node.value, font: MONO, shading: { type: ShadingType.CLEAR, fill: "F2F2F2" } })];
      case "break":
        return [new TextRun({ text: "", break: 1 })];
      case "link":
        return [
          new ExternalHyperlink({
            link: node.url,
            children: node.children.flatMap((child) =>
              child.type === "text" ? [new TextRun({ text: child.value, style: "Hyperlink" })] : [],
            ),
          }),
        ];
      default:
        return "value" in node && typeof node.value === "string" ? textRuns(node.value, style, context) : [];
    }
  });
}

function list(node: List, level: number, context: Context): Paragraph[] {
  const instance = node.ordered ? ++context.orderedLists : 0;
  return node.children.flatMap((item) =>
    item.children.flatMap((child, at) => {
      if (child.type === "list") return list(child, level + 1, context);
      const children = child.type === "paragraph" ? inline(child.children, {}, context) : [];
      if (at > 0) return [new Paragraph({ children, bidirectional: context.rtl, indent: { start: 720 * (level + 1) } })];
      return [
        new Paragraph({
          children,
          bidirectional: context.rtl,
          ...(node.ordered
            ? { numbering: { reference: ORDERED, level: Math.min(level, 2), instance } }
            : { bullet: { level: Math.min(level, 2) } }),
        }),
      ];
    }),
  );
}

function table(node: MdTable, context: Context): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    visuallyRightToLeft: context.rtl,
    rows: node.children.map(
      (row, rowAt) =>
        new TableRow({
          tableHeader: rowAt === 0,
          children: row.children.map(
            (cell) =>
              new TableCell({
                shading: rowAt === 0 ? { type: ShadingType.CLEAR, fill: "EFEFEF" } : undefined,
                children: [
                  new Paragraph({
                    bidirectional: context.rtl,
                    children: inline(cell.children, rowAt === 0 ? { bold: true } : {}, context),
                  }),
                ],
              }),
          ),
        }),
    ),
  });
}

const HEADINGS = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4];

function blocks(nodes: RootContent[], context: Context): (Paragraph | Table)[] {
  return nodes.flatMap((node): (Paragraph | Table)[] => {
    switch (node.type) {
      case "heading":
        return [
          new Paragraph({
            heading: HEADINGS[Math.min(node.depth, 4) - 1],
            bidirectional: context.rtl,
            children: inline(node.children, {}, context),
          }),
        ];
      case "paragraph":
        return [new Paragraph({ bidirectional: context.rtl, children: inline(node.children, {}, context) })];
      case "list":
        return list(node, 0, context);
      case "table":
        return [table(node, context), new Paragraph("")];
      case "blockquote":
        return node.children.flatMap((child) =>
          child.type === "paragraph"
            ? [
                new Paragraph({
                  bidirectional: context.rtl,
                  indent: { start: 360 },
                  border: { left: { style: BorderStyle.SINGLE, size: 12, color: "BBBBBB", space: 12 } },
                  children: inline(child.children, { italics: true }, context),
                }),
              ]
            : blocks([child], context),
        );
      case "code":
        return node.value.split("\n").map(
          (line) =>
            new Paragraph({
              shading: { type: ShadingType.CLEAR, fill: "F5F5F5" },
              children: [new TextRun({ text: line || " ", font: MONO, size: 19 })],
            }),
        );
      case "thematicBreak":
        return [new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "CCCCCC", space: 1 } } })];
      default:
        return [];
    }
  });
}

/** Turns Markdown into Word content. "[n]" citations become footnotes naming the source. */
export function markdownToBlocks(markdown: string, passages: readonly PassageRef[] = [], rtl = false) {
  const tree = fromMarkdown(markdown, { extensions: [gfm()], mdastExtensions: [gfmFromMarkdown()] });
  return blocks(tree.children, {
    rtl,
    passages: new Map(passages.map((passage) => [passage.n, passage])),
    orderedLists: 0,
  });
}

interface DocumentInput {
  title: string;
  /** A quieter line under the title. */
  subtitle?: string;
  children: (Paragraph | Table)[];
  rtl?: boolean;
}

/** A Word document with a title, the app's styles and list numbering. */
export async function wordDocument({ title, subtitle, children, rtl = false }: DocumentInput): Promise<Blob> {
  const document = new Document({
    creator: "better-vault",
    title,
    styles: {
      default: {
        document: { run: { font: "Calibri", size: 22 }, paragraph: { spacing: { after: 120, line: 300 } } },
        heading1: { run: { font: "Calibri", size: 32, bold: true }, paragraph: { spacing: { before: 360, after: 120 } } },
        heading2: { run: { font: "Calibri", size: 28, bold: true }, paragraph: { spacing: { before: 280, after: 100 } } },
        heading3: { run: { font: "Calibri", size: 24, bold: true }, paragraph: { spacing: { before: 220, after: 80 } } },
        title: { run: { font: "Calibri", size: 48, bold: true }, paragraph: { spacing: { after: 80 } } },
      },
    },
    numbering: {
      config: [
        {
          reference: ORDERED,
          levels: [0, 1, 2].map((level) => ({
            level,
            format: [LevelFormat.DECIMAL, LevelFormat.LOWER_LETTER, LevelFormat.LOWER_ROMAN][level],
            text: `%${level + 1}.`,
            alignment: AlignmentType.START,
            style: { paragraph: { indent: { left: 720 * (level + 1), hanging: 360 } } },
          })),
        },
      ],
    },
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({ heading: HeadingLevel.TITLE, bidirectional: rtl, children: [new TextRun({ text: title, rightToLeft: rtl })] }),
          ...(subtitle
            ? [new Paragraph({ bidirectional: rtl, children: [new TextRun({ text: subtitle, color: "777777", size: 20, rightToLeft: rtl })] })]
            : []),
          ...children,
        ],
      },
    ],
  });
  return Packer.toBlob(document);
}

export { Paragraph, TextRun, Table, TableRow, TableCell, WidthType, ShadingType, HeadingLevel };
