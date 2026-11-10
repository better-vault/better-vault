import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/panelui/button";
import { Select } from "@/components/panelui/select";
import { Sheet } from "@/components/panelui/sheet";
import { Switch } from "@/components/panelui/switch";
import {
  openPortal,
  refreshAccount,
  setOverage,
  signIn,
  signOut,
  startCheckout,
  useAccount,
} from "@/lib/account/account";
import { cn } from "@/lib/utils";

const caps = [500, 1000, 2000];

/**
 * Settings → Subscription: the plan, what has been used this month and
 * what is left, extra usage, and where to upgrade, manage or cancel.
 * Without an account it explains the plans and offers to sign in.
 */
export function SubscriptionPanel() {
  const { t, i18n } = useTranslation("settings");
  const account = useAccount();
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (what: string, action: () => Promise<unknown>) => {
    setBusy(what);
    try {
      await action();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message !== "cancelled")
        toast.error(message === "popup-blocked" ? t("subscription.popupBlocked") : message);
    } finally {
      setBusy(null);
    }
  };

  const plans = (
    <div className="grid grid-cols-2 gap-2">
      {(["pro", "max"] as const).map((plan) => (
        <div
          key={plan}
          className={cn(
            "flex flex-col gap-1 rounded-2xl p-3 ring-1 ring-border",
            plan === "pro" && "bg-muted/50",
          )}
        >
          <span className="text-sm font-semibold">{t(`subscription.plans.${plan}`)}</span>
          <span className="text-lg font-semibold tabular-nums">
            {t(`subscription.prices.${plan}`)}
          </span>
          <span className="text-xs text-muted-foreground">
            {t(`subscription.includes.${plan}`)}
          </span>
          {account ? (
            <Button
              size="sm"
              className="mt-1"
              variant={plan === "pro" ? "default" : "secondary"}
              disabled={busy !== null}
              onClick={() => void run(plan, () => startCheckout(plan))}
            >
              {t("subscription.choose")}
            </Button>
          ) : null}
        </div>
      ))}
    </div>
  );

  if (account === undefined) return null;

  if (!account) {
    return (
      <>
        <Sheet.Header title={t("subscription.title")} description={t("subscription.description")} />
        <Sheet.Body>
          <div className="flex flex-col gap-4 pb-4">
            {plans}
            <p className="text-xs text-muted-foreground">{t("subscription.keysStay")}</p>
            <div className="flex gap-2">
              <Button
                className="flex-1"
                disabled={busy !== null}
                onClick={() => void run("signin", () => signIn("signin"))}
              >
                {t("subscription.signIn")}
              </Button>
              <Button
                className="flex-1"
                variant="secondary"
                disabled={busy !== null}
                onClick={() => void run("signup", () => signIn("signup"))}
              >
                {t("subscription.createAccount")}
              </Button>
            </div>
          </div>
        </Sheet.Body>
      </>
    );
  }

  const { plan, credits, storage, periodEnd, cancelAtPeriodEnd, overage } = account.account;
  const date = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString(i18n.language, { day: "numeric", month: "long" }) : "";
  const gb = (bytes: number) => (bytes / 1024 ** 3).toFixed(bytes < 1024 ** 3 ? 2 : 1);

  return (
    <>
      <Sheet.Header title={t("subscription.title")} description={account.user.email} />
      <Sheet.Body>
        <div className="flex flex-col gap-5 pb-4">
          <div className="flex items-center gap-3 rounded-2xl bg-muted/50 p-3">
            <Logo size={36} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">
                {plan ? t(`subscription.plans.${plan}`) : t("subscription.noPlan")}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {plan
                  ? cancelAtPeriodEnd
                    ? t("subscription.cancels", { date: date(periodEnd) })
                    : t("subscription.renews", { date: date(periodEnd) })
                  : t("subscription.noPlanHint")}
              </p>
            </div>
          </div>

          {plan ? (
            <>
              <Meter
                label={t("subscription.credits")}
                used={credits.used}
                total={credits.included}
                detail={t("subscription.creditsLeft", {
                  left: Math.max(0, Math.floor(credits.included - credits.used)).toLocaleString(
                    i18n.language,
                  ),
                  total: credits.included.toLocaleString(i18n.language),
                  date: date(periodEnd),
                })}
              />
              <Meter
                label={t("subscription.storage")}
                used={storage.used}
                total={storage.included}
                detail={t("subscription.storageUsed", {
                  used: gb(storage.used),
                  total: gb(storage.included),
                })}
              />
              <section className="flex flex-col gap-2">
                <label className="flex cursor-pointer items-center gap-3">
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{t("subscription.overage")}</span>
                    <span className="block text-xs text-muted-foreground">
                      {t("subscription.overageHint")}
                    </span>
                  </span>
                  <Switch
                    checked={overage.enabled}
                    onCheckedChange={(enabled) =>
                      void run("overage", () => setOverage(enabled, overage.capCents))
                    }
                  />
                </label>
                {overage.enabled ? (
                  <Select
                    items={caps.map((cents) => ({
                      value: cents,
                      label: t("subscription.cap", { amount: (cents / 100).toFixed(0) }),
                    }))}
                    value={overage.capCents}
                    onValueChange={(next) =>
                      typeof next === "number" && void run("overage", () => setOverage(true, next))
                    }
                  >
                    <Select.Trigger aria-label={t("subscription.capLabel")} className="w-full">
                      <Select.Value />
                    </Select.Trigger>
                    <Select.Content>
                      {caps.map((cents) => (
                        <Select.Item key={cents} value={cents}>
                          {t("subscription.cap", { amount: (cents / 100).toFixed(0) })}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select>
                ) : null}
              </section>
              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  variant="secondary"
                  disabled={busy !== null}
                  onClick={() => void run("portal", openPortal)}
                >
                  {t("subscription.manage")}
                </Button>
                <Button
                  className="flex-1"
                  variant="ghost"
                  disabled={busy !== null}
                  onClick={() => void run("refresh", refreshAccount)}
                >
                  {t("subscription.refresh")}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">{t("subscription.manageHint")}</p>
            </>
          ) : (
            plans
          )}

          <p className="text-xs text-muted-foreground">{t("subscription.keysStay")}</p>
          <Button
            variant="ghost"
            className="self-start"
            disabled={busy !== null}
            onClick={() => void run("signout", signOut)}
          >
            {t("subscription.signOut")}
          </Button>
        </div>
      </Sheet.Body>
    </>
  );
}

function Meter({
  label,
  used,
  total,
  detail,
}: {
  label: string;
  used: number;
  total: number;
  detail: string;
}) {
  const share = total > 0 ? Math.min(1, used / total) : 0;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {Math.round(share * 100)}%
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(share * 100)}
        className="h-2 overflow-hidden rounded-full bg-muted"
      >
        <div
          className={cn("h-full rounded-full", share >= 0.9 ? "bg-warning" : "bg-primary")}
          style={{ width: `${share * 100}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground">{detail}</span>
    </div>
  );
}
