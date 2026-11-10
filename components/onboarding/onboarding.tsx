import { CheckmarkCircle02Icon, GoogleIcon, Mail01Icon } from "@hugeicons/core-free-icons";
import { useEffect, useId, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Logo } from "@/components/brand/logo";
import { Field } from "@/components/common/field";
import { Icon } from "@/components/icon";
import { Button } from "@/components/panelui/button";
import { Input } from "@/components/panelui/input";
import {
  setUsername,
  signIn,
  startCheckout,
  useAccount,
  usernameAvailable,
} from "@/lib/account/account";
import { useStoreQuery } from "@/lib/db/live";
import { updateProfile } from "@/lib/db/profile";
import { store } from "@/lib/db/store";
import { cn } from "@/lib/utils";

const KEY = "onboarding";
type Step = "intro" | "account" | "username" | "plan" | "local";

/**
 * The first screens of the app: what better-vault is, then an optional
 * account (Google or email, then a username, then a plan). "Continue
 * without an account" is at the foot of every step: the app works fully on
 * this device without one.
 */
export function OnboardingGate() {
  const done = useStoreQuery(
    async () => ((await store().getSetting(KEY)) as { done?: boolean } | undefined)?.done === true,
    [],
    ["settings"],
  );
  if (done !== false) return null;
  return <Onboarding />;
}

function finish() {
  return store().putSetting(KEY, { done: true, at: Date.now() });
}

