/**
 * The colours a notebook or folder can have: theme tokens, so they follow
 * light and dark mode. Classes are written out in full for Tailwind to find.
 * Rows store the key; unknown keys fall back to the neutral look.
 */
export const itemColors = {
  "chart-2": { swatch: "bg-chart-2", tile: "bg-chart-2/15 text-chart-2" },
  "chart-3": { swatch: "bg-chart-3", tile: "bg-chart-3/15 text-chart-3" },
  "chart-4": { swatch: "bg-chart-4", tile: "bg-chart-4/15 text-chart-4" },
  "chart-5": { swatch: "bg-chart-5", tile: "bg-chart-5/15 text-chart-5" },
  destructive: { swatch: "bg-destructive", tile: "bg-destructive/15 text-destructive" },
  "chart-1": { swatch: "bg-chart-1", tile: "bg-chart-1/15 text-chart-1" },
} as const;

export type ItemColor = keyof typeof itemColors;

export const itemColorKeys = Object.keys(itemColors) as ItemColor[];

const neutral = { swatch: "bg-muted-foreground/40", tile: "bg-muted text-foreground" };

export function itemColor(key: string | undefined) {
  return (key && itemColors[key as ItemColor]) || neutral;
}
