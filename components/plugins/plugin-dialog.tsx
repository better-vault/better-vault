import {
  Alert02Icon,
  ArrowLeft01Icon,
  Delete02Icon,
  Github01Icon,
  Loading03Icon,
} from "@hugeicons/core-free-icons";
import { useState, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Icon } from "@/components/icon";
import { Alert } from "@/components/panelui/alert";
import { Button } from "@/components/panelui/button";
import { Dialog } from "@/components/panelui/dialog";
import { Switch } from "@/components/panelui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { removePlugin, setPluginEnabled, usePlugins } from "@/lib/db/plugins";
import type { Plugin } from "@/lib/db/types";
import { fetchBundle, installConfirmed } from "@/lib/plugins/directory";
import type { PluginBundle, PluginManifest, PluginPermission } from "@/lib/plugins/manifest";
import { REGISTRY_WEB, type RegistryEntry } from "@/lib/plugins/registry";
import { cn } from "@/lib/utils";
import { pluginIconSet } from "./plugin-icons";

/**
 * One dialog for a plugin, wherever it was chosen (the Plugins sheet, the
 * directory): what it is and adds, a third-party warning, and what it may
 * read or change. Installing always goes through a confirm step with the
 * warning again. An installed plugin can be turned on or off, or uninstalled,
 * which puts the app back as it was. Rendered at the app's root (it is not
 * inside the sheet), so it stays open over it.
 */
type Target =
  | { kind: "registry"; entry: RegistryEntry }
  | { kind: "installed"; id: string }
  | { kind: "file"; bundle: PluginBundle; fileName: string };

let current: Target | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

export function openPluginDialog(target: Target) {
  current = target;
  emit();
}
function closePluginDialog() {
  current = null;
  emit();
}
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function PluginDialogs() {
  const target = useSyncExternalStore(
    subscribe,
    () => current,
    () => null,
  );
  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && closePluginDialog()}>
      {target ? <PluginDialogContent key={keyOf(target)} target={target} /> : null}
    </Dialog>
  );
}

const keyOf = (target: Target) =>
  target.kind === "registry"
    ? `r:${target.entry.id}`
    : target.kind === "installed"
      ? `i:${target.id}`
      : `f:${target.fileName}`;

