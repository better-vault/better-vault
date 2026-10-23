"use client";

import { useTranslation } from "react-i18next";

export function ChatView() {
  const { t } = useTranslation("chat");
  return (
    <div className="grid h-full place-items-center p-6 text-center">
      <h2 className="text-2xl font-semibold tracking-tight">{t("empty.title")}</h2>
    </div>
  );
}
