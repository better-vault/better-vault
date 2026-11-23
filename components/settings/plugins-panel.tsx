import { FileImportIcon, Loading03Icon, Search01Icon } from "@hugeicons/core-free-icons";
import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Icon } from "@/components/icon";
import { openPluginDialog } from "@/components/plugins/plugin-dialog";
import { PluginCard } from "@/components/plugins/plugin-card";
import { Button } from "@/components/panelui/button";
import { Input } from "@/components/panelui/input";
import { Sheet } from "@/components/panelui/sheet";
import { Tabs } from "@/components/panelui/tabs";
import { usePlugins } from "@/lib/db/plugins";
import { useRegistry } from "@/lib/plugins/directory";
import { parsePluginBundle, type PluginManifest } from "@/lib/plugins/manifest";
import { matchesSearch, REGISTRY_WEB, type RegistryEntry } from "@/lib/plugins/registry";

/**
 * Settings → Plugins: what is installed, and the directory to find more.
 * Choosing a plugin opens its dialog (components/plugins/plugin-dialog.tsx):
 * details, a third-party warning, permissions, install, on/off, uninstall.
 */
export function PluginsPanel() {
  const { t } = useTranslation("settings");
  const plugins = usePlugins();
  const [tab, setTab] = useState<"installed" | "browse">(
    plugins && plugins.length === 0 ? "browse" : "installed",
  );
  const [query, setQuery] = useState("");

  return (
    <>
      <Sheet.Header title={t("plugins.title")} description={t("plugins.description")} />
      <Sheet.Body>
        <div className="flex flex-col gap-4 pb-4">
          <Tabs value={tab} onValueChange={(value) => setTab(value as typeof tab)}>
            <Tabs.List aria-label={t("plugins.title")} className="w-full">
              <Tabs.Trigger value="installed" className="flex-1">
                {t("plugins.tabs.installed")}
                {plugins?.length ? (
                  <span className="ms-1.5 text-muted-foreground">{plugins.length}</span>
                ) : null}
              </Tabs.Trigger>
              <Tabs.Trigger value="browse" className="flex-1">
                {t("plugins.tabs.browse")}
              </Tabs.Trigger>
            </Tabs.List>
          </Tabs>

          <label className="relative block">
            <Icon
              icon={Search01Icon}
              size={16}
              className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={
                tab === "browse" ? t("plugins.searchDirectory") : t("plugins.searchInstalled")
              }
              aria-label={t("plugins.search")}
              className="ps-9"
            />
          </label>

          {tab === "installed" ? <Installed query={query} /> : <Browse query={query} />}

          <p className="px-1 text-xs text-muted-foreground">{t("plugins.safety")}</p>
        </div>
      </Sheet.Body>
    </>
  );
}

function Installed({ query }: { query: string }) {
  const { t } = useTranslation("settings");
  const plugins = usePlugins();
  // The directory's covers, for plugins that came from it.
  const { registry } = useRegistry();
  const input = useRef<HTMLInputElement>(null);
  const shown = (plugins ?? []).filter((plugin) =>
    matchesSearch({ ...plugin.manifest, author: plugin.manifest.author ?? "" }, query),
  );

  async function openFile(file: File) {
    let json: unknown;
    try {
      json = JSON.parse(await file.text());
    } catch {
      toast.error(t("plugins.notJson", { name: file.name }));
      return;
    }
    const parsed = parsePluginBundle(json);
    if (!parsed.ok) {
      toast.error(t("plugins.invalid", { name: file.name, error: parsed.error }));
      return;
    }
    // Even a file goes through the dialog: its warning and permissions come first.
    openPluginDialog({ kind: "file", bundle: parsed.bundle, fileName: file.name });
  }

  return (
    <div className="flex flex-col gap-3">
      {plugins === undefined ? (
        <p className="flex items-center gap-2 px-1 py-4 text-sm text-muted-foreground">
          <Icon icon={Loading03Icon} size={15} className="animate-spin" />
          {t("plugins.loading")}
        </p>
      ) : plugins.length === 0 ? (
        <div className="rounded-2xl border border-dashed px-4 py-6 text-center">
          <p className="text-sm font-medium">{t("plugins.emptyTitle")}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t("plugins.emptyBody")}</p>
        </div>
      ) : shown.length === 0 ? (
        <p className="px-1 py-4 text-sm text-muted-foreground">{t("plugins.noMatches")}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {shown.map((plugin) => {
            const listed = registry?.plugins.find((entry) => entry.id === plugin.id);
            return (
              <PluginCard
                key={plugin.id}
                name={plugin.manifest.name}
                author={
                  plugin.manifest.author ??
                  (plugin.updatedBy === "you" ? t("plugins.byYou") : plugin.updatedBy)
                }
                summary={plugin.manifest.description}
                icon={plugin.manifest.icon}
                cover={listed?.cover}
                tags={addsOf(plugin.manifest, t)}
                status={{
                  label: plugin.enabled ? t("plugins.dialog.on") : t("plugins.dialog.off"),
                  tone: plugin.enabled ? "on" : "off",
                }}
                onOpen={() => openPluginDialog({ kind: "installed", id: plugin.id })}
              />
            );
          })}
        </div>
      )}
      <div className="flex items-center gap-3 rounded-2xl bg-muted/60 p-3">
        <p className="min-w-0 flex-1 text-xs text-muted-foreground">{t("plugins.installHint")}</p>
        <Button size="sm" variant="secondary" onClick={() => input.current?.click()}>
          <Icon icon={FileImportIcon} size={14} />
          {t("plugins.install")}
        </Button>
        <input
          ref={input}
          type="file"
          accept=".json,.bvplugin.json,application/json"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void openFile(file);
          }}
        />
      </div>
    </div>
  );
}

