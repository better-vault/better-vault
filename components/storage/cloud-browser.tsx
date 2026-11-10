import {
  ArrowLeft01Icon,
  File02Icon,
  Folder01Icon,
  Loading03Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Segmented } from "@/components/common/segmented";
import { Icon } from "@/components/icon";
import { Button } from "@/components/panelui/button";
import { StorageLogo } from "@/components/settings/storage-panel";
import { formatRelativeTime } from "@/lib/format";
import { storageIds, storages, type CloudFile, type StorageId } from "@/lib/storage/catalog";
import { storageClient } from "@/lib/storage/clients";
import { canExport, googlePicker, isGoogleDocument } from "@/lib/storage/clients/google-drive";
import { isStorageReady, useStorageSettings } from "@/lib/storage/settings";
import { cn } from "@/lib/utils";

interface CloudBrowserProps {
  /**
   * "sources": browse any folder and pick several files of `accept`.
   * "backups": better-vault's backups folder, one file.
   */
  mode: "sources" | "backups";
  /** File extensions that can be chosen, e.g. ["pdf", "md"]. */
  accept?: readonly string[];
  /** Called with the files chosen and the service they are in; a promise keeps the browser busy. */
  onChoose: (service: StorageId, files: CloudFile[]) => Promise<void>;
  busy?: boolean;
}

/**
 * Files in the connected storage services: a tab per service, Google's
 * Picker for Google Drive on the web, and a list to browse for the others.
 */
export function CloudBrowser({ mode, accept, onChoose, busy = false }: CloudBrowserProps) {
  const { t } = useTranslation("settings");
  const settings = useStorageSettings();
  const connected = useMemo(
    () => (settings ? storageIds.filter((id) => isStorageReady(settings, id)) : []),
    [settings],
  );
  const [chosen, setChosen] = useState<StorageId | null>(null);
  const service = chosen && connected.includes(chosen) ? chosen : (connected[0] ?? null);

  if (!settings) return null;
  if (!service)
    return (
      <p className="rounded-2xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
        {t("storage.browser.none")}
      </p>
    );

  return (
    <div className="flex flex-col gap-3">
      {connected.length > 1 ? (
        <Segmented<StorageId>
          aria-label={t("storage.title")}
          size="sm"
          value={service}
          onValueChange={setChosen}
          className="w-full *:flex-1"
          options={connected.map((id) => ({
            value: id,
            label: storages[id].name,
            icon: <StorageLogo id={id} size={14} />,
          }))}
        />
      ) : null}
      <ServiceFiles
        key={service}
        service={service}
        mode={mode}
        accept={accept}
        busy={busy}
        onChoose={(files) => onChoose(service, files)}
      />
    </div>
  );
}

