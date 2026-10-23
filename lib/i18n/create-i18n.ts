import i18next, { type i18n } from "i18next";
import { initReactI18next } from "react-i18next";
import { defaultLanguage, defaultNamespace, namespaces, type LanguageCode } from "./config";
import { resources } from "./resources";

/**
 * A fresh i18next instance with every resource bundled, initialised
 * synchronously so the first render already has its strings.
 */
export function createI18n(language: LanguageCode = defaultLanguage): i18n {
  const instance = i18next.createInstance();
  void instance.use(initReactI18next).init({
    resources,
    lng: language,
    fallbackLng: defaultLanguage,
    ns: namespaces,
    defaultNS: defaultNamespace,
    interpolation: { escapeValue: false },
    returnNull: false,
    initAsync: false,
  });
  return instance;
}
