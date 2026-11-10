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
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import type { NoteLink } from "@/lib/db/types";
import { linkCompletion, tagCompletion, type CompletionWorld } from "./completion";
import { notesKeymap } from "./keymap";
import { livePreview } from "./live-preview";
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
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
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

  return <div ref={host} className="h-full min-h-0" />;
});
