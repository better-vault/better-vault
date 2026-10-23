import { describe, expect, it } from "vitest";
import { defaultLanguage, getLanguage, isLanguageCode, languages, namespaces } from "./config";
import { createI18n } from "./create-i18n";
import { resources } from "./resources";

describe("i18n config", () => {
  it("falls back to the first language for unknown codes", () => {
    expect(getLanguage("xx").code).toBe(languages[0].code);
  });

  it("recognises supported codes only", () => {
    expect(isLanguageCode(defaultLanguage)).toBe(true);
    expect(isLanguageCode("xx")).toBe(false);
    expect(isLanguageCode(null)).toBe(false);
  });

  it("bundles every namespace for every language", () => {
    for (const language of languages) {
      const bundle = resources[language.code];
      expect(Object.keys(bundle).sort()).toEqual([...namespaces].sort());
    }
  });

  it("translates synchronously after creation", () => {
    const i18n = createI18n();
    expect(i18n.t("appName")).toBe("better-vault");
    expect(i18n.t("sourceCount", { count: 2 })).toBe("2 sources");
  });
});
