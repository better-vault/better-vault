"use client";

import { ArrowUpRight01Icon } from "@hugeicons/core-free-icons";
import { useTranslation } from "react-i18next";
import { Logo } from "@/components/brand/logo";
import { Icon } from "@/components/icon";
import { Sheet } from "@/components/panelui/sheet";
import { appVersion, repositoryUrl } from "@/lib/version";

export function AboutPanel() {
  const { t } = useTranslation("settings");
  const { t: tCommon } = useTranslation();

  return (
    <>
      <Sheet.Header title={t("about.title")} />
      <Sheet.Body>
        <div className="flex flex-col gap-6 pb-4">
          <div className="flex items-center gap-3">
            <Logo size={44} />
            <div>
              <p className="font-semibold">{tCommon("appName")}</p>
              <p className="text-sm text-muted-foreground">{t("about.version", { version: appVersion })}</p>
            </div>
          </div>
          <p className="text-sm leading-6 text-muted-foreground">{t("about.description")}</p>
          <div className="flex flex-col gap-1 text-sm">
            <ExternalLink href={repositoryUrl}>{t("about.github")}</ExternalLink>
            <ExternalLink href={`${repositoryUrl}/issues/new/choose`}>{t("about.issues")}</ExternalLink>
            <ExternalLink href={`${repositoryUrl}/blob/main/LICENSE`}>{t("about.license")}</ExternalLink>
          </div>
        </div>
      </Sheet.Body>
    </>
  );
}

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex w-fit items-center gap-1 font-medium underline-offset-4 hover:underline"
    >
      {children}
      <Icon icon={ArrowUpRight01Icon} size={14} className="text-muted-foreground rtl:-scale-x-100" />
    </a>
  );
}
