import { store } from "@/lib/db/store";
import { useStoreQuery } from "@/lib/db/live";

/**
 * A font the user uploaded for the whole app. It is kept with the settings
 * on this device (never sent anywhere) and loaded with the FontFace API from
 * its bytes, so no URL is involved and the Content-Security-Policy is unchanged.
 */
export interface AppFont {
  /** The file's name, shown in Appearance. */
  name: string;
  /** The font file, base64. */
  data: string;
}

const FONT_KEY = "app-font";
/** The family the uploaded font is registered under. */
export const APP_FONT_FAMILY = "Better Vault Custom";
export const MAX_FONT_BYTES = 10 * 1024 * 1024;
export const fontAccept = ".woff2,.woff,.ttf,.otf";

async function getAppFont(): Promise<AppFont | null> {
  const saved = (await store().getSetting(FONT_KEY)) as AppFont | null | undefined;
  return saved && typeof saved.data === "string" ? saved : null;
}

/** The uploaded font, live; `null` when there is none, `undefined` while loading. */
export function useAppFont(): AppFont | null | undefined {
  return useStoreQuery(getAppFont, [], ["settings"]);
}

function toBase64(bytes: Uint8Array) {
  let binary = "";
  for (let at = 0; at < bytes.length; at += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(at, at + 0x8000));
  }
  return btoa(binary);
}

function fromBase64(text: string): ArrayBuffer {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let at = 0; at < binary.length; at += 1) bytes[at] = binary.charCodeAt(at);
  return bytes.buffer;
}

export class FontError extends Error {
  constructor(readonly reason: "too-big" | "unreadable") {
    super(reason);
  }
}

/** Checks that the file is a font the browser can draw, then keeps it. */
export async function saveAppFont(file: File): Promise<void> {
  if (file.size > MAX_FONT_BYTES) throw new FontError("too-big");
  const buffer = await file.arrayBuffer();
  try {
    await new FontFace(`${APP_FONT_FAMILY} check`, buffer).load();
  } catch {
    throw new FontError("unreadable");
  }
  await store().putSetting(FONT_KEY, {
    name: file.name,
    data: toBase64(new Uint8Array(buffer)),
  } satisfies AppFont);
}

/** Goes back to the app's own font. */
export async function removeAppFont(): Promise<void> {
  await store().putSetting(FONT_KEY, null);
}

let loaded: { data: string; face: FontFace } | null = null;

/** Registers the font with the page and points the app's sans-serif at it; `null` undoes both. */
export async function applyAppFont(font: AppFont | null): Promise<void> {
  const root = document.documentElement;
  if (loaded && loaded.data !== font?.data) {
    document.fonts.delete(loaded.face);
    loaded = null;
  }
  if (!font) {
    root.style.removeProperty("--font-geist-sans");
    return;
  }
  if (!loaded) {
    const face = new FontFace(APP_FONT_FAMILY, fromBase64(font.data));
    await face.load();
    document.fonts.add(face);
    loaded = { data: font.data, face };
  }
  root.style.setProperty("--font-geist-sans", `"${APP_FONT_FAMILY}", "Geist Variable"`);
}
