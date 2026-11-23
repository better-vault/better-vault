import { syntaxTree } from "@codemirror/language";
import { RangeSetBuilder, StateField, type EditorState, type Extension } from "@codemirror/state";
import { Decoration, EditorView, WidgetType, type DecorationSet } from "@codemirror/view";

/**
 * The blocks Live Preview draws as what they are, as Obsidian does: a table
 * as a table, `---` as a rule, `![alt](https://…)` as the picture and `$$…$$`
 * as a formula box. The note stays Markdown; when the cursor enters a block,
 * its source shows again for editing. Blocks that span lines can only be
 * replaced from a state field, hence this one beside livePreview.
 */

function touches(state: EditorState, from: number, to: number) {
  return state.selection.ranges.some((range) => range.to >= from && range.from <= to);
}

/** Clicking a drawn block puts the cursor in its source. */
function editAt(view: EditorView, pos: number) {
  view.dispatch({ selection: { anchor: pos } });
  view.focus();
}

const cellsOf = (line: string) =>
  line
    .trim()
    .replace(/^\||\|$/g, "")
    .split(/(?<!\\)\|/)
    .map((cell) => cell.trim().replace(/\\\|/g, "|"));

/** Inline Markdown in a cell, as text with bold, italics and code. */
function inline(target: HTMLElement, text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*|_[^_]+_)/g);
  for (const part of parts) {
    if (!part) continue;
    let el: HTMLElement | Text;
    if (/^\*\*.+\*\*$/.test(part)) {
      el = document.createElement("strong");
      el.textContent = part.slice(2, -2);
    } else if (/^`.+`$/.test(part)) {
      el = document.createElement("code");
      el.className = "cm-inline-code";
      el.textContent = part.slice(1, -1);
    } else if (/^(\*.+\*|_.+_)$/.test(part)) {
      el = document.createElement("em");
      el.textContent = part.slice(1, -1);
    } else el = document.createTextNode(part);
    target.append(el);
  }
}

class TableWidget extends WidgetType {
  constructor(
    readonly source: string,
    readonly from: number,
  ) {
    super();
  }
  eq(other: TableWidget) {
    return other.source === this.source && other.from === this.from;
  }
  toDOM(view: EditorView) {
    const lines = this.source.split("\n").filter((line) => line.trim());
    const [head, , ...body] = lines;
    const aligns = cellsOf(lines[1] ?? "").map((cell) =>
      /^:-+:$/.test(cell) ? "center" : /-+:$/.test(cell) ? "right" : "left",
    );
    const wrap = document.createElement("div");
    wrap.className = "cm-md-table";
    const table = document.createElement("table");
    const row = (cells: string[], tag: "th" | "td") => {
      const tr = document.createElement("tr");
      cells.forEach((cell, at) => {
        const el = document.createElement(tag);
        el.style.textAlign = aligns[at] ?? "left";
        inline(el, cell);
        tr.append(el);
      });
      return tr;
    };
    const thead = document.createElement("thead");
    thead.append(row(cellsOf(head ?? ""), "th"));
    const tbody = document.createElement("tbody");
    for (const line of body) tbody.append(row(cellsOf(line), "td"));
    table.append(thead, tbody);
    wrap.append(table);
    wrap.addEventListener("mousedown", (event) => {
      event.preventDefault();
      editAt(view, this.from);
    });
    return wrap;
  }
  ignoreEvent() {
    return false;
  }
}

class RuleWidget extends WidgetType {
  eq() {
    return true;
  }
  toDOM() {
    const hr = document.createElement("div");
    hr.className = "cm-md-rule";
    hr.setAttribute("role", "separator");
    return hr;
  }
}

class ImageWidget extends WidgetType {
  constructor(
    readonly src: string,
    readonly alt: string,
  ) {
    super();
  }
  eq(other: ImageWidget) {
    return other.src === this.src && other.alt === this.alt;
  }
  toDOM() {
    const img = document.createElement("img");
    img.className = "cm-md-image";
    img.src = this.src;
    img.alt = this.alt;
    img.loading = "lazy";
    return img;
  }
}

