/** Languages a Studio output can be written in (BCP 47). Names come from Intl.DisplayNames. */
export const outputLanguages = [
  "ar",
  "bn",
  "de",
  "en",
  "es",
  "fa",
  "fr",
  "he",
  "hi",
  "id",
  "it",
  "ja",
  "ko",
  "ms",
  "nl",
  "pl",
  "pt",
  "ru",
  "so",
  "sv",
  "sw",
  "th",
  "tr",
  "uk",
  "ur",
  "vi",
  "zh",
] as const;

/** A language's name in the given display language, e.g. "Arabic" or "العربية". */
export function languageName(code: string, displayIn: string): string {
  try {
    return new Intl.DisplayNames([displayIn], { type: "language" }).of(code) ?? code;
  } catch {
    return code;
  }
}
