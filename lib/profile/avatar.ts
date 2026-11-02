/** The size an avatar is stored at, in pixels. Shown at most at 96. */
const SIZE = 256;
/** Pictures larger than this are refused before they are read. */
export const MAX_AVATAR_BYTES = 15 * 1024 * 1024;

/**
 * Crops a picture to its centre square and shrinks it to 256 pixels, as a
 * WebP data URL small enough to keep with the settings.
 */
export async function avatarFromFile(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("not-an-image");
  if (file.size > MAX_AVATAR_BYTES) throw new Error("too-large");
  const bitmap = await createImageBitmap(file);
  try {
    const side = Math.min(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = Math.min(SIZE, side);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("no-canvas");
    context.imageSmoothingQuality = "high";
    context.drawImage(
      bitmap,
      (bitmap.width - side) / 2,
      (bitmap.height - side) / 2,
      side,
      side,
      0,
      0,
      canvas.width,
      canvas.height,
    );
    return canvas.toDataURL("image/webp", 0.86);
  } finally {
    bitmap.close();
  }
}
