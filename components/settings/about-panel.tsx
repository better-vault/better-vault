import {
  ArrowUpRight01Icon,
  Bug01Icon,
  GithubIcon,
  JusticeScale01Icon,
  News01Icon,
} from "@hugeicons/core-free-icons";
import { useTranslation } from "react-i18next";
import { Logo } from "@/components/brand/logo";
import { Icon } from "@/components/icon";
import { Sheet } from "@/components/panelui/sheet";
import { UpdateStatus } from "@/components/updates/update-status";
import type { Updates } from "@/lib/updates/use-updates";
import { releaseNotesUrl } from "@/lib/updates/version";
import { appVersion, repositoryUrl } from "@/lib/version";

/** Settings → About & Updates: the app, whether a newer version is out, and links. */
export function AboutPanel({ updates }: { updates: Updates }) {
  const { t } = useTranslation("settings");
  const { t: tCommon } = useTranslation();

  return (
    <>
      <Sheet.Header title={t("about.title")} />
      <Sheet.Body>
        <div className="flex flex-col gap-6 pb-4">
          <div className="flex flex-col items-center px-4 pt-2 text-center">
            <Logo size={56} />
            <p className="mt-3 text-lg font-semibold tracking-tight">{tCommon("appName")}</p>
            <p className="text-sm text-muted-foreground tabular-nums">
              {t("about.version", { version: appVersion })}
            </p>
            <p className="mt-3 max-w-64 text-sm leading-6 text-muted-foreground">
              {t("about.description")}
            </p>
          </div>

          <div className="-mx-2 flex flex-col gap-0.5">
            <UpdateStatus updates={updates} />
          </div>

          <nav className="-mx-2 flex flex-col gap-0.5" aria-label={t("about.links")}>
            <LinkRow
              href={releaseNotesUrl(appVersion)}
              icon={News01Icon}
              label={t("about.releaseNotes")}
            />
            <LinkRow href={repositoryUrl} icon={GithubIcon} label={t("about.github")} />
            <LinkRow
              href={`${repositoryUrl}/issues/new/choose`}
              icon={Bug01Icon}
              label={t("about.issues")}
            />
            <LinkRow
              href={`${repositoryUrl}/blob/main/LICENSE`}
              icon={JusticeScale01Icon}
              label={t("about.license")}
            />
          </nav>
        </div>
      </Sheet.Body>
    </>
  );
}

/** A link drawn like a settings row, opening in the browser. */
function LinkRow({ href, icon, label }: { href: string; icon: typeof GithubIcon; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-3 rounded-2xl px-2.5 py-2 text-sm font-medium transition-colors outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted">
        <Icon icon={icon} size={18} />
      </span>
      <span className="min-w-0 flex-1">{label}</span>
      <Icon
        icon={ArrowUpRight01Icon}
        size={16}
        className="shrink-0 text-muted-foreground rtl:-scale-x-100"
      />
    </a>
  );
}
