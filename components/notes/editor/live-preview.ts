import { syntaxTree } from "@codemirror/language";
import { RangeSetBuilder, type EditorState, type Extension } from "@codemirror/state";
import {
  Decoration,
  EditorView,
  ViewPlugin,
  WidgetType,
  type DecorationSet,
  type ViewUpdate,
} from "@codemirror/view";
import type { NoteLink } from "@/lib/db/types";
import { LINK, maskIgnored, parseLinkInner } from "@/lib/notes/syntax";

/**
 * Obsidian's Live Preview: Markdown marks (`**`, `#`, `` ` ``, `[[ ]]`) are
 * hidden on every line the cursor isn't on, so the note reads as formatted
 * text and turns back into source where you type. Links become chips that
 * open what they point at, tasks become checkboxes, and callouts, tags and
 * highlights are drawn in place.
 */
export interface LivePreviewOptions {
  /** Whether a link points at something that exists (unresolved links are drawn faded). */
  resolves: (link: NoteLink) => boolean;
  open: (link: NoteLink) => void;
}

/** Lines that hold a cursor or a selection show their Markdown. */
function activeLines(state: EditorState): Set<number> {
  const lines = new Set<number>();
  for (const range of state.selection.ranges) {
    const first = state.doc.lineAt(range.from).number;
    const last = state.doc.lineAt(range.to).number;
    for (let n = first; n <= last; n++) lines.add(n);
  }
  return lines;
}

class LinkWidget extends WidgetType {
  constructor(
    readonly link: NoteLink,
    readonly label: string,
    readonly exists: boolean,
    readonly options: LivePreviewOptions,
  ) {
    super();
  }
  eq(other: LinkWidget) {
    return (
      other.label === this.label &&
      other.exists === this.exists &&
      other.link.embed === this.link.embed
    );
  }
  toDOM() {
    const chip = document.createElement("a");
    chip.className = `cm-wikilink${this.exists ? "" : " cm-wikilink-missing"}${this.link.embed ? " cm-wikilink-embed" : ""}`;
    chip.textContent = this.label;
    chip.setAttribute("role", "link");
    chip.tabIndex = -1;
    chip.addEventListener("mousedown", (event) => {
      event.preventDefault();
      this.options.open(this.link);
    });
    return chip;
  }
  ignoreEvent() {
    return true;
  }
}

class CheckboxWidget extends WidgetType {
  constructor(
    readonly checked: boolean,
    readonly at: number,
  ) {
    super();
  }
  eq(other: CheckboxWidget) {
    return other.checked === this.checked && other.at === this.at;
  }
  toDOM(view: EditorView) {
    const box = document.createElement("input");
    box.type = "checkbox";
    box.className = "cm-task";
    box.checked = this.checked;
    box.addEventListener("mousedown", (event) => {
      event.preventDefault();
      view.dispatch({
        changes: { from: this.at, to: this.at + 1, insert: this.checked ? " " : "x" },
      });
    });
    return box;
  }
  ignoreEvent() {
    return false;
  }
}

class BulletWidget extends WidgetType {
  eq() {
    return true;
  }
  toDOM() {
    const dot = document.createElement("span");
    dot.className = "cm-bullet";
    dot.textContent = "•";
    return dot;
  }
}
const bullet = Decoration.replace({ widget: new BulletWidget() });

/** A callout's type, shown where "> [!type]" was; alone when the callout has no title. */
class CalloutLabel extends WidgetType {
  constructor(
    readonly type: string,
    readonly titled: boolean,
  ) {
    super();
  }
  eq(other: CalloutLabel) {
    return other.type === this.type && other.titled === this.titled;
  }
  toDOM() {
    const label = document.createElement("span");
    label.className = "cm-callout-label";
    label.textContent = this.titled ? "" : this.type.charAt(0).toUpperCase() + this.type.slice(1);
    return label;
  }
}

