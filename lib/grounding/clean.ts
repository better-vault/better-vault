/**
 * Removes characters that no font can draw and fixes a few that PDF
 * extraction gets wrong, so sources read cleanly and models aren't confused.
 *
 * - Private Use Area characters: pdf.js returns them for glyphs a PDF gives no
 *   text for, such as Type 3 fonts from Chromium's "Print to PDF". They show
 *   as boxes. What they stood for can't be recovered, so they are dropped.
 * - Control characters (except tab and newline), the replacement character,
 *   zero-width spaces, word joiners, byte-order marks and soft hyphens.
 *   Zero-width (non-)joiners stay: Persian, Indic scripts and emoji need them.
 * - "ˮ" and "ʼ", which such PDFs use in place of ” and ’.
 * - Latin ligatures (ﬁ, ﬂ, …) become their letters.
 */
export function cleanText(text: string): string {
  return text
    .replace(/[-\u{F0000}-\u{FFFFD}\u{100000}-\u{10FFFD}]/gu, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F​⁠﻿­�]/g, "")
    .replace(/ˮ/g, "”")
    .replace(/ʼ/g, "’")
    .replace(/[ﬀ-ﬆ]/g, (ligature) => ligature.normalize("NFKC"))
    .normalize("NFC")
    .replace(/[^\S\n]{2,}/g, " ");
}
