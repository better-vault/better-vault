"use client";

import { ArrowUpRight01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/icon";
import { Sheet } from "@/components/panelui/sheet";
import { saveLanguage } from "@/components/providers/i18n-provider";
import { languages } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";
import { repositoryUrl } from "@/lib/version";

export function LanguagePanel() {
  const { t, i18n } = useTranslation("settings");

  return (
    <>
      <Sheet.Header title={t("language.title")} description={t("language.description")} />
      <Sheet.Body>
        <div role="radiogroup" aria-label={t("language.title")} className="-mx-2 flex flex-col gap-0.5">
          {languages.map((language) => {
            const selected = i18n.language === language.code;
            return (
              <button
                key={language.code}
                type="button"
                role="radio"
                aria-checked={selected}
                lang={language.code}
                dir={language.dir}
                onClick={() => {
                  saveLanguage(language.code);
                  void i18n.changeLanguage(language.code);
                }}
                className={cn(
                  "flex h-11 cursor-pointer items-center gap-3 rounded-xl px-3 text-start text-sm outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
                  selected && "bg-muted font-medium",
                )}
              >
                <span className="flex-1">{language.nativeName}</span>
                {selected ? <Icon icon={Tick02Icon} size={16} /> : null}
              </button>
            );
          })}
        </div>
        <a
          href={`${repositoryUrl}#-translating`}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex items-center gap-1 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          {t("language.helpTranslate")}
          <Icon icon={ArrowUpRight01Icon} size={14} className="rtl:-scale-x-100" />
        </a>
      </Sheet.Body>
    </>
  );
}
