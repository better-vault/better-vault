import {
  AiBrain01Icon,
  Camera01Icon,
  Delete02Icon,
  Logout03Icon,
  Mail01Icon,
  UserCircleIcon,
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
import { Sheet } from "@/components/panelui/sheet";
import { signIn, signOut, useAccount } from "@/lib/account/account";
import { providerIds, providers } from "@/lib/ai/catalog";
import { desktopBridge } from "@/lib/desktop/bridge";
import { useFolders } from "@/lib/db/folders";
import { useNotebookCounts, useNotebooks } from "@/lib/db/notebooks";
import { updateProfile, useProfile } from "@/lib/db/profile";
import { isProviderReady, useSettings } from "@/lib/db/settings";
import { avatarFromFile } from "@/lib/profile/avatar";
import { SettingsRow } from "./settings-row";

/**
 * Settings → Account: the name and picture this device knows you by, the
 * optional better-vault account (who is signed in, and signing out), the
 * keys connected to the app, and what is stored here. Notebooks stay on this
 * device whether or not you sign in.
 */
export function AccountPanel() {
  const { t } = useTranslation("settings");
  const profile = useProfile();
  const account = useAccount();
  const [busy, setBusy] = useState<string | null>(null);
  const settings = useSettings();
  const notebooks = useNotebooks();
  const folders = useFolders();
  const counts = useNotebookCounts();
  const fileInput = useRef<HTMLInputElement>(null);
  const nameId = useId();
  const [name, setName] = useState<string | null>(null);
  const [used, setUsed] = useState<number | null>(null);
  const desktop = Boolean(desktopBridge());

  // The browser's own estimate of what this site stores; the desktop app keeps a file instead.
  useEffect(() => {
    if (desktop || !navigator.storage?.estimate) return;
    void navigator.storage.estimate().then((estimate) => setUsed(estimate.usage ?? null));
  }, [desktop]);

  const shownName = name ?? profile?.name ?? "";
  const chatgpt = settings?.providers.openai.chatgpt ?? null;
  const ready = settings ? providerIds.filter((id) => isProviderReady(settings, id)) : [];
  const sources = counts ? [...counts.values()].reduce((sum, count) => sum + count.sources, 0) : 0;

  const user = account?.user;
  // The picture chosen here, else the one from the sign-in (Google's).
  const shownProfile = profile
    ? {
        ...profile,
        name: profile.name || user?.name || "",
        avatar: profile.avatar ?? user?.image ?? null,
      }
    : profile;

  async function run(what: string, action: () => Promise<unknown>) {
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
  }

  async function choosePicture(file: File) {
    try {
      await updateProfile({ avatar: await avatarFromFile(file) });
    } catch (error) {
      const reason = error instanceof Error ? error.message : "";
      toast.error(
        reason === "too-large" ? t("account.pictureTooLarge") : t("account.pictureFailed"),
      );
    }
  }

  return (
    <>
      <Sheet.Header title={t("account.title")} description={t("account.description")} />
      <Sheet.Body>
        <div className="flex flex-col gap-6 pb-4">
          <div className="flex flex-col items-center gap-3 pt-2 text-center">
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              aria-label={profile?.avatar ? t("account.changePicture") : t("account.addPicture")}
              className="group relative cursor-pointer rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Avatar profile={shownProfile} size={88} />
              <span className="absolute -end-0.5 -bottom-0.5 flex size-8 items-center justify-center rounded-full border-2 border-popover bg-primary text-primary-foreground transition-transform group-hover:scale-105">
                <Icon icon={Camera01Icon} size={15} />
              </span>
            </button>
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold tracking-tight">
                {shownProfile?.name || t("account.noName")}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {user
                  ? user.email
                  : desktop
                    ? t("account.onThisComputer")
                    : t("account.inThisBrowser")}
              </p>
            </div>
            {profile?.avatar ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void updateProfile({ avatar: null })}
              >
                <Icon icon={Delete02Icon} size={14} />
                {t("account.removePicture")}
              </Button>
            ) : null}
            <input
              ref={fileInput}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void choosePicture(file);
              }}
            />
          </div>

          <Field label={t("account.name")} htmlFor={nameId} hint={t("account.nameHint")}>
            <Input
              id={nameId}
              value={shownName}
              placeholder={t("account.namePlaceholder")}
              autoComplete="name"
              onChange={(event) => setName(event.target.value)}
              onBlur={() => {
                if (name !== null && name.trim() !== profile?.name)
                  void updateProfile({ name: name.trim() });
                setName(null);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
              }}
            />
          </Field>

          <section className="flex flex-col gap-2">
            <h3 className="px-0.5 text-xs font-medium text-muted-foreground">
              {t("account.betterVault")}
            </h3>
            {user ? (
              <div className="-mx-2 flex flex-col gap-0.5">
                <InfoRow icon={Mail01Icon} label={t("account.email")} value={user.email} />
                <InfoRow
                  icon={UserCircleIcon}
                  label={t("account.username")}
                  value={user.username ? `@${user.username}` : t("account.noUsername")}
                />
                <SettingsRow
                  to="subscription"
                  icon={<Logo size={20} />}
                  label={t("rows.subscription")}
                  hint={
                    account?.account.plan
                      ? t("rows.subscriptionPlan", {
                          plan: t(`subscription.plans.${account.account.plan}`),
                        })
                      : t("account.freePlan")
                  }
                />
              </div>
            ) : (
              <div className="flex flex-col gap-3 rounded-2xl bg-muted/50 p-4">
                <div className="flex items-start gap-3">
                  <Logo size={32} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{t("account.signInTitle")}</p>
                    <p className="text-xs text-muted-foreground">{t("account.signInBody")}</p>
                  </div>
                </div>
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
                    variant="outline"
                    disabled={busy !== null}
                    onClick={() => void run("signup", () => signIn("signup"))}
                  >
                    {t("subscription.createAccount")}
                  </Button>
                </div>
              </div>
            )}
          </section>

          <section className="flex flex-col gap-2">
            <h3 className="px-0.5 text-xs font-medium text-muted-foreground">
              {t("account.connected")}
            </h3>
            <div className="-mx-2 flex flex-col gap-0.5">
              <SettingsRow
                to="providers"
                icon={<ProviderIcon provider="openai" />}
                label={t("account.chatgpt")}
                hint={
                  !desktop
                    ? t("account.desktopOnly")
                    : chatgpt
                      ? chatgpt.email || chatgpt.name || t("account.signedIn")
                      : t("account.notConnected")
                }
                end={
                  chatgpt ? (
                    <span aria-hidden className="size-2 rounded-full bg-success" />
                  ) : undefined
                }
              />
              <SettingsRow
                to="providers"
                icon={AiBrain01Icon}
                label={t("account.providers")}
                hint={
                  ready.length > 0
                    ? ready.map((id) => providers[id].name).join(", ")
                    : t("rows.providersNone")
                }
              />
            </div>
          </section>

          <section className="flex flex-col gap-2">
            <h3 className="px-0.5 text-xs font-medium text-muted-foreground">
              {t("account.stored")}
            </h3>
            <dl className="grid grid-cols-3 gap-2">
              <Stat label={t("account.notebooks")} value={notebooks?.length} />
              <Stat label={t("account.folders")} value={folders?.length} />
              <Stat label={t("account.sources")} value={counts ? sources : undefined} />
            </dl>
            {used !== null ? (
              <p className="px-0.5 text-xs text-muted-foreground">
                {t("account.space", { size: formatBytes(used) })}
              </p>
            ) : null}
          </section>

          {user ? (
            <Button
              variant="destructive"
              size="lg"
              className="w-full"
              disabled={busy !== null}
              aria-busy={busy === "signout"}
              onClick={() => void run("signout", signOut)}
            >
              <Icon icon={Logout03Icon} size={18} />
              {t("account.signOut")}
            </Button>
          ) : null}
        </div>
      </Sheet.Body>
    </>
  );
}

/** A row that only shows a value, in the same shape as a settings row. */
function InfoRow({
  icon,
  label,
  value,
}: {
  icon: typeof Mail01Icon;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl px-2.5 py-2.5">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground">
        <Icon icon={icon} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{label}</span>
        <span className="block truncate text-xs text-muted-foreground">{value}</span>
      </span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div className="rounded-2xl bg-muted/60 px-3 py-2.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-lg font-semibold tabular-nums">{value ?? "–"}</dd>
    </div>
  );
}

function formatBytes(bytes: number): string {
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value < 10 && unit > 0 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
}