class MathWidget extends WidgetType {
  constructor(
    readonly formula: string,
    readonly from: number,
  ) {
    super();
  }
  eq(other: MathWidget) {
    return other.formula === this.formula && other.from === this.from;
  }
  toDOM(view: EditorView) {
    const box = document.createElement("div");
    box.className = "cm-md-math";
    box.textContent = this.formula;
    box.addEventListener("mousedown", (event) => {
      event.preventDefault();
      editAt(view, this.from);
    });
    return box;
  }
  ignoreEvent() {
    return false;
  }
}

function build(state: EditorState): DecorationSet {
  const found: { from: number; to: number; deco: Decoration }[] = [];
  const tree = syntaxTree(state);
  tree.iterate({
    enter: (node) => {
      if (node.name === "Table") {
        const from = state.doc.lineAt(node.from).from;
        const to = state.doc.lineAt(Math.max(node.from, node.to - 1)).to;
        if (!touches(state, from, to))
          found.push({
            from,
            to,
            deco: Decoration.replace({
              widget: new TableWidget(state.sliceDoc(from, to), from),
              block: true,
            }),
          });
        return false;
      }
      if (node.name === "HorizontalRule") {
        const line = state.doc.lineAt(node.from);
        if (!touches(state, line.from, line.to))
          found.push({
            from: line.from,
            to: line.to,
            deco: Decoration.replace({ widget: new RuleWidget(), block: true }),
          });
        return false;
      }
      if (node.name === "Image") {
        const source = state.sliceDoc(node.from, node.to);
        const match = source.match(/^!\[([^\]]*)\]\((\S+?)(?:\s+"[^"]*")?\)$/);
        if (match && /^(https:|data:image\/)/.test(match[2]) && !touches(state, node.from, node.to))
          found.push({
            from: node.from,
            to: node.to,
            deco: Decoration.replace({ widget: new ImageWidget(match[2], match[1]) }),
          });
        return false;
      }
      if (node.name === "FencedCode") return false;
      return undefined;
    },
  });

  // $$ … $$ blocks (the Markdown parser has no math).
  const text = state.doc.toString();
  for (const match of text.matchAll(/^\$\$[ \t]*\n([\s\S]*?)\n\$\$[ \t]*$/gm)) {
    const from = match.index ?? 0;
    const to = from + match[0].length;
    if (!touches(state, from, to))
      found.push({
        from,
        to,
        deco: Decoration.replace({ widget: new MathWidget(match[1].trim(), from), block: true }),
      });
  }

  found.sort((a, b) => a.from - b.from || a.to - b.to);
  const builder = new RangeSetBuilder<Decoration>();
  let end = -1;
  for (const item of found) {
    if (item.from <= end) continue;
    builder.add(item.from, item.to, item.deco);
    end = item.to;
  }
  return builder.finish();
}

export function richBlocks(): Extension {
  return [
    StateField.define<DecorationSet>({
      create: build,
      update: (value, tr) => (tr.docChanged || tr.selection ? build(tr.state) : value),
      provide: (field) => EditorView.decorations.from(field),
    }),
    EditorView.theme({
      ".cm-md-table": { overflowX: "auto", margin: "0.4em 0", cursor: "text" },
      ".cm-md-table table": {
        borderCollapse: "collapse",
        width: "100%",
        fontSize: "0.95em",
      },
      ".cm-md-table th, .cm-md-table td": {
        border: "1px solid var(--border)",
        padding: "0.35em 0.7em",
        verticalAlign: "top",
      },
      ".cm-md-table th": { backgroundColor: "var(--muted)", fontWeight: "600" },
      ".cm-md-rule": {
        height: "1px",
        backgroundColor: "var(--border)",
        margin: "0.9em 0",
      },
      ".cm-md-image": {
        maxWidth: "100%",
        borderRadius: "0.6em",
        display: "inline-block",
        verticalAlign: "middle",
      },
      ".cm-md-math": {
        fontFamily: "var(--font-mono, ui-monospace, monospace)",
        textAlign: "center",
        padding: "0.6em 1em",
        margin: "0.4em 0",
        borderRadius: "0.6em",
        backgroundColor: "var(--muted)",
        cursor: "text",
      },
    }),
  ];
}