function Onboarding() {
  const { t } = useTranslation("common");
  const account = useAccount();
  const [step, setStep] = useState<Step>("intro");
  const [busy, setBusy] = useState(false);

  const signInWith = async (mode: "signin" | "signup") => {
    setBusy(true);
    try {
      const state = await signIn(mode);
      setStep(state.user.username ? "plan" : "username");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message !== "cancelled")
        toast.error(message === "popup-blocked" ? t("onboarding.popupBlocked") : message);
    } finally {
      setBusy(false);
    }
  };

  const steps: Step[] = ["intro", "account", "username", "plan"];
  const at = steps.indexOf(step);

  return (
    <div
      role="dialog"
      aria-modal
      aria-label={t("onboarding.label")}
      className="fixed inset-0 z-50 flex items-center justify-center bg-background p-4"
    >
      <div className="flex w-full max-w-md flex-col gap-6">
        {at >= 0 ? (
          <div className="flex justify-center gap-1.5" aria-hidden>
            {steps.map((each, index) => (
              <span
                key={each}
                className={cn("h-1 w-8 rounded-full", index <= at ? "bg-foreground" : "bg-muted")}
              />
            ))}
          </div>
        ) : null}

        {step === "intro" ? (
          <Panel>
            <Logo size={56} className="self-center" />
            <h1 className="text-center text-2xl font-semibold tracking-tight">
              {t("onboarding.intro.title")}
            </h1>
            <p className="text-center text-sm text-muted-foreground">
              {t("onboarding.intro.body")}
            </p>
            <ul className="flex flex-col gap-2 text-sm">
              {(["local", "models", "notes"] as const).map((point) => (
                <li key={point} className="flex gap-2">
                  <Icon
                    icon={CheckmarkCircle02Icon}
                    size={18}
                    className="mt-0.5 shrink-0 text-success"
                  />
                  {t(`onboarding.intro.points.${point}`)}
                </li>
              ))}
            </ul>
            <Button size="lg" onClick={() => setStep("account")}>
              {t("onboarding.next")}
            </Button>
          </Panel>
        ) : step === "account" ? (
          <Panel>
            <h1 className="text-center text-2xl font-semibold tracking-tight">
              {t("onboarding.account.title")}
            </h1>
            <p className="text-center text-sm text-muted-foreground">
              {t("onboarding.account.body")}
            </p>
            <Button size="lg" disabled={busy} onClick={() => void signInWith("signin")}>
              <Icon icon={GoogleIcon} size={18} />
              {t("onboarding.account.google")}
            </Button>
            <Button
              size="lg"
              variant="secondary"
              disabled={busy}
              onClick={() => void signInWith("signup")}
            >
              <Icon icon={Mail01Icon} size={18} />
              {t("onboarding.account.email")}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              {t("onboarding.account.keys")}
            </p>
          </Panel>
        ) : step === "username" ? (
          <UsernameStep onDone={() => setStep("plan")} />
        ) : step === "plan" ? (
          <Panel>
            <h1 className="text-center text-2xl font-semibold tracking-tight">
              {t("onboarding.plan.title")}
            </h1>
            <p className="text-center text-sm text-muted-foreground">{t("onboarding.plan.body")}</p>
            <div className="grid gap-2">
              {(["free", "pro", "max"] as const).map((plan) => (
                <button
                  key={plan}
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (plan === "free" || account?.account.plan === plan) return void finish();
                    setBusy(true);
                    void startCheckout(plan)
                      .then(finish)
                      .catch((error: unknown) =>
                        toast.error(error instanceof Error ? error.message : String(error)),
                      )
                      .finally(() => setBusy(false));
                  }}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-2xl p-4 text-start ring-1 ring-border outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring",
                    plan === "pro" && "bg-muted/50",
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">
                      {t(`onboarding.plan.${plan}.name`)}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {t(`onboarding.plan.${plan}.detail`)}
                    </span>
                  </span>
                  <span className="text-sm font-semibold tabular-nums">
                    {t(`onboarding.plan.${plan}.price`)}
                  </span>
                </button>
              ))}
            </div>
            <Button variant="ghost" onClick={() => void finish()}>
              {t("onboarding.plan.later")}
            </Button>
          </Panel>
        ) : (
          <>
            <LocalStep />
            <button
              type="button"
              onClick={() => setStep("account")}
              className="cursor-pointer self-center text-sm text-muted-foreground underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:underline"
            >
              {t("onboarding.local.back")}
            </button>
          </>
        )}

        {step !== "local" && step !== "plan" ? (
          <button
            type="button"
            onClick={() => setStep("local")}
            className="cursor-pointer self-center text-sm text-muted-foreground underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:underline"
          >
            {t("onboarding.withoutAccount")}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function Panel({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 rounded-3xl bg-card p-6 ring-1 ring-border">{children}</div>
  );
}

function UsernameStep({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation("common");
  const id = useId();
  const [name, setName] = useState("");
  const [state, setState] = useState<"idle" | "checking" | "free" | "taken" | "invalid">("idle");
  const [saving, setSaving] = useState(false);
  const valid = /^[a-zA-Z0-9_.]{3,30}$/.test(name);

  useEffect(() => {
    if (!name) return;
    if (!valid) {
      const timer = setTimeout(() => setState("invalid"), 0);
      return () => clearTimeout(timer);
    }
    let live = true;
    const timer = setTimeout(() => {
      setState("checking");
      void usernameAvailable(name).then((free) => live && setState(free ? "free" : "taken"));
    }, 350);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [name, valid]);

  return (
    <Panel>
      <h1 className="text-center text-2xl font-semibold tracking-tight">
        {t("onboarding.username.title")}
      </h1>
      <p className="text-center text-sm text-muted-foreground">{t("onboarding.username.body")}</p>
      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (state !== "free") return;
          setSaving(true);
          void setUsername(name)
            .then(onDone)
            .catch((error: unknown) =>
              toast.error(error instanceof Error ? error.message : String(error)),
            )
            .finally(() => setSaving(false));
        }}
      >
        <Field
          label={t("onboarding.username.label")}
          htmlFor={id}
          hint={
            !name
              ? t("onboarding.username.hint")
              : state === "invalid"
                ? t("onboarding.username.invalid")
                : state === "taken"
                  ? t("onboarding.username.taken")
                  : state === "free"
                    ? t("onboarding.username.free")
                    : t("onboarding.username.checking")
          }
        >
          <Input
            id={id}
            autoFocus
            autoComplete="username"
            spellCheck={false}
            value={name}
            onChange={(event) => setName(event.target.value.trim())}
            aria-invalid={state === "invalid" || state === "taken" ? true : undefined}
          />
        </Field>
        <Button size="lg" type="submit" disabled={state !== "free" || saving}>
          {t("onboarding.next")}
        </Button>
      </form>
    </Panel>
  );
}

function LocalStep() {
  const { t } = useTranslation("common");
  const id = useId();
  const [name, setName] = useState("");
  return (
    <Panel>
      <h1 className="text-center text-2xl font-semibold tracking-tight">
        {t("onboarding.local.title")}
      </h1>
      <p className="text-center text-sm text-muted-foreground">{t("onboarding.local.body")}</p>
      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          void (async () => {
            if (name.trim()) await updateProfile({ name: name.trim() });
            await finish();
          })();
        }}
      >
        <Field label={t("onboarding.local.name")} htmlFor={id} hint={t("onboarding.local.hint")}>
          <Input
            id={id}
            autoFocus
            autoComplete="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
        <Button size="lg" type="submit">
          {t("onboarding.local.start")}
        </Button>
      </form>
    </Panel>
  );
}
