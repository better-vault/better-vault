import type { Completion, CompletionContext, CompletionResult } from "@codemirror/autocomplete";

/** What `[[` and `#` can complete to, read when the menu opens. */
export interface CompletionWorld {
  /** Notes as `[title, vault label]`; notes in other vaults complete as `Vault/Title`. */
  notes: { title: string; vault: string; aliases: string[]; here: boolean }[];
  notebooks: string[];
  sources: string[];
  tags: string[];
}

/**
 * `[[` offers notes (and their aliases), then notebooks as `nb:` and
 * sources as `src:`. The closing `]]` is added unless it is already there.
 */
export function linkCompletion(world: () => CompletionWorld) {
  return (context: CompletionContext): CompletionResult | null => {
    const before = context.matchBefore(/!?\[\[[^[\]\n|#]*$/);
    if (!before) return null;
    const from = before.from + before.text.indexOf("[[") + 2;
    const closed = context.state.sliceDoc(context.pos, context.pos + 2) === "]]";
    const apply = (name: string) => (closed ? name : `${name}]]`);
    const { notes, notebooks, sources } = world();
    const options: Completion[] = [
      ...notes.flatMap((note) => {
        const name = note.here ? note.title : `${note.vault}/${note.title}`;
        return [
          {
            label: name,
            apply: apply(name),
            type: "note",
            detail: note.here ? undefined : note.vault,
            boost: note.here ? 2 : 0,
          },
          ...note.aliases.map((alias) => ({
            label: alias,
            apply: apply(`${name}|${alias}`),
            type: "alias",
            detail: `→ ${note.title}`,
          })),
        ];
      }),
      ...notebooks.map((title) => ({
        label: `nb:${title}`,
        apply: apply(`nb:${title}`),
        type: "notebook",
      })),
      ...sources.map((title) => ({
        label: `src:${title}`,
        apply: apply(`src:${title}`),
        type: "source",
      })),
    ];
    return { from, options, validFor: /^[^[\]\n|#]*$/ };
  };
}

/** `#` offers the tags already used in the vault. */
export function tagCompletion(world: () => CompletionWorld) {
  return (context: CompletionContext): CompletionResult | null => {
    const before = context.matchBefore(/(?:^|[\s([{,;])#[\p{L}\p{N}_\-/]*$/u);
    if (!before) return null;
    const hash = before.from + before.text.indexOf("#");
    if (!context.explicit && context.pos === hash + 1 && before.text.trim() === "#") {
      // A lone "#" at a line start is more likely a heading.
      const line = context.state.doc.lineAt(context.pos);
      if (hash === line.from) return null;
    }
    return {
      from: hash + 1,
      options: world().tags.map((tag) => ({ label: tag, type: "tag" })),
      validFor: /^[\p{L}\p{N}_\-/]*$/u,
    };
  };
}
