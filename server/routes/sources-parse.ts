import { z } from "zod";
import { describeError } from "@/lib/ai/errors";
import { htmlToText, pdfToText } from "@/lib/sources/extract";
import { fetchPublic } from "@/lib/sources/network";

const MAX_FILE_BYTES = 20 * 1024 * 1024;

const urlBody = z.object({ url: z.url() });

const titleFromFile = (name: string) => name.replace(/\.[^.]+$/, "") || name;

/**
 * Turns a PDF upload (multipart, field "file") or a web address (JSON
 * `{ url }`) into plain text. Nothing is stored on the server.
 */
export async function POST(request: Request) {
  try {
    const type = request.headers.get("content-type") ?? "";

    if (type.startsWith("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File)) return Response.json({ error: "No file was sent." }, { status: 400 });
      if (file.size > MAX_FILE_BYTES) return Response.json({ error: "The file is larger than 20 MB." }, { status: 413 });
      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      if (!isPdf) return Response.json({ error: "Only PDF files are read on the server." }, { status: 415 });
      const text = await pdfToText(new Uint8Array(await file.arrayBuffer()));
      return Response.json({ title: titleFromFile(file.name), text, kind: "pdf" });
    }

    const parsed = urlBody.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: "Enter a valid address." }, { status: 400 });
    const page = await fetchPublic(parsed.data.url);
    const fallbackTitle = page.url.hostname + page.url.pathname.replace(/\/$/, "");

    if (page.contentType.includes("application/pdf")) {
      const text = await pdfToText(page.body);
      return Response.json({ title: fallbackTitle, text, kind: "pdf", url: page.url.toString() });
    }
    const raw = new TextDecoder().decode(page.body);
    if (page.contentType.includes("text/html") || /^\s*<(!doctype|html)/i.test(raw)) {
      const { title, text } = htmlToText(raw, fallbackTitle);
      return Response.json({ title, text, kind: "url", url: page.url.toString() });
    }
    if (page.contentType.startsWith("text/")) {
      return Response.json({ title: fallbackTitle, text: raw, kind: "url", url: page.url.toString() });
    }
    return Response.json({ error: "That page is not text, HTML or PDF." }, { status: 415 });
  } catch (error) {
    return Response.json({ error: describeError(error) }, { status: 422 });
  }
}