const hide = Decoration.replace({});
const lineClass = (name: string) => Decoration.line({ class: name });
const mark = (name: string) => Decoration.mark({ class: name });

const MARKS = new Set([
  "HeaderMark",
  "EmphasisMark",
  "StrikethroughMark",
  "LinkMark",
  "URL",
  "CodeMark",
]);

interface Pending {
  from: number;
  to: number;
  deco: Decoration;
}

function build(view: EditorView, options: LivePreviewOptions): DecorationSet {
  const { state } = view;
  const active = activeLines(state);
  const pending: Pending[] = [];
  const lineOf = (pos: number) => state.doc.lineAt(pos).number;

  for (const { from, to } of view.visibleRanges) {
    // Markdown structure from the parser: headings, emphasis, code, links.
    syntaxTree(state).iterate({
      from,
      to,
      enter: (node) => {
        const heading = node.name.match(/^(?:ATX|Setext)Heading(\d)$/);
        if (heading) {
          const line = state.doc.lineAt(node.from);
          pending.push({
            from: line.from,
            to: line.from,
            deco: lineClass(`cm-h cm-h${heading[1]}`),
          });
        }
        if (node.name === "InlineCode")
          pending.push({ from: node.from, to: node.to, deco: mark("cm-inline-code") });
        if (node.name === "FencedCode") {
          for (let pos = node.from; pos <= node.to;) {
            const line = state.doc.lineAt(pos);
            pending.push({ from: line.from, to: line.from, deco: lineClass("cm-code-line") });
            pos = line.to + 1;
          }
          return false;
        }
        // A bullet list's "-" is drawn as a dot; a task's is replaced by its checkbox below.
        if (node.name === "ListMark" && node.node.parent?.parent?.name === "BulletList") {
          const isTask = /^ \[[ xX]\]/.test(state.sliceDoc(node.to, node.to + 4));
          if (!isTask && !active.has(lineOf(node.from)))
            pending.push({ from: node.from, to: node.to, deco: bullet });
          return;
        }
        if (!MARKS.has(node.name)) return;
        if (active.has(lineOf(node.from))) return;
        // A link's URL is hidden with its brackets, leaving the text as a link.
        if (node.name === "URL" && node.node.parent?.name !== "Link") return;
        let end = node.to;
        if (node.name === "HeaderMark" && state.sliceDoc(end, end + 1) === " ") end++;
        if (node.name === "CodeMark" && node.node.parent?.name === "FencedCode") return;
        pending.push({ from: node.from, to: end, deco: hide });
      },
    });

    const text = state.sliceDoc(from, to);
    const masked = maskIgnored(text);

    // [[links]] and ![[embeds]].
    for (const match of masked.matchAll(LINK)) {
      const start = from + (match.index ?? 0);
      const end = start + match[0].length;
      const link = parseLinkInner(match[2], match[1] === "!");
      if (active.has(lineOf(start))) {
        pending.push({ from: start, to: end, deco: mark("cm-wikilink-source") });
        continue;
      }
      const label =
        link.alias ??
        ([link.target, link.heading && `#${link.heading}`].filter(Boolean).join(" › ") || match[2]);
      pending.push({
        from: start,
        to: end,
        deco: Decoration.replace({
          widget: new LinkWidget(link, label, options.resolves(link), options),
        }),
      });
    }

    // #tags, ==highlights== and tasks.
    for (const match of masked.matchAll(
      /(^|[\s([{,;])(#[\p{L}\p{N}_\-/]*[\p{L}_\-/][\p{L}\p{N}_\-/]*)/gu,
    )) {
      const start = from + (match.index ?? 0) + match[1].length;
      pending.push({ from: start, to: start + match[2].length, deco: mark("cm-tag") });
    }
    for (const match of masked.matchAll(/==([^=\n]+)==/g)) {
      const start = from + (match.index ?? 0);
      const end = start + match[0].length;
      if (!active.has(lineOf(start))) {
        pending.push({ from: start, to: start + 2, deco: hide });
        pending.push({ from: end - 2, to: end, deco: hide });
      }
      pending.push({ from: start, to: end, deco: mark("cm-highlight") });
    }
    for (const match of masked.matchAll(/^([ \t]*)([-*+] )\[([ xX])\]/gm)) {
      const markAt = from + (match.index ?? 0) + match[1].length;
      const box = markAt + match[2].length;
      const checked = match[3] !== " ";
      const line = state.doc.lineAt(box);
      if (checked)
        pending.push({ from: line.from, to: line.from, deco: lineClass("cm-task-done") });
      if (
        active.has(line.number) &&
        state.selection.ranges.some((r) => r.from >= markAt && r.from <= box + 3)
      )
        continue;
      // The bullet goes with the brackets, as in Obsidian: only the checkbox shows.
      pending.push({
        from: markAt,
        to: box + 3,
        deco: Decoration.replace({ widget: new CheckboxWidget(checked, box + 1) }),
      });
    }
    // %%comments%% are faded.
    for (const match of text.matchAll(/%%[\s\S]*?%%/g)) {
      const start = from + (match.index ?? 0);
      pending.push({ from: start, to: start + match[0].length, deco: mark("cm-comment") });
    }
    // > [!note] callouts: the first line names the type, the rest belong to it.
    // Off the cursor's line, "> [!tip]" becomes a label and the "> " marks go,
    // as do those of plain quotes, which get a bar instead.
    let callout: string | null = null;
    for (let pos = from; pos <= to;) {
      const line = state.doc.lineAt(pos);
      const head = line.text.match(/^(>\s*)\[!(\w+)\]([+-]?)[ \t]*/);
      if (head) callout = head[2].toLowerCase();
      else if (!line.text.startsWith(">")) callout = null;
      const quote = line.text.match(/^>[ \t]?/);
      const inactive = !active.has(line.number);
      if (callout) {
        pending.push({
          from: line.from,
          to: line.from,
          deco: Decoration.line({
            class: head ? "cm-callout cm-callout-title" : "cm-callout",
            attributes: { "data-callout": callout },
          }),
        });
        if (inactive && head) {
          const titled = line.text.slice(head[0].length).trim() !== "";
          pending.push({
            from: line.from,
            to: line.from + head[0].length,
            deco: Decoration.replace({ widget: new CalloutLabel(head[2], titled) }),
          });
        } else if (inactive && quote) {
          pending.push({ from: line.from, to: line.from + quote[0].length, deco: hide });
        }
      } else if (quote) {
        pending.push({ from: line.from, to: line.from, deco: lineClass("cm-quote") });
        if (inactive)
          pending.push({ from: line.from, to: line.from + quote[0].length, deco: hide });
      }
      pos = line.to + 1;
    }
  }

  // Decorations must be added in order; line decorations first at a position.
  pending.sort(
    (a, b) =>
      a.from - b.from || (a.to === a.from ? -1 : 0) - (b.to === b.from ? -1 : 0) || a.to - b.to,
  );
  const builder = new RangeSetBuilder<Decoration>();
  let lastReplaceEnd = -1;
  for (const item of pending) {
    const isReplace =
      (item.deco.spec as { widget?: unknown }).widget !== undefined || item.deco === hide;
    // Two replacements may not overlap; marks may cross a replaced range.
    if (isReplace && item.from < lastReplaceEnd) continue;
    builder.add(item.from, item.to, item.deco);
    if (isReplace) lastReplaceEnd = Math.max(lastReplaceEnd, item.to);
  }
  return builder.finish();
}

export function livePreview(options: LivePreviewOptions): Extension {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = build(view, options);
      }
      update(update: ViewUpdate) {
        if (
          update.docChanged ||
          update.viewportChanged ||
          update.selectionSet ||
          update.focusChanged
        )
          this.decorations = build(update.view, options);
      }
    },
    { decorations: (plugin) => plugin.decorations },
  );
}
