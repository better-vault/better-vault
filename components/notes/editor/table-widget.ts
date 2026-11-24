import { EditorView, WidgetType } from "@codemirror/view";

/**
 * A Markdown table drawn as a real table you edit in place, as in Notion:
 * click a cell and type, Tab and Enter move between cells (adding a row at
 * the end), the + bars add a row or a column, and right-clicking a cell
 * offers more. Every change is written back to the note as a Markdown
 * table, so the file stays plain Markdown.
 */

export interface TableLabels {
  addRow: string;
  addColumn: string;
  rowAbove: string;
  rowBelow: string;
  columnLeft: string;
  columnRight: string;
  deleteRow: string;
  deleteColumn: string;
  alignLeft: string;
  alignCenter: string;
  alignRight: string;
  source: string;
}

type Align = "left" | "center" | "right";

export interface TableModel {
  rows: string[][];
  aligns: Align[];
}

const splitRow = (line: string) =>
  line
    .trim()
    .replace(/^\|/, "")
    .replace(/(?<!\\)\|$/, "")
    .split(/(?<!\\)\|/)
    .map((cell) => cell.trim().replace(/\\\|/g, "|"));

/** A Markdown table's header, rows and column alignments. */
export function parseTable(source: string): TableModel {
  const lines = source.split("\n").filter((line) => line.trim());
  const [head = "", rule = "", ...body] = lines;
  const header = splitRow(head);
  const width = Math.max(header.length, 1);
  const aligns = splitRow(rule).map<Align>((cell) =>
    /^:-+:$/.test(cell) ? "center" : /^-+:$/.test(cell) ? "right" : "left",
  );
  const fit = (cells: string[]) => Array.from({ length: width }, (_, at) => cells[at] ?? "");
  return {
    rows: [fit(header), ...body.map((line) => fit(splitRow(line)))],
    aligns: Array.from({ length: width }, (_, at) => aligns[at] ?? "left"),
  };
}

/** The table as Markdown, with the columns padded so the source stays readable. */
export function tableMarkdown({ rows, aligns }: TableModel): string {
  const clean = rows.map((row) =>
    row.map((cell) => cell.replace(/\n/g, " ").replace(/\|/g, "\\|").trim()),
  );
  const widths = aligns.map((_, column) =>
    Math.max(3, ...clean.map((row) => (row[column] ?? "").length)),
  );
  const line = (cells: string[]) =>
    `| ${cells.map((cell, column) => cell.padEnd(widths[column])).join(" | ")} |`;
  const rule = `| ${aligns
    .map((align, column) => {
      const dashes = "-".repeat(
        Math.max(1, widths[column] - (align === "left" ? 0 : align === "right" ? 1 : 2)),
      );
      return align === "center" ? `:${dashes}:` : align === "right" ? `${dashes}:` : dashes;
    })
    .join(" | ")} |`;
  const [header, ...body] = clean;
  return [line(header), rule, ...body.map(line)].join("\n");
}

