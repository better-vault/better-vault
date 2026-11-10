import { deleteLine, indentLess, indentMore } from "@codemirror/commands";
import { foldCode, unfoldCode } from "@codemirror/language";
import { EditorSelection, type StateCommand } from "@codemirror/state";
import type { EditorView, KeyBinding } from "@codemirror/view";
import type { NoteLink } from "@/lib/db/types";
import { LINK, parseLinkInner } from "@/lib/notes/syntax";

/** Wraps each selection in `mark` (or removes it when already wrapped), like ⌘B in Obsidian. */
function toggleWrap(mark: string): StateCommand {
  return ({ state, dispatch }) => {
    const change = state.changeByRange((range) => {
      const before = state.sliceDoc(range.from - mark.length, range.from);
      const after = state.sliceDoc(range.to, range.to + mark.length);
      if (before === mark && after === mark) {
        return {
          changes: [
            { from: range.from - mark.length, to: range.from },
            { from: range.to, to: range.to + mark.length },
          ],
          range: EditorSelection.range(range.from - mark.length, range.to - mark.length),
        };
      }
      return {
        changes: [
          { from: range.from, insert: mark },
          { from: range.to, insert: mark },
        ],
        range: EditorSelection.range(range.from + mark.length, range.to + mark.length),
      };
    });
    dispatch(state.update(change, { scrollIntoView: true, userEvent: "input" }));
    return true;
  };
}

/** ⌘K inside the editor: `[[selection]]`, or `[[]]` with the cursor inside. */
const insertLink: StateCommand = ({ state, dispatch }) => {
  const change = state.changeByRange((range) => ({
    changes: [
      { from: range.from, insert: "[[" },
      { from: range.to, insert: "]]" },
    ],
    range: range.empty
      ? EditorSelection.cursor(range.from + 2)
      : EditorSelection.range(range.from + 2, range.to + 2),
  }));
  dispatch(state.update(change, { scrollIntoView: true, userEvent: "input" }));
  return true;
};

/** ⌘L: a line becomes a task, an open task is ticked, a ticked one is opened again. */
const toggleTask: StateCommand = ({ state, dispatch }) => {
  const lines = new Set<number>();
  for (const range of state.selection.ranges) {
    for (let n = state.doc.lineAt(range.from).number; n <= state.doc.lineAt(range.to).number; n++)
      lines.add(n);
  }
  const changes = [...lines].map((n) => {
    const line = state.doc.line(n);
    const task = line.text.match(/^(\s*[-*+] )\[([ xX])\]/);
    if (task) {
      const at = line.from + task[1].length + 1;
      return { from: at, to: at + 1, insert: task[2] === " " ? "x" : " " };
    }
    const bullet = line.text.match(/^(\s*)[-*+] /);
    if (bullet) return { from: line.from + bullet[0].length, insert: "[ ] " };
    const indent = line.text.match(/^\s*/)?.[0].length ?? 0;
    return { from: line.from + indent, insert: "- [ ] " };
  });
  dispatch(state.update({ changes, scrollIntoView: true, userEvent: "input" }));
  return true;
};

/** The `[[link]]` the cursor is in, if any. */
export function linkAtCursor(view: EditorView): NoteLink | null {
  const pos = view.state.selection.main.head;
  const line = view.state.doc.lineAt(pos);
  for (const match of line.text.matchAll(LINK)) {
    const start = line.from + (match.index ?? 0);
    if (pos >= start && pos <= start + match[0].length)
      return parseLinkInner(match[2], match[1] === "!");
  }
  return null;
}

/** Obsidian's editing keys. Keys that belong to the whole workspace (⌘E, ⌘O, ⌘G…) live there. */
export function notesKeymap(openLink: (link: NoteLink) => void): KeyBinding[] {
  return [
    { key: "Mod-b", run: toggleWrap("**") },
    { key: "Mod-i", run: toggleWrap("*") },
    { key: "Mod-Shift-x", run: toggleWrap("~~") },
    { key: "Mod-Shift-h", run: toggleWrap("==") },
    { key: "Mod-k", run: insertLink },
    { key: "Mod-l", run: toggleTask },
    { key: "Mod-d", run: deleteLine },
    { key: "Mod-]", run: indentMore },
    { key: "Mod-[", run: indentLess },
    { key: "Mod-ArrowUp", run: foldCode },
    { key: "Mod-ArrowDown", run: unfoldCode },
    {
      key: "Mod-Enter",
      run: (view) => {
        const link = linkAtCursor(view);
        if (!link) return false;
        openLink(link);
        return true;
      },
    },
  ];
}
