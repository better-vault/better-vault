import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
} from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { foldKeymap, indentOnInput } from "@codemirror/language";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import { EditorState } from "@codemirror/state";
import {
  drawSelection,
  EditorView,
  keymap,
  placeholder as placeholderText,
} from "@codemirror/view";
import {
  ArrowDown01Icon,
  ArrowUp01Icon,
  Copy01Icon,
  Delete02Icon,
  Layers01Icon,
} from "@hugeicons/core-free-icons";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { NoteLink } from "@/lib/db/types";
import { linkCompletion, tagCompletion, type CompletionWorld } from "./completion";
import { blockAt, blockHandle, moveBlock, type Block } from "./block-handle";
import {
  blockItems,
  deleteBlock,
  duplicateBlock,
  insertItem,
  turnInto,
  type BlockItem,
} from "./block-items";
import { BlockMenu, type MenuEntry } from "./block-menu";
import { blockPreview } from "./block-previews";
import { notesKeymap } from "./keymap";
import { livePreview } from "./live-preview";
import { richBlocks } from "./rich-blocks";
import { notesHighlight, notesTheme } from "./theme";

export interface NoteEditorHandle {
  focus: () => void;
  /** Puts the cursor at a character offset and scrolls it into view. */
  reveal: (offset: number) => void;
}

interface NoteEditorProps {
  /** The note's id: a new id starts a new editor state (its own undo history). */
  docId: string;
  value: string;
  onChange: (value: string) => void;
  /** Everything `[[` and `#` can complete to. Read when the menu opens. */
  world: () => CompletionWorld;
  resolves: (link: NoteLink) => boolean;
  onOpenLink: (link: NoteLink) => void;
  placeholder?: string;
  label: string;
}

/**
 * The notes editor: CodeMirror 6 (the engine Obsidian uses) with Live
 * Preview, `[[` and `#` completion and Obsidian's editing keys. It owns its
 * text while open; `onChange` reports each edit, and the page saves them.
 */
export const NoteEditor = forwardRef<NoteEditorHandle, NoteEditorProps>(function NoteEditor(
  { docId, value, onChange, world, resolves, onOpenLink, placeholder, label },
  ref,
) {
  const { t } = useTranslation("notes");
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const openMenu = useRef(setMenu);
  // Callbacks change on every render; the editor reads the latest through refs.
  const latest = useRef({ onChange, world, resolves, onOpenLink });
  latest.current = { onChange, world, resolves, onOpenLink };

  useImperativeHandle(ref, () => ({
    focus: () => view.current?.focus(),
    reveal: (offset) => {
      const current = view.current;
      if (!current) return;
      const at = Math.min(offset, current.state.doc.length);
      current.dispatch({ selection: { anchor: at }, scrollIntoView: true });
      current.focus();
    },
  }));

  useEffect(() => {
    if (!host.current) return;
    const open = (link: NoteLink) => latest.current.onOpenLink(link);
    const state = EditorState.create({
      doc: value,
      extensions: [
        history(),
        drawSelection(),
        indentOnInput(),
        closeBrackets(),
        highlightSelectionMatches(),
        EditorView.lineWrapping,
        markdown({ base: markdownLanguage, completeHTMLTags: false }),
        autocompletion({
          override: [
            linkCompletion(() => latest.current.world()),
            tagCompletion(() => latest.current.world()),
          ],
          icons: false,
        }),
        livePreview({ resolves: (link) => latest.current.resolves(link), open }),
        richBlocks(),
        blockHandle({
          labels: { add: t("blocks.add"), drag: t("blocks.drag") },
          onAdd: (editor, block) => {
            // A new empty line under the block, then the menu of blocks for it.
            editor.dispatch({
              changes: { from: block.to, insert: "\n" },
              selection: { anchor: block.to + 1 },
            });
            openMenu.current({
              mode: "insert",
              range: { from: block.to + 1, to: block.to + 1 },
              anchor: anchorAt(editor, block.to + 1),
            });
          },
          onMenu: (_editor, block, rect) =>
            openMenu.current({
              mode: "block",
              block,
              anchor: { x: rect.left, y: rect.bottom, top: rect.top },
            }),
        }),
        // "/" at the start of an empty line opens the same menu, like Notion.
        EditorView.updateListener.of((update) => {
          if (!update.docChanged) return;
          if (!update.transactions.some((tr) => tr.isUserEvent("input.type"))) return;
          const head = update.state.selection.main.head;
          const line = update.state.doc.lineAt(head);
          if (line.text === "/" && head === line.to) {
            openMenu.current({
              mode: "insert",
              range: { from: line.from, to: line.to },
              anchor: anchorAt(update.view, line.from),
            });
          }
        }),
        keymap.of([
          ...notesKeymap(open),
          ...closeBracketsKeymap,
          ...completionKeymap,
          ...searchKeymap,
          ...foldKeymap,
          ...historyKeymap,
          ...defaultKeymap,
        ]),
        notesTheme,
        notesHighlight,
        placeholder ? placeholderText(placeholder) : [],
        EditorView.contentAttributes.of({ "aria-label": label, spellcheck: "true" }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) latest.current.onChange(update.state.doc.toString());
        }),
      ],
    });
    const editor = new EditorView({ state, parent: host.current });
    view.current = editor;
    return () => {
      editor.destroy();
      view.current = null;
    };
    // A new note gets a new editor; later `value` changes come from the editor itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId]);

  // Text changed outside the editor (a rename rewrote links): take it in.
  useEffect(() => {
    const current = view.current;
    if (!current) return;
    const text = current.state.doc.toString();
    if (text !== value && !current.hasFocus) {
      current.dispatch({ changes: { from: 0, to: text.length, insert: value } });
    }
  }, [value]);

  const close = useCallback(() => setMenu(null), []);

  return (
    <>
      <div ref={host} className="h-full min-h-0" />
      {menu && view.current ? (
        <BlockMenu
          anchor={menu.anchor}
          onClose={close}
          groups={
            menu.mode === "insert"
              ? [
                  { id: "basic", title: t("blocks.groups.basic") },
                  { id: "links", title: t("blocks.groups.links") },
                  { id: "media", title: t("blocks.groups.media") },
                ]
              : [
                  { id: "actions", title: t("blocks.groups.actions") },
                  { id: "turn", title: t("blocks.groups.turnInto") },
                ]
          }
          entries={
            menu.mode === "insert"
              ? insertEntries(view.current, menu.range, t)
              : blockEntries(view.current, menu.block, t)
          }
        />
      ) : null}
    </>
  );
});

