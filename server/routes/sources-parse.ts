import { z } from "zod";
import { describeError } from "@/lib/ai/errors";
import { htmlToText, pdfToText } from "@/lib/sources/extract";
import {
  formatOfFile,
  serverFormats,
  type SourceFormat,
  type SourceKind,
} from "@/lib/sources/formats";
import { fetchPublic } from "@/lib/sources/network";
import { docxToText, epubToText, pptxToText, xlsxToText } from "@/lib/sources/office";
import {
  fetchYouTubeTranscript,
  YouTubeError,
  youTubeId,
  youTubeWatchUrl,
} from "@/lib/sources/youtube";

const MAX_FILE_BYTES = 20 * 1024 * 1024;

const urlBody = z.object({ url: z.url() });

const titleFromFile = (name: string) => name.replace(/\.[^.]+$/, "") || name;

interface Parsed {
  title: string;
  text: string;
  kind: SourceKind;
  format: SourceFormat;
  url?: string;
}

/** The text of an uploaded file the browser can't read itself. */
async function readFile(file: File, format: SourceFormat): Promise<Parsed> {
  const data = new Uint8Array(await file.arrayBuffer());
  const title = titleFromFile(file.name);
  switch (format) {
    case "pdf":
      return { title, text: await pdfToText(data), kind: "pdf", format };
    case "html": {
      const page = htmlToText(new TextDecoder().decode(data), title);
      return { title: page.title, text: page.text, kind: "text", format };
    }
    case "docx":
      return { title, text: docxToText(data), kind: "text", format };
    case "xlsx":
      return { title, text: xlsxToText(data), kind: "text", format };
    case "pptx":
      return { title, text: pptxToText(data), kind: "text", format };
    case "epub": {
      const book = epubToText(data);
      return { title: book.title || title, text: book.text, kind: "text", format };
    }
    default:
      throw new Error("This file is read in the browser.");
  }
}

/**
 * Turns an upload (multipart, field "file": PDF, HTML, Word, Excel,
 * PowerPoint or EPUB) or an address (JSON `{ url }`: a web page, an online
 * PDF or a YouTube video) into plain text. Nothing is stored on the server.
 */
export async function POST(request: Request) {
  try {
    const type = request.headers.get("content-type") ?? "";

    if (type.startsWith("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File))
        return Response.json({ error: "No file was sent." }, { status: 400 });
      if (file.size > MAX_FILE_BYTES)
        return Response.json({ error: "The file is larger than 20 MB." }, { status: 413 });
      const format = formatOfFile(file.name, file.type);
      if (!format || !serverFormats.has(format))
        return Response.json({ error: "This kind of file can't be read." }, { status: 415 });
      return Response.json(await readFile(file, format));
    }

    const parsed = urlBody.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: "Enter a valid address." }, { status: 400 });

    const video = youTubeId(parsed.data.url);
    if (video) {
      try {
        const { title, text } = await fetchYouTubeTranscript(video);
        return Response.json({
          title,
          text,
          kind: "youtube",
          format: "youtube",
          url: youTubeWatchUrl(video),
        } satisfies Parsed);
      } catch (error) {
        if (error instanceof YouTubeError)
          return Response.json({ error: error.message, reason: error.reason }, { status: 422 });
        throw error;
      }
    }

    const page = await fetchPublic(parsed.data.url);
    const fallbackTitle = page.url.hostname + page.url.pathname.replace(/\/$/, "");
    const url = page.url.toString();

    if (page.contentType.includes("application/pdf")) {
      const text = await pdfToText(page.body);
      return Response.json({
        title: fallbackTitle,
        text,
        kind: "pdf",
        format: "pdf",
        url,
      } satisfies Parsed);
    }
    const raw = new TextDecoder().decode(page.body);
    if (page.contentType.includes("text/html") || /^\s*<(!doctype|html)/i.test(raw)) {
      const { title, text } = htmlToText(raw, fallbackTitle);
      return Response.json({ title, text, kind: "url", format: "web", url } satisfies Parsed);
    }
    if (page.contentType.startsWith("text/") || page.contentType.includes("json")) {
      const format = formatOfFile(page.url.pathname, page.contentType) ?? "web";
      return Response.json({
        title: fallbackTitle,
        text: raw,
        kind: "url",
        format,
        url,
      } satisfies Parsed);
    }
    return Response.json({ error: "That page is not text, HTML or PDF." }, { status: 415 });
  } catch (error) {
    return Response.json({ error: describeError(error) }, { status: 422 });
  }
}
