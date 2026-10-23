"use client";

import { useTranslation } from "react-i18next";

export function SourcesView() {
  const { t } = useTranslation("sources");
  return (
    <div className="grid h-full place-items-center p-6 text-center">
      <h2 className="text-2xl font-semibold tracking-tight">{t("title")}</h2>
    </div>
  );
}
