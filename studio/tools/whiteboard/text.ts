import type { FontKind } from "./schema";

/** Text on the board: fonts, line height and measuring. */

export const LINE_HEIGHT = 1.25;

/** The CSS font family for a kind of text. */
export const fontFamily: Record<FontKind, string> = {
  hand: "var(--font-hand)",
  normal: "var(--font-sans)",
  code: "var(--font-mono)",
};

let context: CanvasRenderingContext2D | null = null;

/** The family names behind the CSS variables, for canvas measuring and exports. */
export function resolvedFamily(font: FontKind): string {
  if (typeof document === "undefined") return "sans-serif";
  const token = { hand: "--font-hand", normal: "--font-sans", code: "--font-mono" }[font];
  const value = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  // Tailwind's theme tokens may themselves be variables: resolve one level.
  return (
    value.replace(/var\((--[\w-]+)\)/g, (_, name: string) =>
      getComputedStyle(document.documentElement).getPropertyValue(name).trim(),
    ) || "sans-serif"
  );
}

/** The size of a text block, in world units. */
export function measureText(
  text: string,
  font: FontKind,
  fontSize: number,
): { width: number; height: number } {
  const lines = text.split("\n");
  const height = Math.max(1, lines.length) * fontSize * LINE_HEIGHT;
  if (typeof document === "undefined") {
    return { width: Math.max(...lines.map((line) => line.length)) * fontSize * 0.55, height };
  }
  context ??= document.createElement("canvas").getContext("2d");
  if (!context)
    return { width: Math.max(...lines.map((line) => line.length)) * fontSize * 0.55, height };
  context.font = `${fontSize}px ${resolvedFamily(font)}`;
  const width = Math.max(...lines.map((line) => context!.measureText(line || " ").width));
  return { width: Math.ceil(width) + 2, height };
}
