import type { Extracted } from "@/lib/sources/extract";

/**
 * YouTube videos as sources, the way NotebookLM takes them: only the
 * transcript is imported, from the video's captions (written by the uploader
 * or made automatically), so a video needs to be public and to have captions.
 * The text keeps a [mm:ss] mark at the start of each paragraph, so citations
 * point at a moment in the video and the reader can start the player there.
 *
 * Runs on the server (the page's CSP doesn't allow YouTube). Only youtube.com
 * is ever fetched, whatever address was given.
 */

const HOST = "https://www.youtube.com";
const TIMEOUT_MS = 15_000;
const MAX_BYTES = 5 * 1024 * 1024;
/** Paragraphs of the transcript are cut at about this many seconds. */
const PARAGRAPH_SECONDS = 45;

/** YouTube's Android app: its player answer lists caption files that can be read without a browser. */
const CLIENT = {
  clientName: "ANDROID",
  clientVersion: "20.10.38",
  androidSdkVersion: 30,
  hl: "en",
};
const USER_AGENT = "com.google.android.youtube/20.10.38 (Linux; U; Android 11) gzip";

export type YouTubeFailure = "private" | "unavailable" | "no-captions";

export class YouTubeError extends Error {
  constructor(readonly reason: YouTubeFailure) {
    super(
      reason === "no-captions"
        ? "This video has no captions, so there is no transcript to add."
        : reason === "private"
          ? "This video is private or restricted. Only public videos can be added."
          : "This video is not available.",
    );
    this.name = "YouTubeError";
  }
}

/** The video id in a YouTube address (watch, youtu.be, shorts, embed, live), or null. */
export function youTubeId(address: string): string | null {
  let url: URL;
  try {
    url = new URL(address.trim());
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www\.|m\.|music\.)/, "");
  const valid = (id: string | null | undefined) => (id && /^[\w-]{11}$/.test(id) ? id : null);
  if (host === "youtu.be") return valid(url.pathname.slice(1).split("/")[0]);
  if (host !== "youtube.com" && host !== "youtube-nocookie.com") return null;
  if (url.pathname === "/watch") return valid(url.searchParams.get("v"));
  const match = /^\/(?:shorts|embed|live|v)\/([\w-]{11})/.exec(url.pathname);
  return valid(match?.[1]);
}

/** The address of a video, as it is saved with the source. */
export const youTubeWatchUrl = (id: string) => `${HOST}/watch?v=${id}`;

