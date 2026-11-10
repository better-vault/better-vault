import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Segmented } from "@/components/common/segmented";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Note } from "@/lib/db/types";
import { backlinksOf, unlinkedMentionsOf, type LinkWorld } from "@/lib/notes/resolve";
import { extractHeadings } from "@/lib/notes/syntax";
import { cn } from "@/lib/utils";

type Pane = "backlinks" | "outline";

/** A short piece of `body` around the first place `names` appear. */
function snippet(body: string, names: string[]): string {
  const lower = body.toLowerCase();
  const at = Math.max(
    0,
    Math.min(
      ...names.map((name) => lower.indexOf(name.toLowerCase())).filter((index) => index >= 0),
      body.length,
    ),
  );
  const start = Math.max(0, at - 50);
  return `${start > 0 ? "…" : ""}${body
    .slice(start, at + 90)
    .replace(/\s+/g, " ")
    .trim()}…`;
}

/**
 * The note's side panel: the notes that link to it (and those that only
 * mention it, with a button to link them), and its outline.
 */
export function NoteDetails({
  note,
  world,
  onOpen,
  onLinkMention,
  onHeading,
}: {
  note: Note;
  world: LinkWorld;
  onOpen: (id: string) => void;
  /** Turns a plain mention of the title in another note into a link. */
  onLinkMention: (other: Note) => void;
  onHeading: (offset: number) => void;
}) {
  const { t } = useTranslation("notes");
  const [pane, setPane] = useState<Pane>("backlinks");
  const linked = useMemo(() => backlinksOf(note, world), [note, world]);
  const unlinked = useMemo(() => unlinkedMentionsOf(note, world), [note, world]);
  const headings = useMemo(() => extractHeadings(note.body), [note.body]);
  const names = [note.title, ...note.aliases];

  return (
    <aside aria-label={t("panes.label")} className="flex min-h-0 flex-col">
      <div className="px-3 pt-3 pb-2">
        <Segmented<Pane>
          aria-label={t("panes.label")}
          size="sm"
          value={pane}
          onValueChange={setPane}
          className="w-full *:flex-1"
          options={[
            { value: "backlinks", label: `${t("panes.backlinks")} ${linked.length || ""}`.trim() },
            { value: "outline", label: t("panes.outline") },
          ]}
        />
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-4 px-3 pb-4">
          {pane === "backlinks" ? (
            <>
              <section className="flex flex-col gap-1.5">
                <h3 className="text-xs font-medium text-muted-foreground">{t("panes.linked")}</h3>
                {linked.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t("panes.noBacklinks")}</p>
                ) : (
                  linked.map((other) => (
                    <button
                      key={other.id}
                      type="button"
                      onClick={() => onOpen(other.id)}
                      className="flex cursor-pointer flex-col gap-0.5 rounded-lg px-2 py-1.5 text-start outline-none hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="truncate text-sm font-medium">{other.title}</span>
                      <span className="line-clamp-2 text-xs text-muted-foreground">
                        {snippet(
                          other.body,
                          names.map((name) => `[[${name}`),
                        )}
                      </span>
                    </button>
                  ))
                )}
              </section>
              <section className="flex flex-col gap-1.5">
                <h3 className="text-xs font-medium text-muted-foreground">{t("panes.unlinked")}</h3>
                {unlinked.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t("panes.noUnlinked")}</p>
                ) : (
                  unlinked.map((other) => (
                    <div
                      key={other.id}
                      className="flex items-start gap-1 rounded-lg px-2 py-1.5 hover:bg-accent/60"
                    >
                      <button
                        type="button"
                        onClick={() => onOpen(other.id)}
                        className="flex min-w-0 flex-1 cursor-pointer flex-col gap-0.5 text-start outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <span className="truncate text-sm font-medium">{other.title}</span>
                        <span className="line-clamp-2 text-xs text-muted-foreground">
                          {snippet(other.body, names)}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onLinkMention(other)}
                        className="shrink-0 cursor-pointer rounded-md px-1.5 py-0.5 text-xs text-primary outline-none hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {t("panes.link")}
                      </button>
                    </div>
                  ))
                )}
              </section>
            </>
          ) : headings.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t("panes.noOutline")}</p>
          ) : (
            <nav className="flex flex-col">
              {headings.map((heading) => (
                <button
                  key={heading.from}
                  type="button"
                  onClick={() => onHeading(heading.from)}
                  style={{ paddingInlineStart: `${(heading.level - 1) * 0.75 + 0.5}rem` }}
                  className={cn(
                    "cursor-pointer truncate rounded-md py-1 pe-2 text-start text-sm outline-none hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring",
                    heading.level > 2 && "text-muted-foreground",
                  )}
                >
                  {heading.text}
                </button>
              ))}
            </nav>
          )}
        </div>
      </ScrollArea>
    </aside>
  );
}