function ServiceFiles({
  service,
  mode,
  accept,
  busy,
  onChoose,
}: {
  service: StorageId;
  mode: CloudBrowserProps["mode"];
  accept?: readonly string[];
  busy: boolean;
  onChoose: (files: CloudFile[]) => Promise<void>;
}) {
  const { t, i18n } = useTranslation("settings");
  const settings = useStorageSettings();
  const client = useMemo(
    () => (settings ? storageClient(service, settings[service]) : null),
    // The client reads the keys once; a new one is made when they change.
    [service, settings],
  );
  const [path, setPath] = useState<{ id: string; name: string }[]>([]);
  const [files, setFiles] = useState<CloudFile[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<CloudFile[]>([]);
  const [picking, setPicking] = useState(false);
  const usesPicker = mode === "sources" && Boolean(client?.pick);
  const folder = path.at(-1)?.id;

  // Loads Google's Picker and sign-in now, so the click can open the sign-in popup at once.
  useEffect(() => {
    if (usesPicker && service === "google-drive")
      void googlePicker.prepare().catch(() => undefined);
  }, [usesPicker, service]);

  useEffect(() => {
    if (!client || usesPicker) return;
    let live = true;
    const load = mode === "backups" ? client.listOwn("backups") : client.browse?.(folder);
    if (!load) return;
    void load
      .then((list) => {
        if (!live) return;
        setFiles(list);
        setError(null);
      })
      .catch(
        (failure: unknown) =>
          live && setError(failure instanceof Error ? failure.message : String(failure)),
      );
    return () => {
      live = false;
    };
  }, [client, folder, mode, usesPicker]);

  const allowed = (file: CloudFile) => {
    if (file.folder) return true;
    if (mode === "backups") return file.name.endsWith(".json");
    // Google's own documents are exported as text, when they can be.
    if (isGoogleDocument(file.mime))
      return canExport(file.mime) || file.mime === "application/vnd.google-apps.shortcut";
    const extension = file.name.toLowerCase().split(".").pop() ?? "";
    if (!accept || accept.includes(extension)) return true;
    // A file named without its extension is judged by its type.
    if (file.mime === "application/pdf") return accept.includes("pdf");
    return Boolean(file.mime?.startsWith("text/")) && accept.includes("txt");
  };

  if (usesPicker)
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-8 text-center">
        <StorageLogo id={service} size={32} />
        <p className="max-w-sm text-sm text-muted-foreground">{t("storage.browser.pickerHint")}</p>
        <Button
          disabled={picking || busy}
          onClick={async () => {
            setPicking(true);
            setError(null);
            try {
              const all = await client!.pick!();
              const picked = all.filter(allowed);
              const skipped = all.filter((file) => !allowed(file));
              // A toast, because the dialog closes once the other files are added.
              if (skipped.length > 0)
                toast.warning(
                  t("storage.browser.skipped", {
                    count: skipped.length,
                    names: skipped.map((file) => file.name).join(", "),
                  }),
                );
              if (picked.length > 0) await onChoose(picked);
            } catch (failure) {
              setError(failure instanceof Error ? failure.message : String(failure));
            } finally {
              setPicking(false);
            }
          }}
        >
          {picking || busy ? (
            <Icon icon={Loading03Icon} size={16} className="animate-spin" />
          ) : null}
          {t("storage.browser.pick", { name: storages[service].name })}
        </Button>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>
    );

  const toggle = (file: CloudFile) =>
    setSelected((now) =>
      mode === "backups"
        ? [file]
        : now.some((each) => each.id === file.id)
          ? now.filter((each) => each.id !== file.id)
          : [...now, file],
    );

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-2xl ring-1 ring-border">
        {mode === "sources" ? (
          <div className="flex h-10 items-center gap-1 border-b border-border px-2 text-sm">
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={path.length === 0}
              aria-label={t("storage.browser.up")}
              onClick={() => setPath((now) => now.slice(0, -1))}
            >
              <Icon icon={ArrowLeft01Icon} size={16} className="rtl:rotate-180" />
            </Button>
            <span className="truncate text-muted-foreground">
              {[storages[service].name, ...path.map((step) => step.name)].join(" / ")}
            </span>
          </div>
        ) : null}
        <div className="max-h-72 overflow-y-auto p-1">
          {error ? (
            <p className="px-3 py-6 text-center text-sm text-destructive">{error}</p>
          ) : !files ? (
            <p className="flex items-center justify-center gap-2 px-3 py-6 text-sm text-muted-foreground">
              <Icon icon={Loading03Icon} size={16} className="animate-spin" />
              {t("storage.browser.loading")}
            </p>
          ) : files.filter(allowed).length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              {mode === "backups" ? t("storage.browser.noBackups") : t("storage.browser.empty")}
            </p>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {files.filter(allowed).map((file) => {
                const on = selected.some((each) => each.id === file.id);
                return (
                  <li key={file.id}>
                    <button
                      type="button"
                      onClick={() =>
                        file.folder
                          ? setPath((now) => [...now, { id: file.id, name: file.name }])
                          : toggle(file)
                      }
                      aria-pressed={file.folder ? undefined : on}
                      className={cn(
                        "flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-start text-sm transition-colors outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
                        on && "bg-muted",
                      )}
                    >
                      <Icon
                        icon={file.folder ? Folder01Icon : File02Icon}
                        size={16}
                        className="shrink-0 text-muted-foreground"
                      />
                      <span className="min-w-0 flex-1 truncate">{file.name}</span>
                      {file.modified ? (
                        <span className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
                          {formatRelativeTime(file.modified, i18n.language)}
                        </span>
                      ) : null}
                      <span className="flex size-4 shrink-0 items-center justify-center">
                        {on ? (
                          <Icon icon={Tick02Icon} size={16} className="text-foreground" />
                        ) : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
      <Button
        className="self-end"
        disabled={selected.length === 0 || busy}
        onClick={() => void onChoose(selected).then(() => setSelected([]))}
      >
        {busy ? <Icon icon={Loading03Icon} size={16} className="animate-spin" /> : null}
        {mode === "backups"
          ? t("storage.browser.restore")
          : t("storage.browser.add", { count: selected.length })}
      </Button>
    </div>
  );
}
