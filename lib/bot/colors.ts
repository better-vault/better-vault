/**
 * The colours a bot can have: theme tokens, so avatars follow light and dark
 * mode. The renderer reads CSS colours live, so it is handed `var(--…)`.
 * Rows store the key; an unknown key falls back to the first colour.
 */
export const botColors = {
  "chart-3": { body: "var(--chart-3)", swatch: "bg-chart-3" },
  "chart-2": { body: "var(--chart-2)", swatch: "bg-chart-2" },
  "chart-5": { body: "var(--chart-5)", swatch: "bg-chart-5" },
  "chart-4": { body: "var(--chart-4)", swatch: "bg-chart-4" },
  destructive: { body: "var(--destructive)", swatch: "bg-destructive" },
  "chart-1": { body: "var(--chart-1)", swatch: "bg-chart-1" },
} as const;

export type BotColor = keyof typeof botColors;

export const botColorKeys = Object.keys(botColors) as BotColor[];

export function botColor(key: string | undefined) {
  const color = botColors[key as BotColor] ?? botColors["chart-3"];
  return {
    ...color,
    // Dark ink on a coloured body; chart-1 is ink itself, so its eyes take the page colour.
    eyes: key === "chart-1" ? "var(--background)" : "var(--bot-ink)",
  };
}
