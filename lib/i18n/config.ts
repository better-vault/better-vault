/**
 * UI languages. To add a language:
 *   1. copy `locales/en/` to `locales/<code>/` and translate the values,
 *   2. import its files in `lib/i18n/resources.ts`,
 *   3. add an entry below.
 * `npm run i18n:check` reports missing or extra keys.
 */
export interface LanguageInfo {
  /** BCP 47 code, also the folder name under `locales/`. */
  code: string;
  /** The language's name in English. */
  name: string;
  /** The language's name in itself, shown in the language picker. */
  nativeName: string;
  dir: "ltr" | "rtl";
}

export const languages = [
  { code: "en", name: "English", nativeName: "English", dir: "ltr" },
] as const satisfies readonly LanguageInfo[];

export type LanguageCode = (typeof languages)[number]["code"];

export const defaultLanguage: LanguageCode = "en";

export const namespaces = [
  "common",
  "home",
  "workspace",
  "studio",
  "settings",
  "chat",
  "sources",
] as const;

export type Namespace = (typeof namespaces)[number];

export const defaultNamespace = "common" satisfies Namespace;

/** Where the chosen UI language is remembered in the browser. */
export const languageStorageKey = "better-vault:language";

export function isLanguageCode(value: unknown): value is LanguageCode {
  return languages.some((language) => language.code === value);
}

export function getLanguage(code: string): LanguageInfo {
  return languages.find((language) => language.code === code) ?? languages[0];
}
