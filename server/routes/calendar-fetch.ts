import { z } from "zod";
import { describeError } from "@/lib/ai/errors";
import { fetchPublic } from "@/lib/sources/network";

const body = z.object({ url: z.url() });

/** Unfolds the file's own name (`X-WR-CALNAME`), if it gives one. */
function calendarName(text: string): string {
  const match = text.replace(/\r?\n[ \t]/g, "").match(/^X-WR-CALNAME(?:;[^:]*)?:(.*)$/im);
  return match ? match[1].trim().replace(/\\([,;\\])/g, "$1") : "";
}

/**
 * Fetches a public .ics calendar for "Subscribe to a calendar". The browser
 * parses it; nothing is stored on the server.
 */
export async function POST(request: Request) {
  try {
    const parsed = body.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: "Enter a valid address." }, { status: 400 });
    const url = parsed.data.url.replace(/^webcals?:\/\//i, "https://");
    const page = await fetchPublic(url, { maxBytes: 5 * 1024 * 1024 });
    const text = new TextDecoder().decode(page.body);
    if (!/BEGIN:VCALENDAR/i.test(text)) {
      return Response.json({ error: "That address is not an .ics calendar." }, { status: 415 });
    }
    return Response.json({ text, name: calendarName(text) });
  } catch (error) {
    return Response.json({ error: describeError(error) }, { status: 422 });
  }
}
