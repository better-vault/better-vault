"use client";

import { DirectionProvider } from "@base-ui/react/direction-provider";
import { useEffect, useState, type ReactNode } from "react";
import { I18nextProvider } from "react-i18next";
import {
  defaultLanguage,
  getLanguage,
  isLanguageCode,
  languageStorageKey,
} from "@/lib/i18n/config";
import { createI18n } from "@/lib/i18n/create-i18n";

function readSavedLanguage() {
  try {
    const saved = window.localStorage.getItem(languageStorageKey);
    return isLanguageCode(saved) ? saved : null;
  } catch {
    return null;
  }
}

/**
 * Gives the app its translations and keeps `<html lang dir>` in step with the
 * chosen language, so right-to-left languages lay out correctly.
 */
export function I18nProvider({ children }: { children: ReactNode }) {
  const [i18n] = useState(() => createI18n(defaultLanguage));
  const [dir, setDir] = useState(getLanguage(defaultLanguage).dir);

  useEffect(() => {
    const apply = (code: string) => {
      const language = getLanguage(code);
      document.documentElement.lang = language.code;
      document.documentElement.dir = language.dir;
      setDir(language.dir);
    };
    i18n.on("languageChanged", apply);
    const saved = readSavedLanguage();
    if (saved && saved !== i18n.language) void i18n.changeLanguage(saved);
    else apply(i18n.language);
    return () => i18n.off("languageChanged", apply);
  }, [i18n]);

  return (
    <I18nextProvider i18n={i18n}>
      <DirectionProvider direction={dir}>{children}</DirectionProvider>
    </I18nextProvider>
  );
}

/** Switches the UI language and remembers it in this browser. */
export function saveLanguage(code: string) {
  try {
    window.localStorage.setItem(languageStorageKey, code);
  } catch {
    // Storage can be blocked; the choice then lasts for this visit only.
  }
}