type MenuState =
  | { mode: "insert"; range: { from: number; to: number }; anchor: Anchor }
  | { mode: "block"; block: Block; anchor: Anchor };
type Anchor = { x: number; y: number; top: number };
type Translate = ReturnType<typeof useTranslation<"notes">>["t"];

/** Where a menu for the line at `pos` opens: under the line, from the text's start. */
function anchorAt(editor: EditorView, pos: number): Anchor {
  const coords = editor.coordsAtPos(pos) ?? editor.coordsAtPos(Math.max(0, pos - 1));
  if (!coords) {
    const rect = editor.contentDOM.getBoundingClientRect();
    return { x: rect.left, y: rect.top, top: rect.top };
  }
  return { x: coords.left, y: coords.bottom, top: coords.top };
}

const itemLabel = (t: Translate, item: BlockItem) =>
  t(`blocks.items.${item.id}` as "blocks.items.text");

function insertEntries(
  editor: EditorView,
  range: { from: number; to: number },
  t: Translate,
): MenuEntry[] {
  return blockItems.map((item) => ({
    id: item.id,
    group: item.group,
    label: itemLabel(t, item),
    icon: item.icon,
    hint: item.hint,
    keywords: item.keywords,
    preview: blockPreview(item.id, itemLabel(t, item)),
    run: () => {
      // The line may have changed while the menu was open; only replace it if it is still empty or "/".
      const line = editor.state.doc.lineAt(Math.min(range.from, editor.state.doc.length));
      const target = line.text === "/" || line.text.trim() === "" ? line : null;
      insertItem(editor, target ? { from: target.from, to: target.to } : range, item);
    },
  }));
}

function blockEntries(editor: EditorView, block: Block, t: Translate): MenuEntry[] {
  const { state } = editor;
  const before = block.from > 0 ? blockAt(state, block.from - 1) : null;
  const after = block.to < state.doc.length ? blockAt(state, block.to + 1) : null;
  const actions: MenuEntry[] = [
    {
      id: "duplicate",
      group: "actions",
      label: t("blocks.actions.duplicate"),
      icon: Layers01Icon,
      hint: "",
      run: () => duplicateBlock(editor, block),
    },
    {
      id: "copy",
      group: "actions",
      label: t("blocks.actions.copy"),
      icon: Copy01Icon,
      run: () => void navigator.clipboard.writeText(state.doc.sliceString(block.from, block.to)),
    },
    ...(before
      ? [
          {
            id: "up",
            group: "actions",
            label: t("blocks.actions.moveUp"),
            icon: ArrowUp01Icon,
            run: () => moveBlock(editor, block, before.from),
          },
        ]
      : []),
    ...(after
      ? [
          {
            id: "down",
            group: "actions",
            label: t("blocks.actions.moveDown"),
            icon: ArrowDown01Icon,
            run: () => moveBlock(editor, block, Math.min(after.to + 1, state.doc.length)),
          },
        ]
      : []),
    {
      id: "delete",
      group: "actions",
      label: t("blocks.actions.delete"),
      icon: Delete02Icon,
      destructive: true,
      run: () => deleteBlock(editor, block),
    },
  ];
  const turn = blockItems
    .filter((item) => item.prefix !== undefined)
    .map<MenuEntry>((item) => ({
      id: `turn-${item.id}`,
      group: "turn",
      label: itemLabel(t, item),
      icon: item.icon,
      hint: item.hint,
      keywords: item.keywords,
      preview: blockPreview(item.id, itemLabel(t, item)),
      run: () => turnInto(editor, block, item),
    }));
  return [...actions, ...turn];
}
