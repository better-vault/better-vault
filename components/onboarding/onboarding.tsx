import {
  ArrowLeft01Icon,
  Calendar03Icon,
  Camera01Icon,
  Clock01Icon,
  GoogleIcon,
  GridViewIcon,
  Mail01Icon,
  MagicWand01Icon,
  Note01Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Avatar } from "@/components/account/avatar";
import { Logo } from "@/components/brand/logo";
import { Field } from "@/components/common/field";
import { Icon } from "@/components/icon";
import { ProviderIcon } from "@/components/provider-icon";
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
import { updateProfile, useProfile } from "@/lib/db/profile";
import { store } from "@/lib/db/store";
import { avatarFromFile } from "@/lib/profile/avatar";
import { cn } from "@/lib/utils";

const KEY = "onboarding";
type Step = "profile" | "account" | "username" | "plan";
type Plan = "free" | "pro" | "max";

/**
 * The first screens of the app, two columns like a setup wizard: the step's
 * form on the left, and on the right a small better-vault window that fills
 * in with what is typed (name, picture, username, plan). The account is
 * optional at every step: the app works fully on this device without one.
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

const finish = () => store().putSetting(KEY, { done: true, at: Date.now() });

function Onboarding() {
  const { t } = useTranslation("common");
  const account = useAccount();
  const profile = useProfile();
  const [step, setStep] = useState<Step>("profile");
  const [name, setName] = useState<string | null>(null);
  const [username, setUsernameDraft] = useState("");
  const [plan, setPlan] = useState<Plan>("free");
  const [busy, setBusy] = useState(false);
  const shownName = name ?? profile?.name ?? "";

  // The steps that apply: a username only once signed in.
  const steps: Step[] = account
    ? ["profile", "account", "username", "plan"]
    : ["profile", "account", "plan"];
  const at = Math.max(0, steps.indexOf(step));
  const back = () => setStep(steps[Math.max(0, at - 1)]);

  const saveName = async () => {
    if (name !== null && name.trim() !== (profile?.name ?? ""))
      await updateProfile({ name: name.trim() });
  };

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

  const complete = async () => {
    setBusy(true);
    try {
      await saveName();
      if (plan !== "free" && account && account.account.plan !== plan) await startCheckout(plan);
      await finish();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const skipAccount = async () => {
    await saveName();
    await finish();
  };

  return (
    <div
      role="dialog"
      aria-modal
      aria-label={t("onboarding.label")}
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-background p-4 sm:p-8"
    >
      <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl bg-card ring-1 ring-border lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        {/* The step. */}
        <div className="flex min-h-[34rem] flex-col p-6 sm:p-10">
          <header className="flex items-center gap-3">
            <Logo size={28} />
            <span className="text-sm font-semibold">better-vault</span>
            <span className="ms-auto text-xs text-muted-foreground tabular-nums">
              {t("onboarding.stepOf", { step: at + 1, total: steps.length })}
            </span>
          </header>
          <div className="mt-4 flex gap-1.5" aria-hidden>
            {steps.map((each, index) => (
              <span
                key={each}
                className={cn(
                  "h-1 flex-1 rounded-full transition-colors",
                  index <= at ? "bg-foreground" : "bg-muted",
                )}
              />
            ))}
          </div>

          <div className="flex flex-1 flex-col justify-center gap-6 py-8">
            {step === "profile" ? (
              <ProfileStep name={shownName} onName={setName} />
            ) : step === "account" ? (
              <>
                <Heading
                  title={t("onboarding.account.title")}
                  body={t("onboarding.account.body")}
                />
                <div className="flex flex-col gap-2">
                  {account ? (
                    <div className="flex items-center gap-3 rounded-2xl bg-muted/50 p-3 text-sm">
                      <Icon icon={Tick02Icon} size={18} className="text-success" />
                      {t("onboarding.account.signedIn", { email: account.user.email })}
                    </div>
                  ) : (
                    <>
                      <Button size="lg" disabled={busy} onClick={() => void signInWith("signin")}>
                        <Icon icon={GoogleIcon} size={18} />
                        {t("onboarding.account.google")}
                      </Button>
                      <Button
                        size="lg"
                        variant="outline"
                        disabled={busy}
                        onClick={() => void signInWith("signup")}
                      >
                        <Icon icon={Mail01Icon} size={18} />
                        {t("onboarding.account.email")}
                      </Button>
                    </>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{t("onboarding.account.keys")}</p>
              </>
            ) : step === "username" ? (
              <UsernameStep
                value={username}
                onChange={setUsernameDraft}
                onDone={() => setStep("plan")}
              />
            ) : (
              <>
                <Heading title={t("onboarding.plan.title")} body={t("onboarding.plan.body")} />
                <div
                  role="radiogroup"
                  aria-label={t("onboarding.plan.title")}
                  className="flex flex-wrap gap-2"
                >
                  {(["free", "pro", "max"] as const).map((each) => (
                    <button
                      key={each}
                      type="button"
                      role="radio"
                      aria-checked={plan === each}
                      onClick={() => setPlan(each)}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded-full px-4 py-2 text-sm ring-1 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        plan === each
                          ? "bg-foreground text-background ring-foreground"
                          : "ring-border hover:bg-accent",
                      )}
                    >
                      <span className="font-medium">{t(`onboarding.plan.${each}.name`)}</span>
                      <span
                        className={cn(
                          "tabular-nums",
                          plan === each ? "text-background/70" : "text-muted-foreground",
                        )}
                      >
                        {t(`onboarding.plan.${each}.price`)}
                      </span>
                    </button>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground">
                  {t(`onboarding.plan.${plan}.detail`)}
                </p>
                {plan !== "free" && !account ? (
                  <p className="rounded-2xl bg-muted/50 p-3 text-xs text-muted-foreground">
                    {t("onboarding.plan.needsAccount")}
                  </p>
                ) : null}
              </>
            )}
          </div>

          <footer className="flex items-center gap-2">
            {at > 0 ? (
              <Button variant="ghost" onClick={back} disabled={busy}>
                <Icon icon={ArrowLeft01Icon} size={16} className="rtl:rotate-180" />
                {t("onboarding.back")}
              </Button>
            ) : null}
            <button
              type="button"
              onClick={() => void skipAccount()}
              className="cursor-pointer px-2 text-sm text-muted-foreground underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:underline"
            >
              {step === "plan" ? t("onboarding.plan.later") : t("onboarding.withoutAccount")}
            </button>
            {step === "username" ? null : (
              <Button
                className="ms-auto"
                disabled={busy || (step === "plan" && plan !== "free" && !account)}
                onClick={() => {
                  if (step === "plan") return void complete();
                  if (step === "profile") void saveName();
                  setStep(steps[at + 1]);
                }}
              >
                {step === "plan"
                  ? plan === "free" || account?.account.plan === plan
                    ? t("onboarding.finish")
                    : t("onboarding.plan.subscribe", { plan: t(`onboarding.plan.${plan}.name`) })
                  : step === "account" && !account
                    ? t("onboarding.account.skip")
                    : t("onboarding.next")}
              </Button>
            )}
          </footer>
        </div>

        {/* The live preview. */}
        <Preview
          name={shownName}
          username={account?.user.username ?? (username || null)}
          email={account?.user.email ?? null}
          plan={plan}
          step={step}
        />
      </div>
    </div>
  );
}

function Heading({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

function ProfileStep({ name, onName }: { name: string; onName: (name: string) => void }) {
  const { t } = useTranslation("common");
  const profile = useProfile();
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <Heading title={t("onboarding.profile.title")} body={t("onboarding.profile.body")} />
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => input.current?.click()}
          aria-label={t("onboarding.profile.picture")}
          className="group relative cursor-pointer rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Avatar profile={profile ? { ...profile, name } : undefined} size={64} />
          <span className="absolute -end-1 -bottom-1 flex size-7 items-center justify-center rounded-full bg-foreground text-background ring-2 ring-card">
            <Icon icon={Camera01Icon} size={14} />
          </span>
        </button>
        <div className="text-sm">
          <p className="font-medium">{t("onboarding.profile.picture")}</p>
          <p className="text-xs text-muted-foreground">{t("onboarding.profile.pictureHint")}</p>
        </div>
        <input
          ref={input}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file)
              void avatarFromFile(file)
                .then((avatar) => updateProfile({ avatar }))
                .catch(() => toast.error(t("onboarding.profile.pictureFailed")));
          }}
        />
      </div>
      <Field
        label={t("onboarding.profile.name")}
        htmlFor={id}
        hint={t("onboarding.profile.nameHint")}
      >
        <Input
          id={id}
          autoFocus
          autoComplete="name"
          value={name}
          onChange={(event) => onName(event.target.value)}
        />
      </Field>
    </>
  );
}

