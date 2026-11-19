import { htmlToText, pdfToText } from "@/lib/sources/extract";
import { formatOfFile, type SourceFormat, type SourceKind } from "@/lib/sources/formats";
import { fetchPublic } from "@/lib/sources/network";
import { fetchYouTubeTranscript, youTubeId, youTubeWatchUrl } from "@/lib/sources/youtube";

/** A page or video read as a source's text, ready to be saved. */
export interface ReadSource {
  title: string;
  text: string;
  kind: SourceKind;
  format: SourceFormat;
  url: string;
}

/**
 * Reads an address as a source: a YouTube video's transcript, an online
 * PDF, a web page's main text or a text file. Runs on the server (the API
 * route) and in the desktop app's main process (MCP). Throws `YouTubeError`
 * for videos without a transcript.
 */
export async function readUrl(address: string): Promise<ReadSource> {
  const video = youTubeId(address);
  if (video) {
    const { title, text } = await fetchYouTubeTranscript(video);
    return { title, text, kind: "youtube", format: "youtube", url: youTubeWatchUrl(video) };
  }

  const page = await fetchPublic(address);
  const fallbackTitle = page.url.hostname + page.url.pathname.replace(/\/$/, "");
  const url = page.url.toString();

  if (page.contentType.includes("application/pdf"))
    return {
      title: fallbackTitle,
      text: await pdfToText(page.body),
      kind: "pdf",
      format: "pdf",
      url,
    };
  const raw = new TextDecoder().decode(page.body);
  if (page.contentType.includes("text/html") || /^\s*<(!doctype|html)/i.test(raw)) {
    const { title, text } = htmlToText(raw, fallbackTitle);
    return { title, text, kind: "url", format: "web", url };
  }
  if (page.contentType.startsWith("text/") || page.contentType.includes("json")) {
    const format = formatOfFile(page.url.pathname, page.contentType) ?? "web";
    return { title: fallbackTitle, text: raw, kind: "url", format, url };
  }
  throw new Error("That page is not text, HTML or PDF.");
}
