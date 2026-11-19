import { CloudIcon, FlashIcon, Key01Icon, RefreshIcon } from "@hugeicons/core-free-icons";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";
import { Logo } from "@/components/brand/logo";
import { Icon, type IconSvgElement } from "@/components/icon";
import { Button } from "@/components/panelui/button";
import { Dialog } from "@/components/panelui/dialog";
import { markWelcomed, refreshAccount, useAccount } from "@/lib/account/account";
import { previewAccount, subscriptionPreview } from "@/lib/account/preview";
import { toast } from "sonner";
import { updateSettings } from "@/lib/db/settings";

/**
 * Keeps the account fresh (when the app opens, when its window comes back
 * into focus, and after a checkout) and thanks the user once for each new
 * plan, offering to switch to Better Vault AI.
 */
export function AccountWatcher() {
  const { t, i18n } = useTranslation("settings");
  const { t: tCommon } = useTranslation();
  const real = useAccount();
  // Development only: ?preview=subscribed shows the dialog a new subscriber gets.
  const preview = subscriptionPreview();
  const account = preview && real !== undefined ? previewAccount(real) : real;
  const [params, setParams] = useSearchParams();
  // Shown while the plan hasn't been thanked for; closing it marks it thanked.
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const refresh = () => void refreshAccount().catch(() => {});
    refresh();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, []);

  // Back from checkout: read the new plan at once and drop the marker from the address.
  useEffect(() => {
    if (params.get("subscribed") !== "1") return;
    void refreshAccount().catch(() => {});
    const next = new URLSearchParams(params);
    // Dodo adds the subscription and its status to the address it sends back to.
    for (const key of ["subscribed", "subscription_id", "status", "email", "checkout_id"])
      next.delete(key);
    setParams(next, { replace: true });
  }, [params, setParams]);

  const plan = account?.account.plan ?? null;
  const due = plan !== null && account?.welcomed !== plan;
  const open = due && !dismissed;

  const close = () => {
    setDismissed(true);
    if (!preview) void markWelcomed();
  };
  if (!account || !plan) return null;

  const name = t(`subscription.plans.${plan}`);
  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <Dialog.Content size="sm" closeLabel={tCommon("actions.close")}>
        <div className="flex flex-col items-center gap-3 px-2 pt-6 text-center">
          <Logo size={56} />
          <h2 className="text-xl font-semibold tracking-tight">
            {t("subscription.welcome.title", { plan: name })}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("subscription.welcome.body", { name: account.user.name || account.user.email })}
          </p>
          <ul className="flex w-full flex-col gap-3 rounded-2xl bg-muted/50 p-4 text-start">
            <Perk
              icon={FlashIcon}
              text={t("subscription.welcome.credits", {
                count: account.account.credits.included,
                formatted: account.account.credits.included.toLocaleString(i18n.language),
              })}
            />
            <Perk
              icon={CloudIcon}
              text={t("subscription.welcome.storage", {
                size: Math.round(account.account.storage.included / 1024 ** 3),
              })}
            />
            <Perk icon={RefreshIcon} text={t("subscription.welcome.sync")} />
            <Perk icon={Key01Icon} text={t("subscription.welcome.keys")} />
          </ul>
        </div>
        <Dialog.Footer>
          <Button variant="secondary" onClick={close}>
            {t("subscription.welcome.later")}
          </Button>
          <Button
            onClick={() => {
              if (preview) {
                toast(t("subscription.previewAction"));
                close();
                return;
              }
              void updateSettings(
                (saved) =>
                  void (saved.model = { provider: "bettervault", modelId: "better-vault" }),
              );
              close();
            }}
          >
            {t("subscription.welcome.use")}
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  );
}

/** One thing the plan includes, with its icon, as in Settings → Subscription. */
function Perk({ icon, text }: { icon: IconSvgElement; text: string }) {
  return (
    <li className="flex items-center gap-3 text-sm">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-background text-foreground">
        <Icon icon={icon} size={15} />
      </span>
      {text}
    </li>
  );
}
