import { useMemo, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Root, Element, ElementContent } from "hast";
import { useTranslation } from "react-i18next";
import type { NoteLink } from "@/lib/db/types";
import { resolveLink, type LinkWorld } from "@/lib/notes/resolve";
import {
  LINK,
  blockOf,
  maskIgnored,
  parseLinkInner,
  readFrontmatter,
  sectionOf,
} from "@/lib/notes/syntax";
import { cn } from "@/lib/utils";

/** Rewrites matches outside code and comments, leaving the rest of the text as it is. */
function outsideCode(text: string, pattern: RegExp, replace: (match: RegExpMatchArray) => string) {
  const masked = maskIgnored(text);
  let out = "";
  let last = 0;
  for (const match of masked.matchAll(pattern)) {
    const start = match.index ?? 0;
    const original = text.slice(start, start + match[0].length);
    const real = original.match(new RegExp(pattern.source, pattern.flags.replace("g", "")));
    if (!real) continue;
    out += text.slice(last, start) + replace(real);
    last = start + match[0].length;
  }
  return out + text.slice(last);
}

const encode = (value: string) => encodeURIComponent(value);

/**
 * Obsidian syntax turned into plain Markdown links with private schemes,
 * which the components below draw: `wl:` links, `embed:` embeds, `tag:`
 * tags and `hl:` highlights.
 */
