import { syntaxTree } from "@codemirror/language";
import type { EditorState, Extension } from "@codemirror/state";
import { EditorView, ViewPlugin, type ViewUpdate } from "@codemirror/view";

/**
 * Notion's block handle for the notes editor. Hovering a block (a paragraph,
 * heading, list item, quote, code block or table) shows `+` and `⋮⋮` beside
 * its first line: `+` adds a block below, `⋮⋮` opens the block's menu on a
 * click and moves the block when dragged. The text stays plain Markdown; a
 * block is just the lines its syntax node covers.
 */
export interface Block {
  /** Start of the block's first line. */
  from: number;
  /** End of the block's last line. */
  to: number;
}

export interface BlockHandleOptions {
  /** `+` was pressed: add a block after `block`. */
  onAdd: (view: EditorView, block: Block) => void;
  /** `⋮⋮` was clicked: show the block's actions beside `anchor`. */
  onMenu: (view: EditorView, block: Block, anchor: DOMRect) => void;
  labels: { add: string; drag: string };
}

const LISTS = new Set(["BulletList", "OrderedList"]);

/** The block that holds `pos`: a top-level node, or one item of a list. */
export function blockAt(state: EditorState, pos: number): Block {
  const line = state.doc.lineAt(pos);
  let node = syntaxTree(state).topNode.firstChild;
  while (node) {
    const start = state.doc.lineAt(node.from).number;
    const end = state.doc.lineAt(Math.max(node.from, node.to - 1)).number;
    if (line.number >= start && line.number <= end) {
      let found = node;
      if (LISTS.has(node.name)) {
        let item = node.firstChild;
        while (item) {
          if (item.name === "ListItem" && pos >= item.from && pos <= item.to) found = item;
          item = item.nextSibling;
        }
      }
      return {
        from: state.doc.lineAt(found.from).from,
        to: state.doc.lineAt(Math.max(found.from, found.to - 1)).to,
      };
    }
    node = node.nextSibling;
  }
  return { from: line.from, to: line.to };
}

/** Moves the lines of `block` to just before the line starting at `target` (or the end). */
export function moveBlock(view: EditorView, block: Block, target: number) {
  const { doc } = view.state;
  if (target > block.from && target <= block.to + 1) return;
  const text = doc.sliceString(block.from, block.to);
  // Take the block's line break with it, from after it or, at the end, from before it.
  const cut =
    block.to < doc.length
      ? { from: block.from, to: block.to + 1 }
      : { from: Math.max(0, block.from - 1), to: block.to };
  const insert = target >= doc.length && doc.length > 0 ? `\n${text}` : `${text}\n`;
  const at = Math.min(target, doc.length);
  view.dispatch({
    changes: [cut, { from: at, insert }],
    userEvent: "move.block",
    scrollIntoView: true,
  });
}

const HANDLE_WIDTH = 48;

class BlockHandle {
  dom: HTMLElement;
  indicator: HTMLElement;
  block: Block | null = null;
  dragging = false;

  constructor(
    readonly view: EditorView,
    readonly options: BlockHandleOptions,
  ) {
    this.dom = document.createElement("div");
    this.dom.className = "cm-block-handle";
    this.dom.setAttribute("aria-hidden", "true");
    const add = this.button("cm-block-add", options.labels.add, PLUS);
    const grip = this.button("cm-block-grip", options.labels.drag, GRIP);
    add.addEventListener("mousedown", (event) => event.preventDefault());
    add.addEventListener("click", () => {
      if (this.block) options.onAdd(view, this.block);
    });
    grip.addEventListener("pointerdown", (event) => this.startDrag(event, grip));
    this.dom.append(add, grip);
    this.indicator = document.createElement("div");
    this.indicator.className = "cm-block-drop";
    view.scrollDOM.append(this.dom, this.indicator);
    view.scrollDOM.addEventListener("mousemove", this.onMove);
    view.scrollDOM.addEventListener("mouseleave", this.onLeave);
  }

  button(className: string, label: string, svg: string) {
    const button = document.createElement("button");
    button.type = "button";
    button.tabIndex = -1;
    button.className = className;
    button.title = label;
    button.innerHTML = svg;
    return button;
  }

  onMove = (event: MouseEvent) => {
    if (this.dragging) return;
    if (this.dom.contains(event.target as Node)) return;
    const content = this.view.contentDOM.getBoundingClientRect();
    const pos = this.view.posAtCoords({
      x: Math.min(Math.max(event.clientX, content.left + 60), content.right - 10),
      y: event.clientY,
    });
    if (pos === null) return this.hide();
    this.show(blockAt(this.view.state, pos));
  };

  onLeave = (event: MouseEvent) => {
    if (this.dragging || this.dom.contains(event.relatedTarget as Node)) return;
    this.hide();
  };

  show(block: Block) {
    this.block = block;
    const top = this.lineTop(block.from);
    const line = this.view.lineBlockAt(block.from);
    const firstLine = Math.min(line.height, this.lineHeight(block.from));
    // Beside the text in the margin; on a narrow pane, as far out as it fits.
    const left = Math.max(2, this.contentStart() - HANDLE_WIDTH - 6);
    this.dom.style.transform = `translate(${left}px, ${top + Math.max(0, (firstLine - 24) / 2)}px)`;
    this.dom.dataset.visible = "";
  }

