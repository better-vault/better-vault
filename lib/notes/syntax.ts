import { parse as parseYaml } from "yaml";
import type { NoteLink } from "@/lib/db/types";

/**
 * Obsidian's Markdown, read the way Obsidian reads it:
 *
 * - `[[Note]]`, `[[Note|shown text]]`, `[[Note#Heading]]`, `[[Note#^block]]`
 * - `![[Note]]` embeds the note (or a heading of it) in place
 * - `[[nb:Notebook]]` and `[[src:Source]]` point at a notebook or a source
 * - `[[Vault/Note]]` points at a note in another vault
 * - `#tag` and `#nested/tag`; frontmatter `tags:` and `aliases:`
 * - callouts `> [!note]`, tasks `- [ ]`, `==highlight==`, `%%comment%%`
 *
 * Code (fenced and inline) and comments are skipped, so a link written as an
 * example inside them does not count.
 */

export interface Frontmatter {
  data: Record<string, unknown>;
  /** The body after the frontmatter. */
  content: string;
  /** Characters the frontmatter takes at the start of the text, 0 without one. */
  length: number;
}

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;

export function readFrontmatter(text: string): Frontmatter {
  const match = text.match(FRONTMATTER);
  if (!match) return { data: {}, content: text, length: 0 };
  let data: Record<string, unknown> = {};
  try {
    const parsed = parseYaml(match[1]) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
      data = parsed as Record<string, unknown>;
  } catch {
    // Broken YAML is kept as text; the note still saves.
  }
  return { data, content: text.slice(match[0].length), length: match[0].length };
}

/** A string or a list of strings in frontmatter, as Obsidian accepts both. */
function stringList(value: unknown): string[] {
  if (typeof value === "string")
    return value
      .split(/[,\s]+/)
      .map((each) => each.trim())
      .filter(Boolean);
  if (Array.isArray(value))
    return value.filter((each): each is string => typeof each === "string" && each.trim() !== "");
  return [];
}

/** Blanks code and comments with spaces, keeping every other character where it was. */
export function maskIgnored(text: string): string {
  const blank = (match: string) => match.replace(/[^\n]/g, " ");
  return text
    .replace(/^(```|~~~)[^\n]*\n[\s\S]*?(?:^\1[^\n]*$|(?![\s\S]))/gm, blank)
    .replace(/`[^`\n]+`/g, blank)
    .replace(/%%[\s\S]*?%%/g, blank);
}

export const LINK = /(!?)\[\[([^[\]\n]+?)\]\]/g;

/** Splits what is inside `[[…]]` into its parts. */
export function parseLinkInner(inner: string, embed = false): NoteLink {
  let rest = inner;
  let alias: string | undefined;
  const bar = rest.indexOf("|");
  if (bar >= 0) {
    alias = rest.slice(bar + 1).trim() || undefined;
    rest = rest.slice(0, bar);
  }
  let heading: string | undefined;
  let block: string | undefined;
  const hash = rest.indexOf("#");
  if (hash >= 0) {
    const anchor = rest.slice(hash + 1).trim();
    rest = rest.slice(0, hash);
    if (anchor.startsWith("^")) block = anchor.slice(1) || undefined;
    else heading = anchor || undefined;
  }
  let kind: NoteLink["kind"] = "note";
  let target = rest.trim();
  const prefix = target.match(/^(nb|src):\s*/i);
  if (prefix) {
    kind = prefix[1].toLowerCase() === "nb" ? "notebook" : "source";
    target = target.slice(prefix[0].length).trim();
  }
  return {
    kind,
    target,
    ...(heading ? { heading } : {}),
    ...(block ? { block } : {}),
    ...(alias ? { alias } : {}),
    embed,
  };
}

export function extractLinks(text: string): NoteLink[] {
  const masked = maskIgnored(text);
  const links: NoteLink[] = [];
  for (const match of masked.matchAll(LINK)) {
    const link = parseLinkInner(match[2], match[1] === "!");
    if (link.target || link.heading || link.block) links.push(link);
  }
  return links;
}

/** `#tag`, not inside a word, a heading mark or a URL fragment; not only digits. */
const TAG = /(^|[\s([{,;])#([\p{L}\p{N}_\-/]*[\p{L}_\-/][\p{L}\p{N}_\-/]*)/gu;

export function extractTags(text: string): string[] {
  const { data, content } = readFrontmatter(text);
  const tags = new Set(stringList(data.tags ?? data.tag).map((tag) => tag.replace(/^#/, "")));
  for (const match of maskIgnored(content).matchAll(TAG)) tags.add(match[2].replace(/\/+$/, ""));
  return [...tags].filter(Boolean).sort((a, b) => a.localeCompare(b));
}

export function extractAliases(text: string): string[] {
  const { data } = readFrontmatter(text);
  return stringList(data.aliases ?? data.alias);
}

export interface Heading {
  level: number;
  text: string;
  /** Character offset of the heading's line. */
  from: number;
}

export function extractHeadings(text: string): Heading[] {
  const masked = maskIgnored(text);
  const headings: Heading[] = [];
  for (const match of masked.matchAll(/^(#{1,6})[ \t]+(.+?)[ \t#]*$/gm)) {
    headings.push({ level: match[1].length, text: match[2].trim(), from: match.index ?? 0 });
  }
  return headings;
}

/** What a note's body says about itself, saved with the note. */
export function analyse(text: string): { tags: string[]; aliases: string[]; links: NoteLink[] } {
  return { tags: extractTags(text), aliases: extractAliases(text), links: extractLinks(text) };
}

/** How names compare in links: case and surrounding spaces don't matter, as in Obsidian. */
export const sameName = (a: string, b: string) =>
  a.trim().localeCompare(b.trim(), undefined, { sensitivity: "accent" }) === 0;

/**
 * Rewrites every link to a renamed note in a body, keeping each link's
 * heading, block and shown text. Returns the body unchanged when none point at it.
 */
export function renameLinks(text: string, from: string, to: string): string {
  const masked = maskIgnored(text);
  let out = "";
  let last = 0;
  for (const match of masked.matchAll(LINK)) {
    const link = parseLinkInner(match[2], match[1] === "!");
    if (link.kind !== "note") continue;
    const slash = link.target.lastIndexOf("/");
    const vaultPart = slash >= 0 ? link.target.slice(0, slash + 1) : "";
    const name = link.target.slice(vaultPart.length);
    if (!sameName(name, from)) continue;
    const start = match.index ?? 0;
    const original = text.slice(start, start + match[0].length);
    const inner = original.slice(match[1].length + 2, -2);
    const cut = inner.search(/[#|]/);
    const tail = cut >= 0 ? inner.slice(cut) : "";
    out += text.slice(last, start) + `${match[1]}[[${vaultPart}${to}${tail}]]`;
    last = start + match[0].length;
  }
  return last === 0 ? text : out + text.slice(last);
}

/** The text of a note under a heading, up to the next heading of the same or a higher level. */
export function sectionOf(text: string, heading: string): string | null {
  const headings = extractHeadings(text);
  const at = headings.findIndex((each) => sameName(each.text, heading));
  if (at < 0) return null;
  const start = headings[at];
  const end = headings.slice(at + 1).find((each) => each.level <= start.level);
  return text.slice(start.from, end?.from ?? text.length).trim();
}

/** The line carrying `^id`, the way Obsidian marks a block, without the mark. */
export function blockOf(text: string, id: string): string | null {
  const line = text.split("\n").find((each) => each.trimEnd().endsWith(`^${id}`));
  return line ? line.replace(new RegExp(`\\s*\\^${id}\\s*$`), "") : null;
}
