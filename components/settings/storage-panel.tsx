import { Loading03Icon, ViewIcon, ViewOffIcon } from "@hugeicons/core-free-icons";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Field } from "@/components/common/field";
import { Icon } from "@/components/icon";
import { Button } from "@/components/panelui/button";
import { Input } from "@/components/panelui/input";
import { Sheet } from "@/components/panelui/sheet";
import { desktopBridge } from "@/lib/desktop/bridge";
import { oauthConfigured } from "@/lib/storage/apps";
import { connect, disconnect } from "@/lib/storage/auth";
import { storageIds, storages, type StorageField, type StorageId } from "@/lib/storage/catalog";
import { testS3 } from "@/lib/storage/clients/s3";
import {
  isStorageReady,
  updateStorage,
  useStorageSettings,
  type StorageSettings,
} from "@/lib/storage/settings";
import { cn } from "@/lib/utils";
import { SettingsRow } from "./settings-row";

/** A storage service's logo, in its own colours. */
export function StorageLogo({ id, size = 20 }: { id: StorageId; size?: number }) {
  return (
    <img src={storages[id].logo} alt="" width={size} height={size} className="object-contain" />
  );
}

/** Settings → Storage: the services; each opens its own sheet. */
export function StoragePanel() {
  const { t } = useTranslation("settings");
  const { t: tCommon } = useTranslation();
  const settings = useStorageSettings();

  return (
    <>
      <Sheet.Header title={t("storage.title")} description={t("storage.description")} />
      <Sheet.Body>
        <div className="-mx-2 flex flex-col gap-0.5">
          {storageIds.map((id) => {
            const ready = settings ? isStorageReady(settings, id) : false;
            const account = settings?.[id].account;
            if (storages[id].soon)
              return (
                <div
                  key={id}
                  aria-disabled
                  className="flex w-full items-center gap-3 rounded-2xl px-2.5 py-2.5 opacity-60"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted">
                    <StorageLogo id={id} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{storages[id].name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {t("storage.soonHint")}
                    </span>
                  </span>
                  <span className="rounded-md border border-border px-1.5 py-0.5 text-xs text-muted-foreground">
                    {t("storage.soon")}
                  </span>
                </div>
              );
            return (
              <SettingsRow
                key={id}
                to="storage-service"
                payload={id}
                icon={<StorageLogo id={id} />}
                label={storages[id].name}
                hint={
                  ready
                    ? account?.email || account?.name || t("storage.connected")
                    : t("storage.notConnected")
                }
                end={
                  <span
                    aria-hidden
                    className={cn(
                      "size-2 rounded-full",
                      ready ? "bg-success" : "bg-muted-foreground/30",
                    )}
                  />
                }
              />
            );
          })}
        </div>
      </Sheet.Body>
      <Sheet.Next name="storage-service" closeLabel={tCommon("actions.close")}>
        {(id: StorageId) => <StorageDetail id={id} />}
      </Sheet.Next>
    </>
  );
}

function StorageDetail({ id }: { id: StorageId }) {
  const settings = useStorageSettings();
  if (!settings) return null;
  return storages[id].auth === "oauth" ? (
    <OAuthDetail id={id} saved={settings[id]} />
  ) : (
    <KeysDetail id={id} saved={settings[id]} />
  );
}

/** S3 and R2: the keys and the bucket, saved as they are typed, and a check. */
function KeysDetail({ id, saved }: { id: StorageId; saved: StorageSettings }) {
  const { t } = useTranslation("settings");
  const info = storages[id];
  const [fields, setFields] = useState(saved.fields);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const complete = info.fields.every(
    (field) => field.optional || (fields[field.key] ?? "").trim() !== "",
  );

  async function test() {
    setTesting(true);
    setResult(null);
    try {
      await testS3(id as "s3" | "r2", { ...saved, fields });
      setResult({ ok: true, message: t("storage.testOk") });
    } catch (error) {
      setResult({ ok: false, message: error instanceof Error ? error.message : String(error) });
    } finally {
      setTesting(false);
    }
  }

  return (
    <>
      <Sheet.Header title={info.name} description={t(`storage.services.${id}`)} />
      <Sheet.Body>
        <div className="flex flex-col gap-5 pb-4">
          {info.fields.map((field) => (
            <KeyField
              key={field.key}
              field={field}
              value={fields[field.key] ?? ""}
              action={
                field.key === "accessKeyId" ? (
                  <a href={info.helpUrl} target="_blank" rel="noreferrer">
                    {t("storage.getKeys")}
                  </a>
                ) : null
              }
              onChange={(value) => {
                const next = { ...fields, [field.key]: value };
                setFields(next);
                setResult(null);
                void updateStorage(id, { fields: next });
              }}
            />
          ))}
          <div className="flex items-center gap-3">
            <Button variant="secondary" size="sm" disabled={!complete || testing} onClick={test}>
              {testing ? <Icon icon={Loading03Icon} size={14} className="animate-spin" /> : null}
              {t("storage.test")}
            </Button>
            {result ? (
              <p
                role="status"
                className={cn("min-w-0 text-sm", result.ok ? "text-success" : "text-destructive")}
              >
                {result.message}
              </p>
            ) : null}
          </div>
          <p className="text-xs leading-5 text-muted-foreground">{t("storage.keysPrivacy")}</p>
        </div>
      </Sheet.Body>
    </>
  );
}

function KeyField({
  field,
  value,
  action,
  onChange,
}: {
  field: StorageField;
  value: string;
  action: React.ReactNode;
  onChange: (value: string) => void;
}) {
  const { t } = useTranslation("settings");
  const id = useId();
  const [shown, setShown] = useState(false);
  const label = t(`storage.fields.${field.key}`);
  return (
    <Field
      label={field.optional ? t("storage.optional", { label }) : label}
      htmlFor={id}
      action={action}
      hint={
        field.key === "endpoint" || field.key === "prefix"
          ? t(`storage.hints.${field.key}`)
          : undefined
      }
    >
      {field.secret ? (
        <Input.Group>
          <Input
            id={id}
            type={shown ? "text" : "password"}
            autoComplete="off"
            spellCheck={false}
            value={value}
            onChange={(event) => onChange(event.target.value)}
          />
          <Input.Addon align="end">
            <button
              type="button"
              onClick={() => setShown((now) => !now)}
              aria-label={shown ? t("providers.hideKey") : t("providers.showKey")}
              className="cursor-pointer rounded p-0.5 hover:text-foreground"
            >
              <Icon icon={shown ? ViewOffIcon : ViewIcon} size={16} />
            </button>
          </Input.Addon>
        </Input.Group>
      ) : (
        <Input
          id={id}
          autoComplete="off"
          spellCheck={false}
          placeholder={field.placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </Field>
  );
}

/** The sign-in services' own marks, for the "Continue with …" button. */
const signInMarks = { google: "/storage/google.svg", microsoft: "/storage/onedrive.svg" } as const;

/**
 * Google Drive and OneDrive: the service at the centre, one "Continue with"
 * button, and once connected, who is signed in with a quiet way out.
 */
function OAuthDetail({ id, saved }: { id: StorageId; saved: StorageSettings }) {
  const { t } = useTranslation("settings");
  const info = storages[id];
  const service = info.oauth!;
  const desktop = Boolean(desktopBridge());
  const configured = oauthConfigured(service, desktop);
  const [busy, setBusy] = useState(false);
  const account = saved.account;

  async function signIn() {
    setBusy(true);
    try {
      const next = await connect(service);
      await updateStorage(id, { account: next });
      toast.success(t("storage.signedIn", { name: info.name }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    try {
      await disconnect(service);
    } finally {
      await updateStorage(id, { account: null, refreshToken: undefined });
      setBusy(false);
    }
  }

  const initials = (account?.name || account?.email || "?")
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toLocaleUpperCase())
    .join("");

  return (
    <>
      {/* The name is in the hero below; the header keeps it for screen readers. */}
      <Sheet.Header title={info.name} className="sr-only" />
      <Sheet.Body>
        <div className="flex flex-col items-center gap-6 px-2 pt-6 pb-4 text-center">
          <div className="flex flex-col items-center gap-3">
            <span className="flex size-16 items-center justify-center rounded-2xl bg-muted ring-1 ring-border">
              <StorageLogo id={id} size={36} />
            </span>
            <h2 className="text-lg font-semibold tracking-tight">{info.name}</h2>
            <p className="max-w-72 text-sm leading-6 text-muted-foreground">
              {t(`storage.services.${id}`)}
            </p>
          </div>

          {!configured ? (
            <p className="w-full rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground">
              {t("storage.notSetUp")}
            </p>
          ) : account ? (
            <div className="flex w-full flex-col items-center gap-3 rounded-2xl bg-muted/60 px-4 py-5">
              <span
                aria-hidden
                className="flex size-12 items-center justify-center rounded-full bg-background text-base font-medium ring-1 ring-border"
              >
                {initials}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{account.name || info.name}</p>
                {account.email ? (
                  <p className="truncate text-xs text-muted-foreground">{account.email}</p>
                ) : null}
              </div>
              <div className="flex items-center gap-1">
                <a
                  href={info.helpUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-md px-2 py-1 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  {t("storage.manage")}
                </a>
                <span aria-hidden className="text-xs text-muted-foreground">
                  ·
                </span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void signOut()}
                  className="cursor-pointer rounded-md px-2 py-1 text-xs text-muted-foreground underline-offset-4 hover:text-destructive hover:underline disabled:opacity-50"
                >
                  {t("storage.signOut")}
                </button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              size="lg"
              className="w-full"
              disabled={busy}
              onClick={() => void signIn()}
            >
              {busy ? (
                <Icon icon={Loading03Icon} size={18} className="animate-spin" />
              ) : (
                <img src={signInMarks[service]} alt="" width={18} height={18} />
              )}
              {t(service === "google" ? "storage.continueGoogle" : "storage.continueMicrosoft")}
            </Button>
          )}

          <p className="max-w-72 text-xs leading-5 text-muted-foreground">
            {t(
              id === "google-drive"
                ? desktop
                  ? "storage.driveDesktop"
                  : "storage.driveAccess"
                : "storage.onedriveAccess",
            )}
          </p>
        </div>
      </Sheet.Body>
    </>
  );
}
