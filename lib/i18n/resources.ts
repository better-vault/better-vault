import enChat from "@/locales/en/chat.json";
import enCommon from "@/locales/en/common.json";
import enHome from "@/locales/en/home.json";
import enSettings from "@/locales/en/settings.json";
import enSources from "@/locales/en/sources.json";
import enStudio from "@/locales/en/studio.json";
import enWorkspace from "@/locales/en/workspace.json";

/**
 * Every translation, bundled. English is the source of truth: other languages
 * must have the same keys (checked by `pnpm i18n:check`).
 */
export const resources = {
  en: {
    common: enCommon,
    home: enHome,
    workspace: enWorkspace,
    studio: enStudio,
    settings: enSettings,
    chat: enChat,
    sources: enSources,
  },
} as const;
