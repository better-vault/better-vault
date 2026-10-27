import { resolveCssColor, withLightScope } from "@/lib/colors/resolve";
import type { DeckPalette } from "./pptx";

/** The light theme's colours, for the PowerPoint file. */
export function deckPalette(): DeckPalette {
  return withLightScope((scope) => {
    const hex = (token: string) => resolveCssColor(`var(${token})`, scope).slice(1);
    return {
      background: hex("--background"),
      foreground: hex("--foreground"),
      muted: hex("--muted"),
      mutedForeground: hex("--muted-foreground"),
      primary: hex("--primary"),
      primaryForeground: hex("--primary-foreground"),
      border: hex("--border"),
      info: hex("--info"),
      accents: ["--chart-2", "--chart-3", "--chart-4", "--chart-5"].map(hex),
    };
  });
}
