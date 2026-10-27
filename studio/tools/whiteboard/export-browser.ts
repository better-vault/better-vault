import { resolveCssColor, withLightScope } from "@/lib/colors/resolve";
import { defaultFonts, type ExportFonts } from "./export";
import { fillCss, strokeCss, type ResolvedPalette } from "./palette";
import { boardColors, type BoardData } from "./schema";

/** The board's colours in the light theme, as plain values for files. */
export function resolveBoardPalette(): ResolvedPalette {
  return withLightScope((scope) => {
    const stroke = Object.fromEntries(
      boardColors.map((color) => [color, resolveCssColor(strokeCss(color), scope)]),
    );
    const fill = Object.fromEntries(
      boardColors.map((color) => [color, resolveCssColor(fillCss(color), scope)]),
    );
    return {
      stroke: stroke as ResolvedPalette["stroke"],
      fill: fill as ResolvedPalette["fill"],
      background: resolveCssColor("var(--background)", scope),
    };
  });
}

/** Fonts for an exported board: the hand font is embedded when the board uses it. */
export async function exportFonts(data: BoardData): Promise<ExportFonts> {
  const hand = data.elements.some((element) => element.type === "text" && element.font === "hand");
  if (!hand) return defaultFonts;
  try {
    const response = await fetch("/fonts/excalifont/excalifont-latin.woff2");
    const bytes = new Uint8Array(await response.arrayBuffer());
    let binary = "";
    for (let at = 0; at < bytes.length; at += 0x8000)
      binary += String.fromCharCode(...bytes.subarray(at, at + 0x8000));
    return {
      ...defaultFonts,
      faces: `@font-face{font-family:"Excalifont";src:url(data:font/woff2;base64,${btoa(binary)}) format("woff2");}`,
    };
  } catch {
    return defaultFonts;
  }
}