function Browse({ query }: { query: string }) {
  const { t } = useTranslation("settings");
  const { registry, error, loading, retry } = useRegistry();
  const installed = usePlugins();
  const shown = useMemo(
    () => (registry?.plugins ?? []).filter((entry) => matchesSearch(entry, query)),
    [registry, query],
  );

  if (loading)
    return (
      <p className="flex items-center gap-2 px-1 py-4 text-sm text-muted-foreground">
        <Icon icon={Loading03Icon} size={15} className="animate-spin" />
        {t("plugins.directoryLoading")}
      </p>
    );
  if (error)
    return (
      <div className="flex flex-col items-start gap-2 rounded-2xl border border-dashed px-4 py-4">
        <p className="text-sm">{t("plugins.directoryError")}</p>
        <p className="text-xs text-muted-foreground">{error}</p>
        <Button size="sm" variant="secondary" onClick={retry}>
          {t("plugins.retry")}
        </Button>
      </div>
    );

  return (
    <div className="flex flex-col gap-3">
      {shown.length === 0 ? (
        <p className="px-1 py-4 text-sm text-muted-foreground">{t("plugins.noMatches")}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {shown.map((entry) => {
            const have = installed?.find((plugin) => plugin.id === entry.id);
            return (
              <PluginCard
                key={entry.id}
                name={entry.name}
                author={entry.author}
                summary={entry.description}
                icon={entry.icon}
                cover={entry.cover}
                tags={countsOf(entry.adds, t)}
                status={
                  have
                    ? have.manifest.version === entry.version
                      ? { label: t("plugins.installedTag"), tone: "on" }
                      : { label: t("plugins.updateTag"), tone: "update" }
                    : undefined
                }
                onOpen={() => openPluginDialog({ kind: "registry", entry })}
              />
            );
          })}
        </div>
      )}
      <a
        href={`${REGISTRY_WEB}/issues/new/choose`}
        target="_blank"
        rel="noreferrer"
        className="px-1 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        {t("plugins.request")}
      </a>
    </div>
  );
}

type Translate = ReturnType<typeof useTranslation<"settings">>["t"];

/** What an installed plugin adds, as short words for its card. */
function addsOf(manifest: PluginManifest, t: Translate): string[] {
  const { panels, mods, theme } = manifest.contributes;
  return [
    ...(panels.some((panel) => panel.slot === "studio-tool") ? [t("plugins.card.tool")] : []),
    ...(panels.some((panel) => panel.slot === "studio") ? [t("plugins.card.panel")] : []),
    ...((mods ?? []).length ? [t("plugins.card.mod")] : []),
    ...(theme ? [t("plugins.card.theme")] : []),
  ];
}

function countsOf(adds: RegistryEntry["adds"], t: Translate): string[] {
  return [
    ...(adds.studioTools ? [t("plugins.card.tool")] : []),
    ...(adds.panels ? [t("plugins.card.panel")] : []),
    ...(adds.mods ? [t("plugins.card.mod")] : []),
    ...(adds.theme ? [t("plugins.card.theme")] : []),
  ];
}
