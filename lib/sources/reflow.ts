/**
 * Joins the lines of extracted text back into paragraphs, for reading. PDFs
 * break a line wherever the page did, so a sentence often runs over several
 * lines. Only the display changes; the stored text and its passages don't.
 */

export interface Block {
  kind: "paragraph" | "item" | "heading";
  text: string;
}

const BULLET = /^(?:[•●◦▪■□‣⁃∙·*–—-]|\(?\d{1,3}[.)]|\(?[a-z][.)])\s+/i;
/** A line that ends a sentence, or a label, rather than wrapping. */
const ENDS = /[.!?:;。！？]["'”’)\]]*$/;
/** A line that wrapped mid-phrase: after it the sentence goes on. */
const CARRIES =
  /[,&(\-–/+]$|\b(?:a|an|the|and|or|of|to|in|on|for|with|by|from|as|at|is|are|that|which)$/i;
/** Lines this long were most likely wrapped by the page's width. */
const WRAPPED = 48;

function continues(previous: string, line: string): boolean {
  if (BULLET.test(line)) return false;
  if (ENDS.test(previous)) return false;
  if (/^[a-z(“"'‘]/.test(line)) return true;
  return CARRIES.test(previous) || previous.length >= WRAPPED;
}

function join(previous: string, line: string): string {
  // A word split by a hyphen at the end of a line is put back together.
  if (/[a-z]-$/i.test(previous) && /^[a-z]/.test(line)) return previous.slice(0, -1) + line;
  return `${previous} ${line}`;
}

export function reflow(text: string): Block[] {
  const blocks: Block[] = [];
  let current: Block | null = null;
  let lastLine = "";
  const close = () => {
    if (current) blocks.push(current);
    current = null;
  };

  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) {
      close();
      lastLine = "";
      continue;
    }
    if (current && continues(lastLine, line)) {
      current.text = join(current.text, line);
      if (current.kind === "heading") current.kind = "paragraph";
    } else {
      close();
      const bullet = BULLET.exec(line);
      current = bullet
        ? { kind: "item", text: line.slice(bullet[0].length) }
        : { kind: line.length < WRAPPED && !ENDS.test(line) ? "heading" : "paragraph", text: line };
    }
    lastLine = line;
  }
  close();
  return blocks;
}