  hide() {
    this.block = null;
    delete this.dom.dataset.visible;
  }

  /** The height of the block's first visual line, from where the next one starts. */
  lineHeight(pos: number) {
    const start = this.view.coordsAtPos(pos, 1);
    return start ? start.bottom - start.top : 24;
  }

  /** A line's top, in the scroller's own coordinates. */
  lineTop(pos: number) {
    const scroller = this.view.scrollDOM.getBoundingClientRect();
    const block = this.view.lineBlockAt(pos);
    return block.top + this.view.documentTop - scroller.top + this.view.scrollDOM.scrollTop;
  }

  contentStart() {
    const scroller = this.view.scrollDOM.getBoundingClientRect();
    const content = this.view.contentDOM;
    const style = getComputedStyle(content);
    const rect = content.getBoundingClientRect();
    const rtl = style.direction === "rtl";
    const padding = parseFloat(rtl ? style.paddingRight : style.paddingLeft) || 0;
    return rtl
      ? rect.right - padding - scroller.left + HANDLE_WIDTH + 8
      : rect.left + padding - scroller.left + this.view.scrollDOM.scrollLeft;
  }

  startDrag(event: PointerEvent, grip: HTMLElement) {
    const block = this.block;
    if (!block || event.button !== 0) return;
    event.preventDefault();
    const startY = event.clientY;
    let target: number | null = null;
    grip.setPointerCapture(event.pointerId);

    const move = (each: PointerEvent) => {
      if (!this.dragging && Math.abs(each.clientY - startY) < 4) return;
      this.dragging = true;
      this.view.dom.classList.add("cm-block-dragging");
      const content = this.view.contentDOM.getBoundingClientRect();
      const pos = this.view.posAtCoords({ x: content.left + content.width / 2, y: each.clientY });
      if (pos === null) return;
      const over = blockAt(this.view.state, pos);
      const middle =
        (this.lineTop(over.from) + this.lineTop(over.to) + this.view.lineBlockAt(over.to).height) /
        2;
      const scroller = this.view.scrollDOM.getBoundingClientRect();
      const y = each.clientY - scroller.top + this.view.scrollDOM.scrollTop;
      const before = y < middle;
      target = before ? over.from : Math.min(over.to + 1, this.view.state.doc.length);
      const lineY = before
        ? this.lineTop(over.from)
        : this.lineTop(over.to) + this.view.lineBlockAt(over.to).height;
      this.indicator.style.transform = `translate(${this.contentStart()}px, ${lineY - 1}px)`;
      this.indicator.style.width = `${content.width - 80}px`;
      this.indicator.dataset.visible = "";
    };
    const up = () => {
      grip.removeEventListener("pointermove", move);
      grip.removeEventListener("pointerup", up);
      grip.removeEventListener("pointercancel", up);
      delete this.indicator.dataset.visible;
      this.view.dom.classList.remove("cm-block-dragging");
      if (this.dragging) {
        this.dragging = false;
        if (target !== null) moveBlock(this.view, block, target);
        this.hide();
      } else {
        this.options.onMenu(this.view, block, grip.getBoundingClientRect());
      }
    };
    grip.addEventListener("pointermove", move);
    grip.addEventListener("pointerup", up);
    grip.addEventListener("pointercancel", up);
  }

  update(update: ViewUpdate) {
    if (update.docChanged || update.geometryChanged) this.hide();
  }

  destroy() {
    this.view.scrollDOM.removeEventListener("mousemove", this.onMove);
    this.view.scrollDOM.removeEventListener("mouseleave", this.onLeave);
    this.dom.remove();
    this.indicator.remove();
  }
}

const PLUS = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>`;
const GRIP = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>`;

export function blockHandle(options: BlockHandleOptions): Extension {
  return [
    ViewPlugin.define((view) => new BlockHandle(view, options)),
    EditorView.theme({
      ".cm-scroller": { position: "relative" },
      ".cm-block-handle": {
        position: "absolute",
        top: "0",
        left: "0",
        zIndex: "5",
        display: "flex",
        alignItems: "center",
        gap: "1px",
        opacity: "0",
        pointerEvents: "none",
        transition: "opacity 120ms",
      },
      ".cm-block-handle[data-visible]": { opacity: "1", pointerEvents: "auto" },
      ".cm-block-handle button": {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "22px",
        height: "24px",
        borderRadius: "6px",
        color: "var(--muted-foreground)",
        cursor: "pointer",
        background: "transparent",
        border: "none",
      },
      ".cm-block-handle button:hover": {
        backgroundColor: "color-mix(in oklab, var(--foreground) 8%, transparent)",
        color: "var(--foreground)",
      },
      ".cm-block-grip": { cursor: "grab !important" },
      "&.cm-block-dragging, &.cm-block-dragging *": { cursor: "grabbing !important" },
      ".cm-block-drop": {
        position: "absolute",
        top: "0",
        left: "0",
        height: "3px",
        borderRadius: "2px",
        backgroundColor: "color-mix(in oklab, var(--info) 70%, transparent)",
        opacity: "0",
        pointerEvents: "none",
        zIndex: "5",
      },
      ".cm-block-drop[data-visible]": { opacity: "1" },
    }),
  ];
}
