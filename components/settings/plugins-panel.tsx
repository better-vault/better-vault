import { Delete02Icon, FileImportIcon, Loading03Icon } from "@hugeicons/core-free-icons";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Icon } from "@/components/icon";
import { pluginIconSet } from "@/components/plugins/plugin-icons";
import { Button } from "@/components/panelui/button";
import { Sheet } from "@/components/panelui/sheet";
import { Switch } from "@/components/panelui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { installPlugin, removePlugin, setPluginEnabled, usePlugins } from "@/lib/db/plugins";
import type { Plugin } from "@/lib/db/types";
import { parsePluginBundle, type PluginPermission } from "@/lib/plugins/manifest";
import { cn } from "@/lib/utils";

/**
 * Settings → Plugins: the plugin manager. Plugins arrive turned off, from a
 * `.bvplugin.json` file or from an agent through MCP; turning one on shows
 * what it asks to read or change, and only what stays ticked is granted.
 */
export function PluginsPanel() {
  const { t } = useTranslation("settings");
  const plugins = usePlugins();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function installFiles(files: FileList) {
    setBusy(true);
    try {
      for (const file of files) {
        let json: unknown;
        try {
          json = JSON.parse(await file.text());
        } catch {
          toast.error(t("plugins.notJson", { name: file.name }));
          continue;
        }
        const parsed = parsePluginBundle(json);
        if (!parsed.ok) {
          toast.error(t("plugins.invalid", { name: file.name, error: parsed.error }));
          continue;
        }
        const plugin = await installPlugin(parsed.bundle);
        toast.success(t("plugins.installed", { name: plugin.manifest.name }));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Sheet.Header title={t("plugins.title")} description={t("plugins.description")} />
      <Sheet.Body>
        <div className="flex flex-col gap-5 pb-4">
          <div className="flex items-center gap-3 rounded-2xl bg-muted/60 p-3">
            <p className="min-w-0 flex-1 text-xs text-muted-foreground">
              {t("plugins.installHint")}
            </p>
            <Button
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() => input.current?.click()}
            >
              <Icon
                icon={busy ? Loading03Icon : FileImportIcon}
                size={14}
                className={busy ? "animate-spin" : undefined}
              />
              {t("plugins.install")}
            </Button>
            <input
              ref={input}
              type="file"
              accept=".json,.bvplugin.json,application/json"
              multiple
              className="hidden"
              onChange={(event) => {
                if (event.target.files) void installFiles(event.target.files);
                event.target.value = "";
              }}
            />
          </div>

          {plugins && plugins.length === 0 ? (
            <div className="rounded-2xl border border-dashed px-4 py-6 text-center">
              <p className="text-sm font-medium">{t("plugins.emptyTitle")}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t("plugins.emptyBody")}</p>
            </div>
          ) : null}

          {plugins?.map((plugin) => (
            <PluginCard key={plugin.id} plugin={plugin} />
          ))}

          <p className="px-1 text-xs text-muted-foreground">{t("plugins.safety")}</p>
        </div>
      </Sheet.Body>
    </>
  );
}

function PluginCard({ plugin }: { plugin: Plugin }) {
  const { t } = useTranslation("settings");
  const { manifest } = plugin;
  // While off, every permission it asks for starts ticked; the user can untick.
  const [chosen, setChosen] = useState<PluginPermission[]>(manifest.permissions);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const shown = plugin.enabled ? plugin.granted : manifest.permissions;
  const panels = manifest.contributes.panels.length;
  const what = [
    panels > 0 ? t("plugins.panels", { count: panels }) : null,
    manifest.contributes.theme ? t("plugins.theme") : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <section className="overflow-hidden rounded-2xl border">
      <div className="flex items-start gap-3 p-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted">
          <Icon icon={pluginIconSet[manifest.icon]} size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{manifest.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {t("plugins.meta", {
              version: manifest.version,
              by: plugin.updatedBy === "you" ? t("plugins.byYou") : plugin.updatedBy,
            })}
            {what ? ` · ${what}` : ""}
          </p>
          {manifest.description ? (
            <p className="mt-1 text-xs text-pretty text-muted-foreground">{manifest.description}</p>
          ) : null}
        </div>
        <Switch
          aria-label={t("plugins.toggle", { name: manifest.name })}
          checked={plugin.enabled}
          onCheckedChange={(enabled) => void setPluginEnabled(plugin.id, enabled, chosen)}
        />
      </div>

      {shown.length > 0 || !plugin.enabled ? (
        <div className="border-t bg-muted/30 px-3 py-2.5">
          <p className="pb-1.5 text-xs font-medium text-muted-foreground">
            {plugin.enabled ? t("plugins.granted") : t("plugins.asks")}
          </p>
          {manifest.permissions.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t("plugins.noPermissions")}</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {manifest.permissions.map((permission) => {
                const granted = plugin.enabled
                  ? plugin.granted.includes(permission)
                  : chosen.includes(permission);
                return (
                  <li key={permission}>
                    <label
                      className={cn(
                        "flex items-center gap-2 text-xs",
                        plugin.enabled ? "cursor-default" : "cursor-pointer",
                        permission.startsWith("write:") && "font-medium",
                      )}
                    >
                      <Checkbox
                        checked={granted}
                        disabled={plugin.enabled}
                        onCheckedChange={(checked) =>
                          setChosen((current) =>
                            checked
                              ? [...new Set([...current, permission])]
                              : current.filter((each) => each !== permission),
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
        </div>
      ) : null}

      <div className="flex items-center justify-end gap-2 border-t px-3 py-2">
        {confirmRemove ? (
          <>
            <span className="me-auto text-xs text-muted-foreground">
              {t("plugins.removeAsk", { name: manifest.name })}
            </span>
            <Button size="sm" variant="ghost" onClick={() => setConfirmRemove(false)}>
              {t("plugins.keep")}
            </Button>
            <Button size="sm" variant="destructive" onClick={() => void removePlugin(plugin.id)}>
              {t("plugins.remove")}
            </Button>
          </>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => setConfirmRemove(true)}>
            <Icon icon={Delete02Icon} size={14} />
            {t("plugins.remove")}
          </Button>
        )}
      </div>
    </section>
  );
}
