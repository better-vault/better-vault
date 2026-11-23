import { formatOfFile, type SourceFormat } from "@/lib/sources/formats";

/**
 * What a file on the Vault page is, for its badge: one of the source formats,
 * or a kind no source can be (pictures, sound, video, archives).
 */
export type FileKind = SourceFormat | "image" | "audio" | "video" | "archive" | "other";

export function fileKindOf(name: string, mime = ""): FileKind {
  const format = formatOfFile(name, mime);
  if (format) return format;
  if (mime.startsWith("image/") || /\.(png|jpe?g|gif|webp|avif|heic|bmp|tiff?)$/i.test(name))
    return "image";
  if (mime.startsWith("audio/") || /\.(mp3|wav|m4a|aac|ogg|flac|opus)$/i.test(name)) return "audio";
  if (mime.startsWith("video/") || /\.(mp4|mov|webm|mkv|avi)$/i.test(name)) return "video";
  if (/zip|compressed|tar|gzip/.test(mime) || /\.(zip|rar|7z|tar|gz|tgz)$/i.test(name))
    return "archive";
  return "other";
}

/** The most common kinds first, at most `limit` of them. */
export function topKinds(kinds: FileKind[], limit = 2): FileKind[] {
  const counts = new Map<FileKind, number>();
  for (const kind of kinds) counts.set(kind, (counts.get(kind) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([kind]) => kind);
}
