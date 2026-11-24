import { syntaxTree } from "@codemirror/language";
import { RangeSetBuilder, StateField, type EditorState, type Extension } from "@codemirror/state";
import { Decoration, EditorView, WidgetType, type DecorationSet } from "@codemirror/view";
import { EditableTableWidget, type TableLabels } from "./table-widget";

/**
 * The blocks Live Preview draws as what they are: a table as a table you
 * edit cell by cell (table-widget.ts), `---` as a rule, `![alt](https://…)` as the picture and `$$…$$`
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

function build(state: EditorState, labels: TableLabels): DecorationSet {
  const found: { from: number; to: number; deco: Decoration }[] = [];
  const tree = syntaxTree(state);
  tree.iterate({
    enter: (node) => {
      if (node.name === "Table") {
        const from = state.doc.lineAt(node.from).from;
        const to = state.doc.lineAt(Math.max(node.from, node.to - 1)).to;
        // The cursor inside the table's source (from "Edit as Markdown") shows the Markdown.
        const inside = state.selection.ranges.some((range) => range.head > from && range.head < to);
        if (!inside)
          found.push({
            from,
            to,
            deco: Decoration.replace({
              widget: new EditableTableWidget(state.sliceDoc(from, to), labels),
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

export function richBlocks(labels: TableLabels): Extension {
  return [
    StateField.define<DecorationSet>({
      create: (state) => build(state, labels),
      update: (value, tr) => (tr.docChanged || tr.selection ? build(tr.state, labels) : value),
      provide: (field) => EditorView.decorations.from(field),
    }),
    EditorView.theme({
      ".cm-md-table": { margin: "0.4em 0" },
      ".cm-md-table-grid": {
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) auto",
        gridTemplateRows: "auto auto",
        columnGap: "4px",
        rowGap: "4px",
      },
      ".cm-md-table-scroll": { overflowX: "auto", minWidth: "0", gridColumn: "1", gridRow: "1" },
      ".cm-md-table table": { borderCollapse: "collapse", width: "100%", fontSize: "0.95em" },
      ".cm-md-table th, .cm-md-table td": {
        border: "1px solid var(--border)",
        padding: "0.35em 0.7em",
        verticalAlign: "top",
        minWidth: "4em",
        outline: "none",
        cursor: "text",
        whiteSpace: "pre-wrap",
      },
      ".cm-md-table th": { backgroundColor: "var(--muted)", fontWeight: "600" },
      ".cm-md-table th:focus, .cm-md-table td:focus": {
        boxShadow: "inset 0 0 0 2px color-mix(in oklab, var(--info) 70%, transparent)",
        borderRadius: "2px",
      },
      ".cm-md-table-add-row, .cm-md-table-add-column": {
        appearance: "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0",
        border: "none",
        borderRadius: "6px",
        color: "var(--muted-foreground)",
        backgroundColor: "transparent",
        cursor: "pointer",
        opacity: "0",
        transition: "opacity 120ms, background-color 120ms",
      },
      ".cm-md-table-add-row": { height: "20px", gridColumn: "1", gridRow: "2" },
      ".cm-md-table-add-column": { width: "20px", gridColumn: "2", gridRow: "1" },
      ".cm-md-table:hover .cm-md-table-add-row, .cm-md-table:hover .cm-md-table-add-column, .cm-md-table[data-editing] .cm-md-table-add-row, .cm-md-table[data-editing] .cm-md-table-add-column":
        { opacity: "1" },
      ".cm-md-table-add-row:hover, .cm-md-table-add-column:hover": {
        backgroundColor: "color-mix(in oklab, var(--foreground) 8%, transparent)",
        color: "var(--foreground)",
      },
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