/** "[1:02:03]" or "[4:05]" for a number of seconds. */
export function timestamp(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const rest = String(s % 60).padStart(2, "0");
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, "0")}:${rest}` : `${minutes}:${rest}`;
}

/** The seconds in a "[mm:ss]" or "[h:mm:ss]" mark, or null. */
export function secondsOf(mark: string): number | null {
  const match = /^\[?(?:(\d+):)?(\d{1,2}):(\d{2})\]?$/.exec(mark.trim());
  if (!match) return null;
  return Number(match[1] ?? 0) * 3600 + Number(match[2]) * 60 + Number(match[3]);
}

async function get(url: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(url, {
    ...init,
    redirect: "error",
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { "user-agent": USER_AGENT, ...init?.headers },
  });
  const length = Number(response.headers.get("content-length") ?? 0);
  if (length > MAX_BYTES) throw new Error("YouTube's answer was too large.");
  return response;
}

interface CaptionTrack {
  baseUrl: string;
  languageCode: string;
  kind?: string;
  name?: { runs?: { text: string }[]; simpleText?: string };
}

interface PlayerAnswer {
  playabilityStatus?: { status?: string; reason?: string };
  videoDetails?: { title?: string; author?: string; lengthSeconds?: string; isPrivate?: boolean };
  captions?: { playerCaptionsTracklistRenderer?: { captionTracks?: CaptionTrack[] } };
}

/**
 * The track to read: the uploader's own captions in the language spoken in
 * the video (the automatic track's language), then any of the uploader's,
 * then the automatic ones.
 */
export function pickTrack(tracks: readonly CaptionTrack[]): CaptionTrack | undefined {
  const automatic = tracks.find((track) => track.kind === "asr");
  const written = tracks.filter((track) => track.kind !== "asr");
  return (
    written.find((track) => automatic && track.languageCode === automatic.languageCode) ??
    written[0] ??
    automatic
  );
}

function decode(text: string): string {
  return text
    .replace(/<[^>]+>/g, "")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

export interface Cue {
  /** Start, in seconds. */
  start: number;
  text: string;
}

/** The cues of a caption file: YouTube's timed text (format 3, `<p t="ms">`) or its older `<text start="s">`. */
export function parseCaptions(xml: string): Cue[] {
  const cues: Cue[] = [];
  for (const [, attrs, inner] of xml.matchAll(/<p\b([^>]*)>([\s\S]*?)<\/p>/g)) {
    const t = /\bt="(\d+)"/.exec(attrs)?.[1];
    if (t !== undefined) cues.push({ start: Number(t) / 1000, text: decode(inner) });
  }
  if (cues.length === 0) {
    for (const [, attrs, inner] of xml.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)) {
      const start = /\bstart="([\d.]+)"/.exec(attrs)?.[1];
      if (start !== undefined) cues.push({ start: Number(start), text: decode(decode(inner)) });
    }
  }
  return cues
    .map((cue) => ({ ...cue, text: cue.text.replace(/\s+/g, " ").trim() }))
    .filter((cue) => cue.text !== "");
}

/** Cues joined into paragraphs of about 45 seconds, each starting with its time. */
export function transcriptText(cues: readonly Cue[]): string {
  const paragraphs: string[] = [];
  let start = -1;
  let words: string[] = [];
  const flush = () => {
    if (words.length > 0) paragraphs.push(`[${timestamp(start)}] ${words.join(" ")}`);
    words = [];
  };
  for (const cue of cues) {
    const ends = /[.!?…]["')\]]?$/.test(words.at(-1) ?? "");
    if (words.length > 0 && cue.start - start >= PARAGRAPH_SECONDS && ends) flush();
    // Without punctuation (automatic captions), cut a little later anyway.
    if (words.length > 0 && cue.start - start >= PARAGRAPH_SECONDS * 1.5) flush();
    if (words.length === 0) start = cue.start;
    words.push(cue.text);
  }
  flush();
  return paragraphs.join("\n\n");
}

/** A public video's title and transcript. */
export async function fetchYouTubeTranscript(id: string): Promise<Extracted & { author?: string }> {
  const response = await get(`${HOST}/youtubei/v1/player?prettyPrint=false`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ context: { client: CLIENT }, videoId: id }),
  });
  if (!response.ok) throw new Error(`YouTube answered ${response.status}.`);
  const player = (await response.json()) as PlayerAnswer;
  const status = player.playabilityStatus?.status;
  if (status === "LOGIN_REQUIRED" || player.videoDetails?.isPrivate)
    throw new YouTubeError("private");
  if (status && status !== "OK" && !player.videoDetails) throw new YouTubeError("unavailable");

  const track = pickTrack(player.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? []);
  if (!track) throw new YouTubeError("no-captions");
  const captionUrl = new URL(track.baseUrl, HOST);
  if (captionUrl.hostname !== "www.youtube.com") throw new Error("Unexpected caption address.");
  const captions = await get(captionUrl.toString());
  if (!captions.ok) throw new Error(`YouTube answered ${captions.status} for the captions.`);
  const xml = await captions.text();
  if (xml.length > MAX_BYTES) throw new Error("The captions are too long.");
  const text = transcriptText(parseCaptions(xml));
  if (!text) throw new YouTubeError("no-captions");

  const title = player.videoDetails?.title?.trim() || `YouTube video ${id}`;
  const author = player.videoDetails?.author?.trim();
  return { title, text, author };
}
