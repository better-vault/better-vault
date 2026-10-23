import MiniSearch from "minisearch";
import type { PassageRef } from "@/lib/chat/types";
import type { Chunk, Source } from "@/lib/db/database";

/** A numbered passage given to the model. */
export interface Passage extends Omit<PassageRef, "snippet"> {
  text: string;
}

type SourceInfo = Pick<Source, "id" | "title" | "kind">;

interface SelectOptions {
  sources: SourceInfo[];
  /** The selected sources' passages, in reading order. */
  chunks: Chunk[];
  /** How many characters of text may be sent. */
  budget: number;
  /** What the passages should be about: the question, or a Studio tool's focus. */
  query?: string;
}

/** Takes chunks in order until the budget is spent. */
function fill(chunks: Chunk[], budget: number): Chunk[] {
  const out: Chunk[] = [];
  let used = 0;
  for (const chunk of chunks) {
    if (used + chunk.text.length > budget) continue;
    out.push(chunk);
    used += chunk.text.length;
  }
  return out;
}

/** An even spread of each source's passages, each source getting a share of the budget by its size. */
function spread(chunks: Chunk[], budget: number): Chunk[] {
  const bySource = new Map<string, Chunk[]>();
  for (const chunk of chunks) bySource.set(chunk.sourceId, [...(bySource.get(chunk.sourceId) ?? []), chunk]);
  const total = chunks.reduce((sum, chunk) => sum + chunk.text.length, 0);
  const picked: Chunk[] = [];
  for (const list of bySource.values()) {
    const size = list.reduce((sum, chunk) => sum + chunk.text.length, 0);
    const share = Math.max(budget * (size / total), list[0].text.length);
    const average = size / list.length;
    const count = Math.max(1, Math.min(list.length, Math.floor(share / average)));
    const step = list.length / count;
    for (let i = 0; i < count; i++) picked.push(list[Math.floor(i * step)]);
  }
  return fill(picked, budget);
}

/** The passages most related to the query, then an even spread to use what is left. */
function search(chunks: Chunk[], titles: Map<string, string>, query: string, budget: number): Chunk[] {
  const index = new MiniSearch<{ id: string; text: string; title: string }>({
    fields: ["text", "title"],
    searchOptions: { prefix: true, fuzzy: 0.15, boost: { title: 1.5 } },
  });
  index.addAll(chunks.map((chunk) => ({ id: chunk.id, text: chunk.text, title: titles.get(chunk.sourceId) ?? "" })));
  const byId = new Map(chunks.map((chunk) => [chunk.id, chunk]));
  const ranked = index.search(query).flatMap((result) => byId.get(String(result.id)) ?? []);
  const found = fill(ranked, Math.floor(budget * 0.75));
  const used = found.reduce((sum, chunk) => sum + chunk.text.length, 0);
  const chosen = new Set(found.map((chunk) => chunk.id));
  const rest = spread(chunks.filter((chunk) => !chosen.has(chunk.id)), budget - used);
  return [...found, ...rest];
}

/**
 * Chooses which passages of the selected sources to send. Everything when it
 * fits the budget; otherwise the passages that match the query, topped up
 * with an even spread so every source is represented. Passages keep reading
 * order and are numbered from 1.
 */
export function selectPassages({ sources, chunks, budget, query }: SelectOptions): Passage[] {
  const info = new Map(sources.map((source) => [source.id, source]));
  const usable = chunks.filter((chunk) => info.has(chunk.sourceId));
  const total = usable.reduce((sum, chunk) => sum + chunk.text.length, 0);
  let picked: Chunk[];
  if (total <= budget) picked = usable;
  else if (query?.trim()) {
    const titles = new Map(sources.map((source) => [source.id, source.title]));
    picked = search(usable, titles, query, budget);
  } else picked = spread(usable, budget);

  const order = new Map(usable.map((chunk, at) => [chunk.id, at]));
  picked.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  return picked.map((chunk, at) => {
    const source = info.get(chunk.sourceId)!;
    return {
      n: at + 1,
      chunkId: chunk.id,
      sourceId: chunk.sourceId,
      title: source.title,
      kind: source.kind,
      text: chunk.text,
    };
  });
}

/** The passages as the model sees them. */
export function formatPassages(passages: readonly Passage[]): string {
  if (passages.length === 0) return "<sources>\n(none)\n</sources>";
  const body = passages
    .map((passage) => `<passage n="${passage.n}" source="${passage.title.replace(/"/g, "'")}">\n${passage.text}\n</passage>`)
    .join("\n");
  return `<sources>\n${body}\n</sources>`;
}

/** What the browser keeps about each passage: enough to show and open a citation. */
export function toPassageRefs(passages: readonly Passage[]): PassageRef[] {
  return passages.map(({ text, ...rest }) => ({
    ...rest,
    snippet: text.length > 280 ? `${text.slice(0, 277).trimEnd()}…` : text,
  }));
}

const CITATION = /\[(\d{1,4}(?:\s*[,–-]\s*\d{1,4})*)\](?!\()/g;

/** The numbers inside one citation: "2, 4" → [2, 4]; "3-5" → [3, 4, 5]. */
function numbersIn(inner: string): number[] {
  const out: number[] = [];
  for (const part of inner.split(/\s*,\s*/)) {
    const range = part.split(/\s*[–-]\s*/).map(Number);
    if (range.length === 2 && range[1] >= range[0] && range[1] - range[0] < 50) {
      for (let n = range[0]; n <= range[1]; n++) out.push(n);
    } else out.push(...range.filter(Number.isFinite));
  }
  return out;
}

/** Every passage number cited in a text, in order of first use. */
export function citedNumbers(text: string): number[] {
  const seen = new Set<number>();
  for (const match of text.matchAll(CITATION)) for (const n of numbersIn(match[1])) seen.add(n);
  return [...seen];
}

/**
 * Turns "[3]" and "[2, 4]" into Markdown links to "#cite-n", so the renderer
 * can draw them as citation chips. Numbers that are not known stay as text.
 */
export function linkCitations(markdown: string, known: ReadonlySet<number>): string {
  return markdown.replace(CITATION, (whole, inner: string) => {
    const numbers = numbersIn(inner).filter((n) => known.has(n));
    return numbers.length > 0 ? numbers.map((n) => `[${n}](#cite-${n})`).join("") : whole;
  });
}

/** Removes "[n]" citations, for earlier answers whose numbers no longer match. */
export function stripCitations(text: string): string {
  return text.replace(CITATION, "").replace(/ +([.,;:!?])/g, "$1");
}
