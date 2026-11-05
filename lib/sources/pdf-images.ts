import { normaliseText } from "@/lib/grounding/chunk";
import type { NewSourceImage } from "@/lib/db/sources";

/** Pictures smaller than this (icons, bullets, rules) are left out. */
const MIN_SIDE = 48;
/** At most this many pictures per file. */
const MAX_IMAGES = 80;
/** Pictures are scaled down to this many pixels on their longer side. */
const MAX_SIDE = 1600;
/** How much of the end of a page's text marks where its pictures go. */
const ANCHOR = 60;

interface PageImage {
  page: number;
  image: ImageData;
}

/** Turns pdf.js's raw pixels (grey, RGB or RGBA) into ImageData. */
function toImageData(data: Uint8ClampedArray, width: number, height: number, channels: number) {
  if (channels === 4) return new ImageData(new Uint8ClampedArray(data), width, height);
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let pixel = 0, from = 0; pixel < width * height; pixel++, from += channels) {
    const to = pixel * 4;
    rgba[to] = data[from];
    rgba[to + 1] = data[channels === 1 ? from : from + 1];
    rgba[to + 2] = data[channels === 1 ? from : from + 2];
    rgba[to + 3] = 255;
  }
  return new ImageData(rgba, width, height);
}

/** A picture as a WebP file, no larger than MAX_SIDE. */
async function encode(
  image: ImageData,
): Promise<{ data: Uint8Array; width: number; height: number }> {
  const scale = Math.min(1, MAX_SIDE / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const full = new OffscreenCanvas(image.width, image.height);
  full.getContext("2d")!.putImageData(image, 0, 0);
  const canvas = new OffscreenCanvas(width, height);
  canvas.getContext("2d")!.drawImage(full, 0, 0, width, height);
  const blob = await canvas.convertToBlob({ type: "image/webp", quality: 0.85 });
  return { data: new Uint8Array(await blob.arrayBuffer()), width, height };
}

/**
 * The pictures in a PDF, each placed at the end of its page's text in the
 * source's (normalised) text. Failures are not fatal: the source is kept
 * without pictures.
 */
export async function pdfImages(file: Blob, text: string): Promise<NewSourceImage[]> {
  if (typeof OffscreenCanvas === "undefined") return [];
  const { getDocumentProxy, extractImages, extractText } = await import("unpdf");
  // In a browser pdf.js would hand pictures over as bitmaps; these ask it for their pixels.
  const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()), {
    isOffscreenCanvasSupported: false,
    isImageDecoderSupported: false,
  });
  const { text: pages } = await extractText(pdf, { mergePages: false });

  const found: PageImage[] = [];
  for (let page = 1; page <= pdf.numPages && found.length < MAX_IMAGES; page++) {
    let images;
    try {
      images = await extractImages(pdf, page);
    } catch {
      continue;
    }
    for (const image of images) {
      if (image.width < MIN_SIDE || image.height < MIN_SIDE) continue;
      found.push({
        page,
        image: toImageData(image.data, image.width, image.height, image.channels),
      });
      if (found.length >= MAX_IMAGES) break;
    }
  }
  if (found.length === 0) return [];

  // Where each page's text ends in the stored text.
  const ends: number[] = [];
  let from = 0;
  for (let index = 0; index < pdf.numPages; index++) {
    const anchor = normaliseText(pages[index] ?? "").slice(-ANCHOR);
    const at = anchor ? text.indexOf(anchor, from) : -1;
    const end =
      at >= 0
        ? at + anchor.length
        : Math.max(from, Math.round((text.length * (index + 1)) / pdf.numPages));
    ends.push(Math.min(end, text.length));
    from = ends[index];
  }

  const out: NewSourceImage[] = [];
  for (const { page, image } of found) {
    try {
      const encoded = await encode(image);
      out.push({ mime: "image/webp", ...encoded, at: ends[page - 1] ?? text.length });
    } catch {
      // A picture that can't be drawn is left out.
    }
  }
  return out;
}