function toMarkdown(body: string): string {
  let text = body.replace(/%%[\s\S]*?%%/g, "");
  text = outsideCode(text, LINK, (match) => {
    const link = parseLinkInner(match[2], match[1] === "!");
    const label =
      (link.alias ?? [link.target, link.heading].filter(Boolean).join(" › ")) || match[2];
    const safe = label.replace(/[[\]]/g, "");
    return match[1] === "!"
      ? `[${safe}](embed:${encode(match[2])})`
      : `[${safe}](wl:${encode(match[2])})`;
  });
  text = outsideCode(text, /==([^=\n]+)==/g, (match) => `[${match[1]}](hl:)`);
  text = outsideCode(
    text,
    /(^|[\s([{,;])#([\p{L}\p{N}_\-/]*[\p{L}_\-/][\p{L}\p{N}_\-/]*)/gu,
    (match) => `${match[1]}[#${match[2]}](tag:${encode(match[2])})`,
  );
  return text;
}

const textOf = (node: ElementContent): string =>
  node.type === "text"
    ? node.value
    : node.type === "element"
      ? node.children.map(textOf).join("")
      : "";

/** `> [!type] Title` blockquotes become callouts (a title row, then the body). */
function rehypeCallouts() {
  return (tree: Root) => {
    const walk = (node: Root | Element) => {
      for (const child of node.children) {
        if (child.type !== "element") continue;
        if (child.tagName === "blockquote") {
          const first = child.children.find(
            (each): each is Element => each.type === "element" && each.tagName === "p",
          );
          const lead = first?.children[0];
          if (first && lead?.type === "text") {
            const head = lead.value.match(/^\[!(\w+)\]([+-]?)[ \t]*([^\n]*)\n?/);
            if (head) {
              lead.value = lead.value.slice(head[0].length);
              child.properties = {
                ...child.properties,
                dataCallout: head[1].toLowerCase(),
                dataFold: head[2] || undefined,
              };
              const title: Element = {
                type: "element",
                tagName: "div",
                properties: { dataCalloutTitle: "" },
                children: [
                  {
                    type: "text",
                    value: head[3] || head[1].charAt(0).toUpperCase() + head[1].slice(1),
                  },
                ],
              };
              child.children.unshift(title);
              if (!textOf(first).trim()) child.children.splice(child.children.indexOf(first), 1);
            }
          }
        }
        walk(child);
      }
    };
    walk(tree);
  };
}

interface NoteReaderProps {
  body: string;
  world: LinkWorld;
  vaultId: string;
  onOpenLink: (link: NoteLink) => void;
  onTag?: (tag: string) => void;
  /** How deep embeds go; embeds inside embeds stop here. */
  depth?: number;
  className?: string;
}

/** A note read as formatted text (⌘E): links, embeds, callouts, tags and highlights. */
export function NoteReader({
  body,
  world,
  vaultId,
  onOpenLink,
  onTag,
  depth = 0,
  className,
}: NoteReaderProps) {
  const { t } = useTranslation("notes");
  const { data, content } = useMemo(() => readFrontmatter(body), [body]);
  const markdown = useMemo(() => toMarkdown(content), [content]);

  const components = useMemo<Components>(
    () => ({
      a: ({ href = "", children }) => {
        if (href.startsWith("hl:"))
          return <mark className="rounded-sm bg-warning/35 px-0.5 text-inherit">{children}</mark>;
        if (href.startsWith("tag:")) {
          const tag = decodeURIComponent(href.slice(4));
          return (
            <button
              type="button"
              onClick={() => onTag?.(tag)}
              className="cursor-pointer rounded-full bg-primary/12 px-1.5 text-primary no-underline hover:bg-primary/20"
            >
              {children}
            </button>
          );
        }
        if (href.startsWith("wl:")) {
          const link = parseLinkInner(decodeURIComponent(href.slice(3)));
          const exists =
            resolveLink(link, world, vaultId) !== null || (!link.target && !!link.heading);
          return (
            <button
              type="button"
              onClick={() => onOpenLink(link)}
              className={cn(
                "cursor-pointer text-primary underline decoration-primary/40 underline-offset-3 hover:decoration-primary",
                !exists && "decoration-dashed opacity-60",
              )}
            >
              {children}
            </button>
          );
        }
        if (href.startsWith("embed:")) {
          const link = parseLinkInner(decodeURIComponent(href.slice(6)), true);
          return (
            <Embed
              link={link}
              world={world}
              vaultId={vaultId}
              depth={depth}
              onOpenLink={onOpenLink}
              onTag={onTag}
            >
              {children}
            </Embed>
          );
        }
        return (
          <a href={href} target="_blank" rel="noreferrer noopener">
            {children}
          </a>
        );
      },
      blockquote: ({ node, children }) => {
        const callout = node?.properties?.dataCallout as string | undefined;
        if (!callout) return <blockquote>{children}</blockquote>;
        const tone = /warn|caution|danger|error|bug|fail/.test(callout)
          ? "border-warning bg-warning/10"
          : /tip|success|check|done/.test(callout)
            ? "border-success bg-success/10"
            : "border-info bg-info/10";
        return (
          <div
            data-callout={callout}
            className={cn(
              "rounded-lg border-s-4 px-4 py-2 not-italic [&_[data-callout-title]]:font-semibold",
              tone,
            )}
          >
            {children}
          </div>
        );
      },
    }),
    [world, vaultId, depth, onOpenLink, onTag],
  );

  const properties = Object.entries(data).filter(
    ([, value]) => value !== null && value !== undefined,
  );
  return (
    <div className={cn("markdown", className)}>
      {properties.length > 0 && depth === 0 ? (
        <dl className="not-prose mb-4 grid grid-cols-[minmax(6rem,auto)_1fr] gap-x-4 gap-y-1 rounded-xl border p-3 text-sm">
          <dt className="col-span-2 pb-1 text-xs font-medium text-muted-foreground">
            {t("properties")}
          </dt>
          {properties.map(([key, value]) => (
            <PropertyRow key={key} name={key} value={value} />
          ))}
        </dl>
      ) : null}
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeCallouts]}
        urlTransform={(url) => url}
        components={components}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}

function PropertyRow({ name, value }: { name: string; value: unknown }) {
  const shown = Array.isArray(value)
    ? value.join(", ")
    : typeof value === "object"
      ? JSON.stringify(value)
      : String(value);
  return (
    <>
      <dt className="text-muted-foreground">{name}</dt>
      <dd className="min-w-0 truncate">{shown}</dd>
    </>
  );
}

/** `![[…]]`: the note (or its heading or block) shown in place, or a card for a notebook or source. */
function Embed({
  link,
  world,
  vaultId,
  depth,
  onOpenLink,
  onTag,
  children,
}: {
  link: NoteLink;
  world: LinkWorld;
  vaultId: string;
  depth: number;
  onOpenLink: (link: NoteLink) => void;
  onTag?: (tag: string) => void;
  children: ReactNode;
}) {
  const { t } = useTranslation("notes");
  const target = resolveLink(link, world, vaultId);
  const open = (
    <button
      type="button"
      onClick={() => onOpenLink({ ...link, embed: false })}
      className="cursor-pointer text-xs font-medium text-primary hover:underline"
    >
      {children}
    </button>
  );
  if (target?.kind !== "note" || depth >= 2) {
    return (
      <span className="my-2 flex items-center gap-2 rounded-xl border px-3 py-2 text-sm">
        {open}
        {!target ? <span className="text-xs text-muted-foreground">{t("missing")}</span> : null}
      </span>
    );
  }
  const body = link.heading
    ? (sectionOf(target.note.body, link.heading) ?? "")
    : link.block
      ? (blockOf(target.note.body, link.block) ?? "")
      : readFrontmatter(target.note.body).content;
  return (
    <span className="my-3 block rounded-xl border-s-2 border-primary/50 bg-muted/40 px-4 py-2">
      <span className="mb-1 block">{open}</span>
      <NoteReader
        body={body}
        world={world}
        vaultId={target.note.vaultId}
        onOpenLink={onOpenLink}
        onTag={onTag}
        depth={depth + 1}
        className="text-sm"
      />
    </span>
  );
}
