/**
 * The colours a bot can have: theme tokens, so avatars follow light and dark
 * mode. The renderer reads CSS colours live, so it is handed `var(--…)`.
 * Rows store the key; an unknown key falls back to the first colour. The
 * mixed colours blend two tokens, so they follow the theme as well.
 */
const mix = (a: string, b: string, share = 50) =>
  `color-mix(in oklch, var(--${a}) ${share}%, var(--${b}))`;

export const botColors = {
  "chart-3": { body: "var(--chart-3)" },
  "chart-2": { body: "var(--chart-2)" },
  "chart-5": { body: "var(--chart-5)" },
  "chart-4": { body: "var(--chart-4)" },
  destructive: { body: "var(--destructive)" },
  "chart-1": { body: "var(--chart-1)" },
  teal: { body: mix("chart-2", "chart-3") },
  indigo: { body: mix("chart-2", "chart-5") },
  rose: { body: mix("destructive", "chart-5", 60) },
  orange: { body: mix("destructive", "chart-4") },
  lime: { body: mix("chart-3", "chart-4", 45) },
  slate: { body: mix("chart-2", "muted-foreground", 25) },
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
