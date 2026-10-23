"use client";

import { ArrowUpRight01Icon } from "@hugeicons/core-free-icons";
import { useTranslation } from "react-i18next";
import { Logo } from "@/components/brand/logo";
import { Icon } from "@/components/icon";
import { Sheet } from "@/components/panelui/sheet";
import { appVersion, repositoryUrl } from "@/lib/version";

const credits = [
  { name: "Panel UI", href: "https://panelui.dev", key: "panel" },
  // Required by Rare UI's license: a visible link to rareui.com.
  { name: "Rare UI", href: "https://rareui.com", key: "rare" },
  { name: "Pele", href: "https://pele.run", key: "pele" },
  { name: "Hugeicons", href: "https://hugeicons.com", key: "hugeicons" },
  { name: "Anatomy", href: "https://skills.wheresryan.sh/anatomy", key: "anatomy" },
  { name: "Vercel AI SDK", href: "https://ai-sdk.dev", key: "aiSdk" },
] as const;

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
          <section>
            <h3 className="mb-2 text-xs font-medium text-muted-foreground">{t("about.credits")}</h3>
            <ul className="flex flex-col gap-2 text-sm">
              {credits.map((credit) => (
                <li key={credit.key} className="flex items-baseline justify-between gap-3">
                  <ExternalLink href={credit.href}>{credit.name}</ExternalLink>
                  <span className="text-end text-xs text-muted-foreground">{t(`about.${credit.key}`)}</span>
                </li>
              ))}
            </ul>
          </section>
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
