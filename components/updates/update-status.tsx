import { Loading03Icon } from "@hugeicons/core-free-icons";
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/icon";
import { Button, buttonVariants } from "@/components/panelui/button";
import type { Updates } from "@/lib/updates/use-updates";
import { releaseNotesUrl } from "@/lib/updates/version";
import { cn } from "@/lib/utils";

/**
 * Where the app's updates stand, with the one action that fits: check again,
 * download, or restart. Used in Settings → About & Updates and in the dialog
 * the desktop menu's "Check for Updates…" opens.
 */
export function UpdateStatus({ updates }: { updates: Updates }) {
  const { t } = useTranslation("settings");
  const { state, desktop } = updates;

  const tone =
    state.status === "upToDate"
      ? "bg-success"
      : state.status === "available" || state.status === "ready"
        ? "bg-info"
        : state.status === "error"
          ? "bg-destructive"
          : "bg-muted-foreground/40";

  let title: string;
  let detail: string | null = null;
  switch (state.status) {
    case "idle":
      title = desktop && !state.supported ? t("updates.devBuild") : t("updates.notChecked");
      break;
    case "checking":
      title = t("updates.checking");
      break;
    case "upToDate":
      title = t("updates.upToDate");
      break;
    case "available":
      title = t("updates.available", { version: state.version });
      detail = desktop ? t("updates.availableHint") : t("updates.availableWebHint");
      break;
    case "downloading":
      title = t("updates.downloading", { version: state.version, percent: state.percent });
      break;
    case "ready":
      title = t("updates.ready", { version: state.version });
      detail = t("updates.readyHint");
      break;
    case "error":
      title = t("updates.failed");
      detail = state.message;
      break;
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-muted/50 p-4 ring-1 ring-border">
      <div className="flex items-start gap-3">
        {state.status === "checking" ? (
          <Icon
            icon={Loading03Icon}
            size={16}
            className="mt-0.5 shrink-0 animate-spin text-muted-foreground"
          />
        ) : (
          <span aria-hidden className={cn("mt-1.5 size-2 shrink-0 rounded-full", tone)} />
        )}
        <div className="min-w-0 flex-1" role="status" aria-live="polite">
          <p className="text-sm font-medium">{title}</p>
          {detail ? (
            <p className="mt-0.5 text-xs break-words text-muted-foreground">{detail}</p>
          ) : null}
        </div>
      </div>

      {state.status === "downloading" ? (
        <div
          className="h-1.5 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={state.percent}
          aria-label={t("updates.progress")}
        >
          <div
            className="h-full rounded-full bg-primary transition-[width]"
            style={{ width: `${state.percent}%` }}
          />
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {state.status === "available" && desktop ? (
          <Button size="sm" onClick={updates.download}>
            {t("updates.download")}
          </Button>
        ) : null}
        {state.status === "ready" ? (
          <Button size="sm" onClick={updates.install}>
            {t("updates.restart")}
          </Button>
        ) : null}
        {state.status === "available" || state.status === "ready" ? (
          <a
            href={releaseNotesUrl(state.version)}
            target="_blank"
            rel="noreferrer"
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            {t("updates.whatsNew")}
          </a>
        ) : null}
        {state.status === "upToDate" ||
        state.status === "error" ||
        (state.status === "idle" && (!desktop || state.supported)) ? (
          <Button size="sm" variant="secondary" onClick={updates.check}>
            {state.status === "error" ? t("updates.tryAgain") : t("updates.check")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
