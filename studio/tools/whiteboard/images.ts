import { newId, newSeed } from "./scene";
import { emptyBoard, type BoardData, type BoardFile } from "./schema";

/** Pictures on the board: made small enough to store, as WebP data URLs. */

const RASTER = /^image\/(png|jpeg|webp|gif|avif|bmp)$/;

/** Reads a picture file, scales it down to `maxEdge` and encodes it as WebP. SVG and non-pictures are refused. */
export async function prepareImage(blob: Blob, maxEdge = 2048): Promise<BoardFile> {
  if (!RASTER.test(blob.type)) throw new Error("unsupported-image");
  const bitmap = await createImageBitmap(blob);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("unsupported-image");
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const encoded = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error("unsupported-image"))),
      "image/webp",
      0.9,
    ),
  );
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("unsupported-image"));
    reader.readAsDataURL(encoded);
  });
  return { dataUrl, mimeType: encoded.type || "image/webp", width, height };
}

/** The world size a picture is placed at: at most 800 wide or tall, keeping its proportions. */
export function placedSize(file: Pick<BoardFile, "width" | "height">, max = 800) {
  const scale = Math.min(1, max / Math.max(file.width, file.height));
  return { width: Math.round(file.width * scale), height: Math.round(file.height * scale) };
}

/** A new board holding one picture, locked, to draw over it ("Annotate"). */
export function boardFromImage(
  file: BoardFile,
  origin: { outputId: string; toolId: string },
): BoardData {
  const fileId = newId();
  const { width, height } = file.width > 2400 || file.height > 2400 ? placedSize(file, 2400) : file;
  return {
    ...emptyBoard(),
    files: { [fileId]: file },
    origin,
    elements: [
      {
        type: "image",
        id: newId(),
        fileId,
        x: 0,
        y: 0,
        width,
        height,
        angle: 0,
        stroke: "ink",
        fill: "none",
        fillStyle: "hachure",
        strokeWidth: 2,
        strokeStyle: "solid",
        roughness: 1,
        edges: "round",
        opacity: 100,
        seed: newSeed(),
        groupIds: [],
        locked: true,
      },
    ],
  };
}