function UsernameStep({
  value,
  onChange,
  onDone,
}: {
  value: string;
  onChange: (value: string) => void;
  onDone: () => void;
}) {
  const { t } = useTranslation("common");
  const id = useId();
  const [state, setState] = useState<"idle" | "checking" | "free" | "taken" | "invalid">("idle");
  const [saving, setSaving] = useState(false);
  const valid = /^[a-zA-Z0-9_.]{3,30}$/.test(value);

  useEffect(() => {
    if (!value) return;
    let live = true;
    const timer = setTimeout(
      () => {
        if (!valid) return setState("invalid");
        setState("checking");
        void usernameAvailable(value).then((free) => live && setState(free ? "free" : "taken"));
      },
      valid ? 350 : 0,
    );
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [value, valid]);

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        if (state !== "free") return;
        setSaving(true);
        void setUsername(value)
          .then(onDone)
          .catch((error: unknown) =>
            toast.error(error instanceof Error ? error.message : String(error)),
          )
          .finally(() => setSaving(false));
      }}
    >
      <Heading title={t("onboarding.username.title")} body={t("onboarding.username.body")} />
      <Field
        label={t("onboarding.username.label")}
        htmlFor={id}
        hint={
          !value
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
        <Input.Group>
          <Input.Addon>@</Input.Addon>
          <Input
            id={id}
            autoFocus
            autoComplete="username"
            spellCheck={false}
            value={value}
            onChange={(event) => onChange(event.target.value.trim())}
            aria-invalid={state === "invalid" || state === "taken" ? true : undefined}
          />
        </Input.Group>
      </Field>
      <Button type="submit" className="self-end" disabled={state !== "free" || saving}>
        {t("onboarding.next")}
      </Button>
    </form>
  );
}

