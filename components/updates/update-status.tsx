import {
  AlertCircleIcon,
  CheckmarkCircle02Icon,
  CloudDownloadIcon,
  Loading03Icon,
  RefreshIcon,
  SparklesIcon,
} from "@hugeicons/core-free-icons";
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/icon";
import { Button } from "@/components/panelui/button";
import type { Updates } from "@/lib/updates/use-updates";
import { formatRelativeTime } from "@/lib/format";
import { releaseNotesUrl } from "@/lib/updates/version";
import { cn } from "@/lib/utils";

/**
 * One settings-style row for the app's updates: an icon that says where
 * things stand, a line of status, and the single action that fits (check,
 * download, restart). Used in Settings → About & Updates and in the dialog
 * the desktop menu's "Check for Updates…" opens.
 */
export function UpdateStatus({ updates }: { updates: Updates }) {
  const { t, i18n } = useTranslation("settings");
  const { state, desktop } = updates;

  let icon = RefreshIcon;
  let tile = "bg-muted text-foreground";
  let hint: string;
  let action: { label: string; run: () => void } | { href: string; label: string } | null = null;

  switch (state.status) {
    case "idle":
      hint = desktop && !state.supported ? t("updates.devBuild") : t("updates.notChecked");
      if (!desktop || state.supported) action = { label: t("updates.check"), run: updates.check };
      break;
    case "checking":
      icon = Loading03Icon;
      hint = t("updates.checking");
      break;
    case "upToDate":
      icon = CheckmarkCircle02Icon;
      tile = "bg-success/15 text-success";
      hint = t("updates.upToDateAt", { time: formatRelativeTime(state.checkedAt, i18n.language) });
      action = { label: t("updates.check"), run: updates.check };
      break;
    case "available":
      icon = SparklesIcon;
      tile = "bg-info/15 text-info";
      hint = t("updates.available", { version: state.version });
      action = desktop
        ? { label: t("updates.download"), run: updates.download }
        : { label: t("updates.whatsNew"), href: releaseNotesUrl(state.version) };
      break;
    case "downloading":
      icon = CloudDownloadIcon;
      tile = "bg-info/15 text-info";
      hint = t("updates.downloading", { version: state.version, percent: state.percent });
      break;
    case "ready":
      icon = SparklesIcon;
      tile = "bg-info/15 text-info";
      hint = t("updates.ready", { version: state.version });
      action = { label: t("updates.restart"), run: updates.install };
      break;
    case "error":
      icon = AlertCircleIcon;
      tile = "bg-destructive/15 text-destructive";
      hint = t("updates.failed");
      action = { label: t("updates.tryAgain"), run: updates.check };
      break;
  }

  return (
    <div
      className="flex items-center gap-3 px-2.5 py-2.5"
      title={state.status === "error" ? state.message : undefined}
    >
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", tile)}>
        <Icon icon={icon} className={state.status === "checking" ? "animate-spin" : undefined} />
      </span>
      <div className="min-w-0 flex-1" role="status" aria-live="polite">
        <p className="text-sm font-medium">{t("updates.label")}</p>
        <p className="truncate text-xs text-muted-foreground">{hint}</p>
        {state.status === "downloading" ? (
          <div
            className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={state.percent}
            aria-label={t("updates.progress")}
          >
            <div
              className="h-full rounded-full bg-info transition-[width]"
              style={{ width: `${state.percent}%` }}
            />
          </div>
        ) : null}
      </div>
      {action && "href" in action ? (
        <a
          href={action.href}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 text-xs font-medium underline underline-offset-4"
        >
          {action.label}
        </a>
      ) : action ? (
        <Button
          size="sm"
          shape="pill"
          variant={
            state.status === "available" || state.status === "ready" ? "default" : "secondary"
          }
          onClick={action.run}
          className="shrink-0"
        >
          {action.label}
        </Button>
      ) : null}
    </div>
  );
}
