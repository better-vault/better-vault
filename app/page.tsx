"use client";

import { useTranslation } from "react-i18next";

export default function HomePage() {
  const { t } = useTranslation();
  return (
    <main className="grid h-full place-items-center">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">{t("appName")}</h1>
        <p className="text-muted-foreground">{t("tagline")}</p>
      </div>
    </main>
  );
}