/** A small better-vault window that fills in as the steps are answered. */
function Preview({
  name,
  username,
  email,
  plan,
  step,
}: {
  name: string;
  username: string | null;
  email: string | null;
  plan: Plan;
  step: Step;
}) {
  const { t } = useTranslation("common");
  const { t: tHome } = useTranslation("home");
  const { t: tNotes } = useTranslation("notes");
  const profile = useProfile();
  const paid = plan !== "free";
  const focus = (what: Step) => (step === what ? "ring-2 ring-primary/60" : "ring-0");
  return (
    <div
      className="relative hidden items-center justify-center overflow-hidden border-s bg-muted/40 p-10 lg:flex"
      aria-hidden
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-background shadow-xl ring-1 ring-border transition-transform duration-500">
        <div className="flex h-8 items-center gap-1.5 border-b px-3">
          <span className="size-2.5 rounded-full bg-muted-foreground/30" />
          <span className="size-2.5 rounded-full bg-muted-foreground/30" />
          <span className="size-2.5 rounded-full bg-muted-foreground/30" />
        </div>
        <div className="flex h-72">
          <div className="flex w-40 shrink-0 flex-col gap-3 border-e bg-muted/40 p-3">
            <div
              className={cn(
                "flex items-center gap-2 rounded-xl p-1.5 transition-shadow",
                focus("profile"),
                focus("username"),
              )}
            >
              <Avatar profile={profile ? { ...profile, name } : undefined} size={26} />
              <span className="min-w-0">
                <span className="block truncate text-xs font-semibold">
                  {name || t("onboarding.preview.you")}
                </span>
                <span className="block truncate text-[0.625rem] text-muted-foreground">
                  {username ? `@${username}` : (email ?? t("onboarding.preview.thisDevice"))}
                </span>
              </span>
            </div>
            <div className="flex flex-col gap-0.5 text-[0.6875rem]">
              <span className="px-1.5 pb-0.5 text-[0.625rem] text-muted-foreground">
                {tHome("vaults.library")}
              </span>
              {[
                [Clock01Icon, tHome("vaults.recent")],
                [GridViewIcon, tHome("vaults.all")],
                [Note01Icon, tNotes("title")],
                [MagicWand01Icon, tNotes("skillsTitle")],
                [Calendar03Icon, tHome("calendar.title")],
              ].map(([icon, label], index) => (
                <span
                  key={String(label)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-1.5 py-1",
                    index === 1 && "bg-foreground/10 font-medium",
                  )}
                >
                  <Icon
                    icon={icon as typeof Clock01Icon}
                    size={12}
                    className="text-muted-foreground"
                  />
                  {label as string}
                </span>
              ))}
            </div>
          </div>
          <div className="flex min-w-0 flex-1 flex-col justify-between p-3">
            <div className="grid grid-cols-3 gap-2">
              {[0, 1, 2].map((each) => (
                <span
                  key={each}
                  className="flex aspect-square items-center justify-center rounded-xl bg-muted"
                >
                  <span className="size-5 rounded-md bg-muted-foreground/20" />
                </span>
              ))}
            </div>
            <div
              className={cn(
                "flex items-center gap-2 rounded-2xl bg-card p-2 ring-1 ring-border transition-shadow",
                step === "plan" && "ring-2 ring-primary/60",
              )}
            >
              <span className="flex-1 truncate text-[0.6875rem] text-muted-foreground">
                {t("onboarding.preview.ask")}
              </span>
              <span
                key={plan}
                className="flex animate-in items-center gap-1 rounded-full bg-muted px-2 py-1 text-[0.625rem] font-medium duration-300 zoom-in-95 fade-in"
              >
                {paid ? <ProviderIcon provider="bettervault" size={12} /> : null}
                {paid ? t("onboarding.preview.betterVault") : t("onboarding.preview.ownKey")}
              </span>
            </div>
          </div>
        </div>
      </div>
      <p className="absolute inset-x-10 bottom-6 text-center text-xs text-muted-foreground">
        {t(`onboarding.preview.caption.${step}`)}
      </p>
    </div>
  );
}
