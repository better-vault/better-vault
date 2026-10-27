import type { BoardColor } from "./schema";

/**
 * The board's colours, as theme tokens, so a board follows light and dark
 * mode. Exports resolve them to the light theme's values.
 */
export const colorTokens: Record<BoardColor, string> = {
  ink: "--foreground",
  grey: "--muted-foreground",
  red: "--destructive",
  green: "--success",
  blue: "--info",
  amber: "--warning",
  violet: "--chart-5",
};

/** For SVG `style`: CSS variables don't work in SVG presentation attributes. */
export const strokeCss = (color: BoardColor) => `var(${colorTokens[color]})`;

/** Fills are a pale, solid tint of the colour on the board's background. */
export const fillCss = (color: BoardColor) =>
  color === "ink" || color === "grey"
    ? `color-mix(in oklch, var(${colorTokens[color]}) 18%, var(--background))`
    : `color-mix(in oklch, var(${colorTokens[color]}) 30%, var(--background))`;

/** The swatch in the properties panel. */
export const swatchClass: Record<BoardColor, string> = {
  ink: "bg-foreground",
  grey: "bg-muted-foreground",
  red: "bg-destructive",
  green: "bg-success",
  blue: "bg-info",
  amber: "bg-warning",
  violet: "bg-chart-5",
};

/** Colours as plain values, for SVG and PNG files. */
export interface ResolvedPalette {
  stroke: Record<BoardColor, string>;
  fill: Record<BoardColor, string>;
  background: string;
}
