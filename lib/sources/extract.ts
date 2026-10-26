import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import { extractText, getDocumentProxy } from "unpdf";
import { cleanText } from "@/lib/grounding/clean";

export interface Extracted {
  title: string;
  text: string;
}

/**
 * Removes reference markers such as "[12]", "[a]" or "[citation needed]". They
 * would be confused with the "[n]" citations the model writes.
 */
export function stripReferenceMarkers(text: string): string {
  return text.replace(
    /\[(?:\d{1,4}|[a-z]|[a-z]?\s?\d{1,4}|[^\]\n]{0,40}\bneeded|need [^\]\n]{0,30})\]/gi,
    "",
  );
}

/** The readable text of a web page, without menus, ads and footers. */
export function htmlToText(html: string, fallbackTitle: string): Extracted {
  const { document } = parseHTML(html);
  const article = new Readability(document as unknown as Document).parse();
  if (article?.textContent?.trim()) {
    return {
      title: article.title?.trim() || fallbackTitle,
      text: stripReferenceMarkers(article.textContent),
    };
  }
  // Readability found no article: keep the body's text.
  for (const node of document.querySelectorAll("script, style, noscript, nav, footer, header"))
    node.remove();
  const title = document.querySelector("title")?.textContent?.trim();
  return {
    title: title || fallbackTitle,
    text: stripReferenceMarkers(document.body?.textContent ?? ""),
  };
}

/** The text of every page of a PDF. */
export async function pdfToText(data: Uint8Array): Promise<string> {
  const pdf = await getDocumentProxy(data);
  const { text } = await extractText(pdf, { mergePages: true });
  return cleanText(text);
}