function PluginDialogContent({ target }: { target: Target }) {
  const { t } = useTranslation("settings");
  const { t: tCommon } = useTranslation();
  const plugins = usePlugins();
  const id =
    target.kind === "registry"
      ? target.entry.id
      : target.kind === "installed"
        ? target.id
        : target.bundle.manifest.id;
  const installed = plugins?.find((plugin) => plugin.id === id);
  const [bundle, setBundle] = useState<PluginBundle | null>(
    target.kind === "file" ? target.bundle : null,
  );
  const manifest: Pick<
    PluginManifest,
    "name" | "version" | "description" | "author" | "icon" | "permissions" | "tags"
  > | null =
    bundle?.manifest ??
    installed?.manifest ??
    (target.kind === "registry" ? { ...target.entry } : null);
  const [step, setStep] = useState<"details" | "confirm">("details");
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [turnOn, setTurnOn] = useState(true);
  const [chosen, setChosen] = useState<PluginPermission[]>(manifest?.permissions ?? []);

  if (!manifest) return null;
  const updatable =
    target.kind === "registry" && installed && installed.manifest.version !== target.entry.version;

  async function startInstall() {
    setBusy(true);
    try {
      if (!bundle && target.kind === "registry") setBundle(await fetchBundle(target.entry));
      setStep("confirm");
    } catch (error) {
      toast.error(
        t("plugins.dialog.downloadFailed", { error: String((error as Error).message ?? error) }),
      );
    } finally {
      setBusy(false);
    }
  }

  async function install() {
    if (!bundle) return;
    setBusy(true);
    try {
      const plugin = await installConfirmed(bundle, { turnOn, granted: chosen });
      toast.success(
        turnOn
          ? t("plugins.dialog.installedOn", { name: plugin.manifest.name })
          : t("plugins.installed", { name: plugin.manifest.name }),
      );
      closePluginDialog();
    } finally {
      setBusy(false);
    }
  }

  const adds = describeAdds(installed?.manifest ?? bundle?.manifest, target, t);

  return (
    <Dialog.Content size="md" closeLabel={tCommon("actions.close")}>
      <Dialog.Header
        title={
          <span className="flex items-center gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-muted">
              <Icon icon={pluginIconSet[manifest.icon]} size={20} />
            </span>
            <span className="min-w-0">
              <span className="block truncate">{manifest.name}</span>
              <span className="block truncate text-xs font-normal text-muted-foreground">
                {t("plugins.dialog.meta", {
                  version: manifest.version,
                  author: manifest.author || t("plugins.dialog.unknownAuthor"),
                })}
              </span>
            </span>
          </span>
        }
      />
      <Dialog.Body>
        <div className="flex flex-col gap-4">
          <Alert tone={target.kind === "file" ? "destructive" : "warning"} variant="plain">
            <Alert.Icon>
              <Icon icon={Alert02Icon} />
            </Alert.Icon>
            <Alert.Title>
              {target.kind === "file"
                ? t("plugins.dialog.unverifiedTitle")
                : t("plugins.dialog.thirdPartyTitle")}
            </Alert.Title>
            <Alert.Description>
              {target.kind === "file"
                ? t("plugins.dialog.unverifiedBody")
                : t("plugins.dialog.thirdPartyBody")}
            </Alert.Description>
          </Alert>

          {step === "details" ? (
            <>
              {manifest.description ? (
                <p className="text-sm text-pretty">{manifest.description}</p>
              ) : null}
              {manifest.tags.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {manifest.tags.map((tag) => (
                    <span key={tag} className="rounded-full bg-muted px-2 py-0.5 text-xs">
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}
              {adds.length ? (
                <section>
                  <h3 className="mb-1.5 text-xs font-medium text-muted-foreground">
                    {t("plugins.dialog.adds")}
                  </h3>
                  <ul className="flex flex-col gap-1 text-sm">
                    {adds.map((line) => (
                      <li key={line}>· {line}</li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-pretty">
              {t("plugins.dialog.confirmBody", { name: manifest.name })}
            </p>
          )}

          <section>
            <h3 className="mb-1.5 text-xs font-medium text-muted-foreground">
              {installed?.enabled ? t("plugins.granted") : t("plugins.asks")}
            </h3>
            {manifest.permissions.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("plugins.noPermissions")}</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {manifest.permissions.map((permission) => {
                  const locked = installed?.enabled === true || (step === "details" && !installed);
                  const ticked = installed?.enabled
                    ? installed.granted.includes(permission)
                    : chosen.includes(permission);
                  return (
                    <li key={permission}>
                      <label
                        className={cn(
                          "flex items-center gap-2 text-sm",
                          locked ? "cursor-default" : "cursor-pointer",
                          (permission.startsWith("write:") || permission === "use:ai") &&
                            "font-medium",
                        )}
                      >
                        <Checkbox
                          checked={ticked}
                          disabled={locked}
                          onCheckedChange={(checked) =>
                            setChosen((list) =>
                              checked
                                ? [...new Set([...list, permission])]
                                : list.filter((each) => each !== permission),
                            )
                          }
                        />
                        {t(`plugins.permissions.${permission.replace(":", "_") as "read_notes"}`)}
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {step === "confirm" ? (
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                checked={turnOn}
                onCheckedChange={(checked) => setTurnOn(checked === true)}
              />
              {t("plugins.dialog.turnOnNow")}
            </label>
          ) : null}

          {target.kind === "registry" ? (
            <a
              href={`${REGISTRY_WEB}/tree/main/plugins/${target.entry.id}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              <Icon icon={Github01Icon} size={14} />
              {t("plugins.dialog.source")}
            </a>
          ) : null}
        </div>
      </Dialog.Body>
      <Dialog.Footer>
        {installed && step === "details" && !updatable ? (
          removing ? (
            <>
              <span className="me-auto text-sm text-muted-foreground">
                {t("plugins.dialog.uninstallAsk")}
              </span>
              <Button variant="ghost" onClick={() => setRemoving(false)}>
                {t("plugins.keep")}
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  void removePlugin(installed.id).then(() => {
                    toast.success(
                      t("plugins.dialog.uninstalled", { name: installed.manifest.name }),
                    );
                    closePluginDialog();
                  });
                }}
              >
                {t("plugins.dialog.uninstall")}
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" className="me-auto" onClick={() => setRemoving(true)}>
                <Icon icon={Delete02Icon} size={15} />
                {t("plugins.dialog.uninstall")}
              </Button>
              <InstalledSwitch plugin={installed} chosen={chosen} />
            </>
          )
        ) : step === "details" ? (
          <>
            <Dialog.Close render={<Button variant="ghost" />}>
              {tCommon("actions.cancel")}
            </Dialog.Close>
            <Button disabled={busy} onClick={() => void startInstall()}>
              {busy ? <Icon icon={Loading03Icon} size={15} className="animate-spin" /> : null}
              {updatable ? t("plugins.dialog.update") : t("plugins.dialog.install")}
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" className="me-auto" onClick={() => setStep("details")}>
              <Icon icon={ArrowLeft01Icon} size={15} className="rtl:rotate-180" />
              {t("plugins.dialog.back")}
            </Button>
            <Button disabled={busy || !bundle} onClick={() => void install()}>
              {busy ? <Icon icon={Loading03Icon} size={15} className="animate-spin" /> : null}
              {t("plugins.dialog.installConfirm")}
            </Button>
          </>
        )}
      </Dialog.Footer>
    </Dialog.Content>
  );
}

function InstalledSwitch({ plugin, chosen }: { plugin: Plugin; chosen: PluginPermission[] }) {
  const { t } = useTranslation("settings");
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      {plugin.enabled ? t("plugins.dialog.on") : t("plugins.dialog.off")}
      <Switch
        aria-label={t("plugins.toggle", { name: plugin.manifest.name })}
        checked={plugin.enabled}
        onCheckedChange={(enabled) => void setPluginEnabled(plugin.id, enabled, chosen)}
      />
    </label>
  );
}

function describeAdds(
  manifest: PluginManifest | undefined,
  target: Target,
  t: ReturnType<typeof useTranslation<"settings">>["t"],
): string[] {
  if (manifest) {
    const { panels, mods, theme } = manifest.contributes;
    return [
      ...panels
        .filter((panel) => panel.slot === "studio-tool")
        .map((panel) => t("plugins.dialog.addsTool", { name: panel.title })),
      ...panels
        .filter((panel) => panel.slot === "studio")
        .map((panel) => t("plugins.dialog.addsPanel", { name: panel.title })),
      ...(mods ?? []).map((mod) => t("plugins.dialog.addsMod", { name: mod.title })),
      ...(theme ? [t("plugins.dialog.addsTheme")] : []),
    ];
  }
  if (target.kind !== "registry") return [];
  const { adds } = target.entry;
  return [
    ...(adds.studioTools ? [t("plugins.dialog.countTools", { count: adds.studioTools })] : []),
    ...(adds.panels ? [t("plugins.dialog.countPanels", { count: adds.panels })] : []),
    ...(adds.mods ? [t("plugins.dialog.countMods", { count: adds.mods })] : []),
    ...(adds.theme ? [t("plugins.dialog.addsTheme")] : []),
  ];
}
