import { Alert02Icon } from "@hugeicons/core-free-icons";
import { useTranslation } from "react-i18next";
import { useRouteError } from "react-router";
import { Icon } from "@/components/icon";
import { Button } from "@/components/panelui/button";
import { routes } from "@/lib/routes";

/** Shown in place of a page that failed, with a way back. Nothing is lost: data is stored apart. */
export function RouteError() {
  const { t } = useTranslation();
  const error = useRouteError();
  const detail = error instanceof Error ? error.message : String(error ?? "");
  return (
    <main className="flex h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        <Icon icon={Alert02Icon} size={24} />
      </span>
      <div className="flex max-w-md flex-col gap-1.5">
        <h1 className="text-lg font-semibold">{t("crash.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("crash.description")}</p>
        {detail ? (
          <p className="mt-2 rounded-xl bg-muted px-3 py-2 font-mono text-xs break-words text-muted-foreground">
            {detail}
          </p>
        ) : null}
      </div>
      <div className="flex gap-2">
        <Button onClick={() => window.location.reload()}>{t("crash.reload")}</Button>
        <Button variant="outline" onClick={() => window.location.assign(routes.home)}>
          {t("crash.home")}
        </Button>
      </div>
    </main>
  );
}
