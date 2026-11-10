import { CloudIcon, FlashIcon, Key01Icon, SparklesIcon } from "@hugeicons/core-free-icons";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Logo } from "@/components/brand/logo";
import { Icon, type IconSvgElement } from "@/components/icon";
import { Button } from "@/components/panelui/button";
import { Select } from "@/components/panelui/select";
import { Sheet } from "@/components/panelui/sheet";
import { Switch } from "@/components/panelui/switch";
import {
  openPortal,
  refreshAccount,
  setOverage,
  signIn,
  startCheckout,
  subscriptionsOpen,
  useAccount,
} from "@/lib/account/account";
import { cn } from "@/lib/utils";

type Plan = "pro" | "max";

const caps = [500, 1000, 2000];
const included: Record<Plan, { credits: number; storage: number }> = {
  pro: { credits: 1250, storage: 20 },
  max: { credits: 3500, storage: 50 },
};

/**
 * Settings → Subscription: with a plan, what has been used this month, extra
 * usage and where to manage it; without one, the two plans side by side and
 * what the chosen one includes. Until the backend opens subscriptions, the
 * plans say "Coming soon". Signing out lives in Settings → Account.
 */
export function SubscriptionPanel() {
  const { t, i18n } = useTranslation("settings");
  const account = useAccount();
  const [busy, setBusy] = useState<string | null>(null);
  const [chosen, setChosen] = useState<Plan>("pro");
  const open = subscriptionsOpen(account);

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

  if (account === undefined) return null;
  const plan = account?.account.plan ?? null;

  return (
    <>
      <Sheet.Header title={t("subscription.title")} description={t("subscription.description")} />
      <Sheet.Body>
        <div className="flex flex-col gap-5 pb-4">
          {plan && account ? (
            <CurrentPlan plan={plan} busy={busy} run={run} />
          ) : (
            <>
              <div className="flex items-center gap-3">
                <Logo size={40} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{t("subscription.heroTitle")}</p>
                  <p className="text-xs text-muted-foreground">{t("subscription.heroBody")}</p>
                </div>
                {!open ? (
                  <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-[0.6875rem] font-medium text-muted-foreground">
                    {t("subscription.soon")}
                  </span>
                ) : null}
              </div>

              <div
                role="radiogroup"
                aria-label={t("subscription.choose")}
                className="grid grid-cols-2 gap-2"
              >
                {(["pro", "max"] as const).map((each) => (
                  <button
                    key={each}
                    type="button"
                    role="radio"
                    aria-checked={chosen === each}
                    onClick={() => setChosen(each)}
                    className={cn(
                      "flex cursor-pointer flex-col items-start gap-0.5 rounded-2xl p-3.5 text-start ring-1 transition outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      chosen === each
                        ? "bg-card shadow-xs ring-2 ring-foreground"
                        : "ring-border hover:bg-muted/60",
                    )}
                  >
                    <span className="text-sm font-medium">{t(`subscription.plans.${each}`)}</span>
                    <span className="flex items-baseline gap-0.5">
                      <span className="text-xl font-semibold tracking-tight tabular-nums">
                        {t(`subscription.amount.${each}`)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {t("subscription.perMonth")}
                      </span>
                    </span>
                  </button>
                ))}
              </div>

              <div className="flex flex-col gap-4 rounded-2xl bg-muted/50 p-4">
                <p className="text-xs text-muted-foreground">
                  {t(`subscription.tagline.${chosen}`)}
                </p>
                <ul className="flex flex-col gap-3">
                  <Feature icon={SparklesIcon} text={t("subscription.features.haiku")} />
                  <Feature
                    icon={FlashIcon}
                    text={t("subscription.features.credits", {
                      count: included[chosen].credits,
                      formatted: included[chosen].credits.toLocaleString(i18n.language),
                    })}
                  />
                  <Feature
                    icon={CloudIcon}
                    text={t("subscription.features.storage", { size: included[chosen].storage })}
                  />
                  <Feature icon={Key01Icon} text={t("subscription.features.keys")} />
                </ul>
                {!open ? (
                  <Button size="lg" className="w-full" disabled>
                    {t("subscription.soon")}
                  </Button>
                ) : account ? (
                  <Button
                    size="lg"
                    className="w-full"
                    disabled={busy !== null}
                    aria-busy={busy === chosen}
                    onClick={() => void run(chosen, () => startCheckout(chosen))}
                  >
                    {t("subscription.choosePlan", { plan: t(`subscription.plans.${chosen}`) })}
                  </Button>
                ) : null}
              </div>

              {!open ? (
                <p className="text-xs text-muted-foreground">{t("subscription.soonHint")}</p>
              ) : null}

              {!account ? (
                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    variant={open ? "default" : "outline"}
                    disabled={busy !== null}
                    onClick={() => void run("signin", () => signIn("signin"))}
                  >
                    {t("subscription.signIn")}
                  </Button>
                  <Button
                    className="flex-1"
                    variant="outline"
                    disabled={busy !== null}
                    onClick={() => void run("signup", () => signIn("signup"))}
                  >
                    {t("subscription.createAccount")}
                  </Button>
                </div>
              ) : null}
            </>
          )}

          <p className="text-xs text-muted-foreground">{t("subscription.keysStay")}</p>
        </div>
      </Sheet.Body>
    </>
  );
}

/** The active plan: when it renews, what is used and left, extra usage, and managing it. */
function CurrentPlan({
  plan,
  busy,
  run,
}: {
  plan: Plan;
  busy: string | null;
  run: (what: string, action: () => Promise<unknown>) => Promise<void>;
}) {
  const { t, i18n } = useTranslation("settings");
  const account = useAccount();
  if (!account) return null;
  const { credits, storage, periodEnd, cancelAtPeriodEnd, overage } = account.account;
  const date = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString(i18n.language, { day: "numeric", month: "long" }) : "";
  const gb = (bytes: number) => (bytes / 1024 ** 3).toFixed(bytes < 1024 ** 3 ? 2 : 1);

  return (
    <>
      <div className="flex items-center gap-3">
        <Logo size={40} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">
            {t("subscription.planName", { plan: t(`subscription.plans.${plan}`) })}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {cancelAtPeriodEnd
              ? t("subscription.cancels", { date: date(periodEnd) })
              : t("subscription.renews", { date: date(periodEnd) })}
          </p>
        </div>
        <span className="shrink-0 text-sm font-semibold tabular-nums">
          {t(`subscription.amount.${plan}`)}
          <span className="text-xs font-normal text-muted-foreground">
            {t("subscription.perMonth")}
          </span>
        </span>
      </div>

      <div className="flex flex-col gap-4 rounded-2xl bg-muted/50 p-4">
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
      </div>

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
  );
}

function Feature({ icon, text }: { icon: IconSvgElement; text: string }) {
  return (
    <li className="flex items-center gap-3 text-sm">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-background text-foreground">
        <Icon icon={icon} size={15} />
      </span>
      {text}
    </li>
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
        className="h-2 overflow-hidden rounded-full bg-background"
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
