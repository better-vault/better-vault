import {
  Add01Icon,
  AiBrain01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  CloudServerIcon,
  FolderAddIcon,
  PaintBoardIcon,
  Search01Icon,
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
import { Button } from "@/components/panelui/button";
import { Input } from "@/components/panelui/input";
import {
  setUsername,
  signIn,
  startCheckout,
  subscriptionsOpen,
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
  // Paid plans can't be chosen until the backend opens them.
  const open = subscriptionsOpen(account);
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
      if (open && plan !== "free" && account && account.account.plan !== plan)
        await startCheckout(plan);
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
                      disabled={each !== "free" && !open}
                      onClick={() => setPlan(each)}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded-full px-4 py-2 text-sm ring-1 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:opacity-60",
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
                        {each !== "free" && !open
                          ? t("onboarding.plan.soon")
                          : t(`onboarding.plan.${each}.price`)}
                      </span>
                    </button>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground">
                  {t(`onboarding.plan.${plan}.detail`)}
                </p>
                {!open ? (
                  <p className="rounded-2xl bg-muted/50 p-3 text-xs text-muted-foreground">
                    {t("onboarding.plan.soonHint")}
                  </p>
                ) : plan !== "free" && !account ? (
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

const PAGE_W = 820;
const PAGE_H = 600;

/**
 * The real notebooks page, drawn small, with the Settings sheet open as it
 * really is: its Account row shows the name, picture and username typed,
 * its Subscription row the plan chosen. Same classes as the live
 * components (vault-sidebar, home-cards, settings-row), scaled to fit.
 */
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
  const { t: tSettings } = useTranslation("settings");
  const profile = useProfile();
  const frame = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.4);
  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setScale(entry.contentRect.width / PAGE_W));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const row =
    "relative flex h-8 w-full min-w-0 items-center gap-2.5 rounded-xl px-2.5 text-start text-sm";
  const lit = (on: boolean) => (on ? "ring-2 ring-primary/70" : "");
  const tiles = [
    { title: tHome("untitled"), tint: "bg-chart-2/15 text-chart-2" },
    { title: tNotes("title"), tint: "bg-chart-3/15 text-chart-3" },
    { title: tHome("folders.untitled"), tint: "bg-chart-4/15 text-chart-4" },
  ];
  return (
    <div
      className="relative hidden flex-col justify-center gap-4 border-s bg-muted/40 p-6 lg:flex"
      aria-hidden
    >
      <div
        ref={frame}
        className="relative w-full overflow-hidden rounded-2xl shadow-2xl ring-1 ring-border"
        style={{ aspectRatio: `${PAGE_W} / ${PAGE_H}` }}
      >
        <div
          className="pointer-events-none absolute start-0 top-0 flex origin-top-left bg-background select-none rtl:origin-top-right"
          style={{ width: PAGE_W, height: PAGE_H, transform: `scale(${scale})` }}
        >
          {/* The sidebar, as in components/home/vault-sidebar.tsx. */}
          <aside className="m-2 me-0 flex w-60 shrink-0 flex-col rounded-3xl bg-muted/60 ring-1 ring-border/60">
            <div className="flex h-14 shrink-0 items-center gap-2.5 px-4">
              <Logo size={24} />
              <span className="truncate text-sm font-semibold">{tHome("vaults.appTitle")}</span>
            </div>
            <nav className="flex flex-col gap-5 px-2 pb-3">
              <section className="flex flex-col gap-0.5">
                <h2 className="px-2.5 pb-1 text-xs font-medium text-muted-foreground">
                  {tHome("vaults.library")}
                </h2>
                {(
                  [
                    [Clock01Icon, tHome("vaults.recent")],
                    [GridViewIcon, tHome("vaults.all")],
                    [Note01Icon, tNotes("title")],
                    [MagicWand01Icon, tNotes("skillsTitle")],
                    [Calendar03Icon, tHome("calendar.title")],
                  ] as const
                ).map(([icon, label], index) => (
                  <span
                    key={label}
                    className={cn(row, index === 1 && "bg-foreground/10 font-medium")}
                  >
                    <Icon icon={icon} size={18} className="text-muted-foreground" />
                    {label}
                  </span>
                ))}
              </section>
              <section className="flex flex-col gap-0.5">
                <h2 className="px-2.5 pb-1 text-xs font-medium text-muted-foreground">
                  {tHome("vaults.label")}
                </h2>
                <span className={cn(row, "font-medium")}>
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <Icon icon={Note01Icon} size={14} />
                  </span>
                  {tHome("vaults.default")}
                </span>
              </section>
            </nav>
          </aside>

          {/* The page, as in components/home/notebook-home.tsx. */}
          <div className="flex min-w-0 flex-1 flex-col">
            <header className="flex h-16 shrink-0 items-center gap-3 px-6">
              <div className="flex h-10 items-center gap-0.5 rounded-full bg-card px-1 ring-1 ring-border">
                <span className="flex size-8 items-center justify-center text-muted-foreground">
                  <Icon icon={ArrowLeft01Icon} size={18} />
                </span>
                <span className="flex size-8 items-center justify-center text-muted-foreground">
                  <Icon icon={ArrowRight01Icon} size={18} />
                </span>
              </div>
              <h1 className="min-w-0 flex-1 truncate text-lg font-semibold tracking-tight">
                {tHome("vaults.default")}
              </h1>
              <div className="flex h-10 items-center gap-0.5 rounded-full bg-card px-1 ring-1 ring-border">
                {[GridViewIcon, Add01Icon, FolderAddIcon].map((icon, index) => (
                  <span
                    key={index}
                    className="flex size-8 items-center justify-center text-muted-foreground"
                  >
                    <Icon icon={icon} size={18} />
                  </span>
                ))}
              </div>
              <span className="flex size-10 items-center justify-center rounded-full bg-card text-muted-foreground ring-1 ring-border">
                <Icon icon={Search01Icon} size={18} />
              </span>
            </header>
            <main className="grid grid-cols-5 gap-2 px-6 pt-2">
              {tiles.map((tile) => (
                <div
                  key={tile.title}
                  className="flex flex-col items-center gap-2 rounded-2xl px-2 pt-4 pb-3 text-center"
                >
                  <span
                    className={cn(
                      "flex size-20 items-center justify-center rounded-[1.375rem]",
                      tile.tint,
                    )}
                  >
                    <Icon icon={Note01Icon} size={34} />
                  </span>
                  <span className="w-full truncate text-sm font-medium">{tile.title}</span>
                </div>
              ))}
            </main>
          </div>

          {/* Settings, open over the page, as in components/settings/settings-sheet.tsx. */}
          <div className="absolute start-3 top-3 bottom-3 flex w-[26rem] flex-col rounded-[1.75rem] bg-card p-6 shadow-2xl ring-1 ring-border">
            <h2 className="text-lg font-semibold">{tSettings("title")}</h2>
            <p className="pb-4 text-sm text-muted-foreground">{tSettings("description")}</p>
            <div className="-mx-2 flex flex-col gap-0.5">
              <SheetRow
                className={lit(step === "profile" || step === "username")}
                icon={<Avatar profile={profile ? { ...profile, name } : undefined} size={36} />}
                label={name || tSettings("rows.account")}
                hint={
                  username
                    ? `@${username}`
                    : (email ??
                      (name ? tSettings("rows.accountHint") : tSettings("rows.accountSetUp")))
                }
              />
              <SheetRow
                className={lit(step === "account" || step === "plan")}
                icon={<Logo size={22} />}
                label={tSettings("rows.subscription")}
                hint={
                  plan === "free"
                    ? tSettings("rows.subscriptionNone")
                    : tSettings("rows.subscriptionPlan", {
                        plan: tSettings(`subscription.plans.${plan}`),
                      })
                }
              />
              <SheetRow
                icon={<Icon icon={AiBrain01Icon} />}
                label={tSettings("rows.providers")}
                hint={
                  plan === "free"
                    ? tSettings("rows.providersNone")
                    : t("onboarding.preview.betterVault")
                }
              />
              <SheetRow
                icon={<Icon icon={CloudServerIcon} />}
                label={tSettings("rows.storage")}
                hint={tSettings("rows.storageNone")}
              />
              <SheetRow
                icon={<Icon icon={PaintBoardIcon} />}
                label={tSettings("rows.appearance")}
              />
            </div>
          </div>
        </div>
      </div>
      <p className="text-center text-xs text-muted-foreground">
        {t(`onboarding.preview.caption.${step}`)}
      </p>
    </div>
  );
}

/** A Settings row, drawn as components/settings/settings-row.tsx draws it. */
function SheetRow({
  icon,
  label,
  hint,
  className,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex w-full items-center gap-3 rounded-2xl px-2.5 py-2.5 transition-shadow",
        className,
      )}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{label}</span>
        {hint ? <span className="block truncate text-xs text-muted-foreground">{hint}</span> : null}
      </span>
      <Icon
        icon={ArrowRight01Icon}
        size={16}
        className="shrink-0 text-muted-foreground rtl:rotate-180"
      />
    </div>
  );
}
