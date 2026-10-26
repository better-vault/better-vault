import { cleanText } from "./clean";

/** Passages aim for about this many characters. */
export const CHUNK_SIZE = 1200;

/** Cleans the text, normalises line endings and collapses runs of blank lines and spaces. */
export function normaliseText(text: string): string {
  return cleanText(text.replace(/\r\n?/g, "\n"))
    .replace(/[\t\f\v ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Splits text that is too long for one passage at sentence ends, then at spaces. */
function splitLong(piece: string, size: number): string[] {
  if (piece.length <= size) return [piece];
  const sentences = piece.match(/[^.!?。！？]+[.!?。！？]+["')\]]*\s*|[^.!?。！？]+$/g) ?? [piece];
  const out: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    if (sentence.length > size) {
      if (current) out.push(current.trim());
      current = "";
      for (let at = 0; at < sentence.length; at += size) {
        out.push(sentence.slice(at, at + size).trim());
      }
      continue;
    }
    if (current.length + sentence.length > size && current) {
      out.push(current.trim());
      current = "";
    }
    current += sentence;
  }
  if (current.trim()) out.push(current.trim());
  return out;
}

/**
 * Splits text into passages of about `size` characters, keeping paragraphs
 * together where they fit, so a citation points at a readable piece.
 */
export function chunkText(text: string, size = CHUNK_SIZE): string[] {
  const clean = normaliseText(text);
  if (!clean) return [];
  const paragraphs = clean.split(/\n\n/).flatMap((p) => splitLong(p, size));
  const chunks: string[] = [];
  let current = "";
  for (const paragraph of paragraphs) {
    if (current && current.length + paragraph.length + 2 > size) {
      chunks.push(current);
      current = "";
    }
    current = current ? `${current}\n\n${paragraph}` : paragraph;
  }
  if (current) chunks.push(current);
  return chunks;
}
