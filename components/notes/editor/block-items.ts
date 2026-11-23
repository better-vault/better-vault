import { startCompletion } from "@codemirror/autocomplete";
import type { EditorView } from "@codemirror/view";
import {
  Alert02Icon,
  ArrowExpand01Icon,
  Book02Icon,
  CheckListIcon,
  File01Icon,
  FlowchartIcon,
  Heading01Icon,
  Heading02Icon,
  Heading03Icon,
  Image01Icon,
  LeftToRightListBulletIcon,
  LeftToRightListNumberIcon,
  Link01Icon,
  QuoteDownIcon,
  SolidLine01Icon,
  SourceCodeIcon,
  SquareRootSquareIcon,
  Table01Icon,
  Tag01Icon,
  TextIcon,
} from "@hugeicons/core-free-icons";
import type { Block } from "./block-handle";

/**
 * What the block menu can add. Each item is plain Markdown: `text` replaces
 * the empty line, and `CARET` in it marks where the cursor goes. Items with a
 * `prefix` can also turn an existing block into that kind.
 */
export type BlockGroup = "basic" | "links" | "media";

export interface BlockItem {
  id: string;
  group: BlockGroup;
  icon: typeof TextIcon;
  text: string;
  /** The Markdown that starts a line of this kind; used by "Turn into". */
  prefix?: string;
  /** What you can type instead, shown at the end of the row. */
  hint?: string;
  /** Opens the link or tag menu once inserted. */
  complete?: boolean;
  /** Words that also find it when filtering. */
  keywords?: string;
}

export const CARET = "{cursor}";

const C = CARET;

export const blockItems: BlockItem[] = [
  { id: "text", group: "basic", icon: TextIcon, text: C, prefix: "", keywords: "paragraph plain" },
  {
    id: "h1",
    group: "basic",
    icon: Heading01Icon,
    text: `# ${C}`,
    prefix: "# ",
    hint: "#",
    keywords: "heading title",
  },
  {
    id: "h2",
    group: "basic",
    icon: Heading02Icon,
    text: `## ${C}`,
    prefix: "## ",
    hint: "##",
    keywords: "heading",
  },
  {
    id: "h3",
    group: "basic",
    icon: Heading03Icon,
    text: `### ${C}`,
    prefix: "### ",
    hint: "###",
    keywords: "heading",
  },
  {
    id: "bullet",
    group: "basic",
    icon: LeftToRightListBulletIcon,
    text: `- ${C}`,
    prefix: "- ",
    hint: "-",
    keywords: "list unordered",
  },
  {
    id: "numbered",
    group: "basic",
    icon: LeftToRightListNumberIcon,
    text: `1. ${C}`,
    prefix: "1. ",
    hint: "1.",
    keywords: "list ordered",
  },
  {
    id: "todo",
    group: "basic",
    icon: CheckListIcon,
    text: `- [ ] ${C}`,
    prefix: "- [ ] ",
    hint: "[]",
    keywords: "task checkbox check",
  },
  {
    id: "quote",
    group: "basic",
    icon: QuoteDownIcon,
    text: `> ${C}`,
    prefix: "> ",
    hint: ">",
    keywords: "blockquote",
  },
  {
    id: "callout",
    group: "basic",
    icon: Alert02Icon,
    text: `> [!note] ${C}`,
    prefix: "> [!note] ",
    hint: "> [!",
    keywords: "note tip warning admonition",
  },
  {
    id: "toggle",
    group: "basic",
    icon: ArrowExpand01Icon,
    text: `> [!info]- ${C}\n> `,
    prefix: "> [!info]- ",
    keywords: "fold collapse details",
  },
  {
    id: "code",
    group: "basic",
    icon: SourceCodeIcon,
    text: `\`\`\`\n${C}\n\`\`\``,
    hint: "```",
    keywords: "snippet program",
  },
  {
    id: "divider",
    group: "basic",
    icon: SolidLine01Icon,
    text: `---\n${C}`,
    hint: "---",
    keywords: "rule separator line hr",
  },
  {
    id: "table",
    group: "basic",
    icon: Table01Icon,
    text: `| ${C} |  |\n| --- | --- |\n|  |  |`,
    keywords: "grid columns rows",
  },
  {
    id: "note-link",
    group: "links",
    icon: Link01Icon,
    text: `[[${C}`,
    complete: true,
    hint: "[[",
    keywords: "link page wiki",
  },
  {
    id: "notebook-link",
    group: "links",
    icon: Book02Icon,
    text: `[[nb:${C}`,
    complete: true,
    keywords: "link notebook",
  },
  {
    id: "source-link",
    group: "links",
    icon: File01Icon,
    text: `[[src:${C}`,
    complete: true,
    keywords: "link source document",
  },
  {
    id: "tag",
    group: "links",
    icon: Tag01Icon,
    text: `#${C}`,
    complete: true,
    hint: "#",
    keywords: "label",
  },
  {
    id: "image",
    group: "media",
    icon: Image01Icon,
    text: `![${C}](https://)`,
    hint: "![",
    keywords: "picture photo embed",
  },
  {
    id: "diagram",
    group: "media",
    icon: FlowchartIcon,
    text: `\`\`\`mermaid\nflowchart TD\n  A[${C}Start] --> B[End]\n\`\`\``,
    keywords: "mermaid flowchart chart graph",
  },
  {
    id: "math",
    group: "media",
    icon: SquareRootSquareIcon,
    text: `$$\n${C}\n$$`,
    hint: "$$",
    keywords: "equation formula latex",
  },
];

/** Replaces `from`–`to` with an item's Markdown and puts the cursor where it marks. */
export function insertItem(view: EditorView, range: { from: number; to: number }, item: BlockItem) {
  const caret = item.text.indexOf(CARET);
  const text = item.text.replace(CARET, "");
  view.dispatch({
    changes: { from: range.from, to: range.to, insert: text },
    selection: { anchor: range.from + (caret >= 0 ? caret : text.length) },
    userEvent: "input.block",
    scrollIntoView: true,
  });
  view.focus();
  if (item.complete) startCompletion(view);
}

/** Line starts that mark a block's kind: headings, tasks, lists, callouts and quotes. */
const KIND =
  /^(\s*)(#{1,6}\s+|[-*+]\s+\[[ xX]\]\s+|[-*+]\s+|\d+[.)]\s+|>\s*(?:\[![^\]]*\][-+]?\s*)?)?/;

/** Turns a block's first line into another kind, keeping its words. */
export function turnInto(view: EditorView, block: Block, item: BlockItem) {
  if (item.prefix === undefined) return;
  const line = view.state.doc.lineAt(block.from);
  const match = KIND.exec(line.text)!;
  const indent = match[1] ?? "";
  const kind = match[0].length;
  view.dispatch({
    changes: { from: line.from + indent.length, to: line.from + kind, insert: item.prefix },
    userEvent: "input.block",
  });
  view.focus();
}

export function duplicateBlock(view: EditorView, block: Block) {
  const text = view.state.doc.sliceString(block.from, block.to);
  view.dispatch({
    changes: { from: block.to, insert: `\n${text}` },
    selection: { anchor: block.to + 1 },
    userEvent: "input.block",
  });
  view.focus();
}

export function deleteBlock(view: EditorView, block: Block) {
  const { doc } = view.state;
  const range =
    block.to < doc.length
      ? { from: block.from, to: block.to + 1 }
      : { from: Math.max(0, block.from - 1), to: block.to };
  view.dispatch({ changes: range, userEvent: "delete.block" });
  view.focus();
}