/** Inline Markdown in a cell, shown with bold, italics and code while not being edited. */
function render(target: HTMLElement, text: string) {
  target.textContent = "";
  for (const part of text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*|_[^_]+_)/g)) {
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

interface TableDom extends HTMLElement {
  /** The table's Markdown as last written, to find it in the note again. */
  bvSource?: string;
  bvModel?: TableModel;
}

const PLUS = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>`;

export class EditableTableWidget extends WidgetType {
  constructor(
    readonly source: string,
    readonly labels: TableLabels,
  ) {
    super();
  }

  eq(other: EditableTableWidget) {
    return other.source === this.source;
  }

  toDOM(view: EditorView) {
    const wrap = document.createElement("div") as TableDom;
    wrap.className = "cm-md-table";
    this.fill(wrap, view);
    return wrap;
  }

  /** Keeps the same table while it is being typed in, so the cell keeps focus. */
  updateDOM(dom: HTMLElement, view: EditorView) {
    const wrap = dom as TableDom;
    if (wrap.bvSource === this.source) return true;
    const next = parseTable(this.source);
    const editing = wrap.contains(document.activeElement);
    const same =
      wrap.bvModel &&
      wrap.bvModel.rows.length === next.rows.length &&
      wrap.bvModel.aligns.length === next.aligns.length;
    if (editing && same) {
      wrap.bvSource = this.source;
      wrap.bvModel = next;
      return true;
    }
    this.fill(wrap, view);
    return true;
  }

  ignoreEvent() {
    // The table handles its own typing, clicks and keys; the editor stays out of them.
    return true;
  }

  /** Where this table is in the note now. */
  private range(view: EditorView, wrap: TableDom) {
    let from: number;
    try {
      from = view.posAtDOM(wrap);
    } catch {
      return null;
    }
    const source = wrap.bvSource ?? this.source;
    const to = from + source.length;
    if (view.state.sliceDoc(from, to) !== source) return null;
    return { from, to };
  }

  /** Writes the table back to the note as Markdown. */
  private commit(view: EditorView, wrap: TableDom, model: TableModel, rebuild = false) {
    const where = this.range(view, wrap);
    if (!where) return;
    const markdown = tableMarkdown(model);
    wrap.bvModel = model;
    if (!rebuild) wrap.bvSource = markdown;
    view.dispatch({
      changes: { from: where.from, to: where.to, insert: markdown },
      userEvent: "input.table",
    });
    if (rebuild) {
      wrap.bvSource = markdown;
      this.fill(wrap, view, model);
    }
  }

  private fill(wrap: TableDom, view: EditorView, given?: TableModel) {
    const model = given ?? parseTable(this.source);
    wrap.bvModel = model;
    wrap.bvSource = given ? wrap.bvSource : this.source;
    wrap.textContent = "";
    const table = document.createElement("table");
    const cells: HTMLElement[][] = [];
    const current = () => wrap.bvModel ?? model;
    const focusCell = (row: number, column: number) => {
      requestAnimationFrame(() => {
        const cell = wrap.querySelectorAll("tr")[row]?.children[column] as HTMLElement | undefined;
        if (!cell) return;
        cell.focus();
        const selection = window.getSelection();
        selection?.selectAllChildren(cell);
        selection?.collapseToEnd();
      });
    };
    const change = (edit: (model: TableModel) => TableModel, focus?: [number, number]) => {
      const next = edit(structuredClone(current()));
      this.commit(view, wrap, next, true);
      if (focus) focusCell(...focus);
    };
    const addRow = (at: number, column = 0) =>
      change(
        (m) => {
          m.rows.splice(
            at,
            0,
            m.aligns.map(() => ""),
          );
          return m;
        },
        [at, column],
      );
    const addColumn = (at: number) =>
      change(
        (m) => {
          m.rows.forEach((row) => row.splice(at, 0, ""));
          m.aligns.splice(at, 0, "left");
          return m;
        },
        [0, at],
      );

    model.rows.forEach((row, r) => {
      const tr = document.createElement("tr");
      cells[r] = [];
      row.forEach((text, c) => {
        const cell = document.createElement(r === 0 ? "th" : "td");
        cell.contentEditable = "plaintext-only";
        cell.spellcheck = true;
        cell.style.textAlign = model.aligns[c];
        render(cell, text);
        cell.addEventListener("focus", () => {
          // While editing, the cell shows its Markdown (**bold**, `code`).
          cell.textContent = current().rows[r]?.[c] ?? "";
          wrap.dataset.editing = "";
        });
        cell.addEventListener("blur", () => {
          render(cell, current().rows[r]?.[c] ?? "");
          delete wrap.dataset.editing;
        });
        cell.addEventListener("input", () => {
          const next = structuredClone(current());
          next.rows[r][c] = (cell.textContent ?? "").replace(/\n/g, " ");
          this.commit(view, wrap, next);
        });
        cell.addEventListener("paste", (event) => {
          event.preventDefault();
          const text = event.clipboardData?.getData("text/plain").replace(/\s*\n\s*/g, " ") ?? "";
          document.execCommand("insertText", false, text);
        });
        cell.addEventListener("keydown", (event) => {
          const rows = current().rows.length;
          const columns = current().aligns.length;
          if (event.key === "Tab") {
            event.preventDefault();
            const index = r * columns + c + (event.shiftKey ? -1 : 1);
            if (index < 0) return;
            if (index >= rows * columns) addRow(rows);
            else focusCell(Math.floor(index / columns), index % columns);
          } else if (event.key === "Enter") {
            event.preventDefault();
            if (r + 1 >= rows) addRow(rows, c);
            else focusCell(r + 1, c);
          } else if (event.key === "Escape") {
            event.preventDefault();
            cell.blur();
            const where = this.range(view, wrap);
            if (where)
              view.dispatch({
                selection: { anchor: Math.min(where.to + 1, view.state.doc.length) },
              });
            view.focus();
          } else if (event.key === "ArrowUp" && r > 0 && !event.shiftKey) {
            event.preventDefault();
            focusCell(r - 1, c);
          } else if (event.key === "ArrowDown" && r + 1 < rows && !event.shiftKey) {
            event.preventDefault();
            focusCell(r + 1, c);
          }
        });
        cell.addEventListener("contextmenu", (event) => {
          event.preventDefault();
          this.menu(event, wrap, [
            { label: this.labels.rowAbove, run: () => addRow(Math.max(1, r)), disabled: r === 0 },
            { label: this.labels.rowBelow, run: () => addRow(r + 1) },
            { label: this.labels.columnLeft, run: () => addColumn(c) },
            { label: this.labels.columnRight, run: () => addColumn(c + 1) },
            null,
            ...(["left", "center", "right"] as const).map((align) => ({
              label:
                align === "left"
                  ? this.labels.alignLeft
                  : align === "center"
                    ? this.labels.alignCenter
                    : this.labels.alignRight,
              checked: current().aligns[c] === align,
              run: () =>
                change((m) => {
                  m.aligns[c] = align;
                  return m;
                }),
            })),
            null,
            {
              label: this.labels.deleteRow,
              danger: true,
              disabled: r === 0 || current().rows.length <= 2,
              run: () =>
                change((m) => {
                  m.rows.splice(r, 1);
                  return m;
                }),
            },
            {
              label: this.labels.deleteColumn,
              danger: true,
              disabled: current().aligns.length <= 1,
              run: () =>
                change((m) => {
                  m.rows.forEach((row) => row.splice(c, 1));
                  m.aligns.splice(c, 1);
                  return m;
                }),
            },
            null,
            {
              label: this.labels.source,
              run: () => {
                const where = this.range(view, wrap);
                if (!where) return;
                view.dispatch({ selection: { anchor: where.from }, scrollIntoView: true });
                view.focus();
              },
            },
          ]);
        });
        tr.append(cell);
        cells[r].push(cell);
      });
      table.append(tr);
    });

    const grid = document.createElement("div");
    grid.className = "cm-md-table-grid";
    const scroll = document.createElement("div");
    scroll.className = "cm-md-table-scroll";
    scroll.append(table);
    const addColumnBar = this.bar("cm-md-table-add-column", this.labels.addColumn, () =>
      addColumn(current().aligns.length),
    );
    const addRowBar = this.bar("cm-md-table-add-row", this.labels.addRow, () =>
      addRow(current().rows.length),
    );
    grid.append(scroll, addColumnBar, addRowBar);
    wrap.append(grid);
  }

  private bar(className: string, label: string, run: () => void) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.title = label;
    button.setAttribute("aria-label", label);
    button.innerHTML = PLUS;
    button.addEventListener("mousedown", (event) => event.preventDefault());
    button.addEventListener("click", run);
    return button;
  }

  /** A small menu at the pointer, drawn like the app's menus. */
  private menu(
    event: MouseEvent,
    wrap: HTMLElement,
    items: ({
      label: string;
      run: () => void;
      disabled?: boolean;
      danger?: boolean;
      checked?: boolean;
    } | null)[],
  ) {
    document.querySelector(".cm-md-table-menu")?.remove();
    const menu = document.createElement("div");
    menu.className = "cm-md-table-menu";
    menu.setAttribute("role", "menu");
    for (const item of items) {
      if (!item) {
        const rule = document.createElement("div");
        rule.className = "cm-md-table-menu-rule";
        menu.append(rule);
        continue;
      }
      const button = document.createElement("button");
      button.type = "button";
      button.setAttribute("role", "menuitem");
      button.textContent = item.label;
      button.disabled = Boolean(item.disabled);
      if (item.danger) button.dataset.danger = "";
      if (item.checked) button.dataset.checked = "";
      button.addEventListener("mousedown", (e) => e.preventDefault());
      button.addEventListener("click", () => {
        close();
        item.run();
      });
      menu.append(button);
    }
    const close = () => {
      menu.remove();
      document.removeEventListener("mousedown", outside, true);
      document.removeEventListener("keydown", escape, true);
    };
    const outside = (e: MouseEvent) => {
      if (!menu.contains(e.target as Node)) close();
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close();
      }
    };
    document.addEventListener("mousedown", outside, true);
    document.addEventListener("keydown", escape, true);
    (wrap.ownerDocument.body ?? document.body).append(menu);
    const box = menu.getBoundingClientRect();
    menu.style.left = `${Math.min(event.clientX, window.innerWidth - box.width - 8)}px`;
    menu.style.top = `${Math.min(event.clientY, window.innerHeight - box.height - 8)}px`;
    (menu.querySelector("button:not(:disabled)") as HTMLElement | null)?.focus();
  }
}
