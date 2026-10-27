import { commonBounds } from "./geometry";
import type { ResolvedPalette } from "./palette";
import type { BoardData, BoardElement, FontKind } from "./schema";
import { describeShape } from "./shapes";
import { LINE_HEIGHT } from "./text";

/** The board as an SVG file: everything on it, with plain colours and its fonts. */

const escape = (text: string) =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const round = (value: number) => Math.round(value * 100) / 100;

export interface ExportFonts {
  /** Font family names to write in the file, per kind. */
  families: Record<FontKind, string>;
  /** @font-face rules to embed, e.g. the hand font as a data URL. */
  faces: string;
}

export const defaultFonts: ExportFonts = {
  families: {
    hand: "Excalifont, 'Segoe Print', 'Comic Sans MS', sans-serif",
    normal: "system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif",
    code: "ui-monospace, Menlo, Consolas, monospace",
  },
  faces: "",
};

function elementSvg(
  element: BoardElement,
  data: BoardData,
  palette: ResolvedPalette,
  fonts: ExportFonts,
): string {
  const { x, y, width, height } = element;
  const degrees = (element.angle * 180) / Math.PI;
  const transform = `translate(${round(x)} ${round(y)})${degrees ? ` rotate(${round(degrees)} ${round(width / 2)} ${round(height / 2)})` : ""}`;
  const opacity = element.opacity < 100 ? ` opacity="${element.opacity / 100}"` : "";
  const stroke = palette.stroke[element.stroke];
  const fill = element.fill === "none" ? "none" : palette.fill[element.fill];
  const inner: string[] = [];

  if (element.type === "text") {
    const anchor =
      element.align === "center" ? "middle" : element.align === "end" ? "end" : "start";
    const tx = element.align === "center" ? width / 2 : element.align === "end" ? width : 0;
    const lineHeight = element.fontSize * LINE_HEIGHT;
    const lines = element.text.split("\n");
    inner.push(
      `<text font-family="${escape(fonts.families[element.font])}" font-size="${round(element.fontSize)}" fill="${stroke}" text-anchor="${anchor}">${lines
        .map(
          (line, at) =>
            `<tspan x="${round(tx)}" y="${round(at * lineHeight + element.fontSize * 0.95)}" xml:space="preserve">${escape(line)}</tspan>`,
        )
        .join("")}</text>`,
    );
  } else if (element.type === "image") {
    const file = data.files[element.fileId];
    if (file)
      inner.push(
        `<image href="${file.dataUrl}" width="${round(width)}" height="${round(height)}" preserveAspectRatio="none"/>`,
      );
  } else {
    const { paths, dash } = describeShape(element);
    for (const path of paths) {
      const style =
        path.role === "fill"
          ? `fill="${fill}" stroke="none"`
          : path.role === "ink"
            ? `fill="${stroke}" stroke="none"`
            : path.role === "hachure"
              ? `fill="none" stroke="${fill}" stroke-width="${round(path.width ?? element.strokeWidth / 2)}"`
              : `fill="none" stroke="${stroke}" stroke-width="${element.strokeWidth}"${dash ? ` stroke-dasharray="${dash}"` : ""}`;
      inner.push(`<path d="${path.d}" ${style} stroke-linecap="round" stroke-linejoin="round"/>`);
    }
  }
  return `<g transform="${transform}"${opacity}>${inner.join("")}</g>`;
}

/** The whole board as a standalone SVG, framed around its content with a margin. */
export function boardSvg(
  data: BoardData,
  palette: ResolvedPalette,
  fonts: ExportFonts = defaultFonts,
  padding = 24,
): { svg: string; width: number; height: number } {
  const box = commonBounds(data.elements) ?? { minX: 0, minY: 0, maxX: 400, maxY: 300 };
  const width = Math.ceil(box.maxX - box.minX + padding * 2);
  const height = Math.ceil(box.maxY - box.minY + padding * 2);
  const style = fonts.faces ? `<style>${fonts.faces}</style>` : "";
  const body = data.elements.map((element) => elementSvg(element, data, palette, fonts)).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${round(box.minX - padding)} ${round(box.minY - padding)} ${width} ${height}">${style}<rect x="${round(box.minX - padding)}" y="${round(box.minY - padding)}" width="${width}" height="${height}" fill="${palette.background}"/>${body}</svg>`;
  return { svg, width, height };
}
