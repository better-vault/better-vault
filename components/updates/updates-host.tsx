import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/panelui/button";
import { Dialog } from "@/components/panelui/dialog";
import { desktopBridge } from "@/lib/desktop/bridge";
import { useUpdates } from "@/lib/updates/use-updates";
import { compareVersions, releaseNotesUrl } from "@/lib/updates/version";
import { UpdateStatus } from "./update-status";

const lastVersionKey = "better-vault:last-version";

let launchUpdate: string | null | undefined;

/** The version this launch updated to, or null. Read once per page load. */
function updatedOnLaunch(): string | null {
  if (launchUpdate !== undefined) return launchUpdate;
  const version = desktopBridge()?.version ?? "";
  const last = localStorage.getItem(lastVersionKey);
  if (version) localStorage.setItem(lastVersionKey, version);
  launchUpdate = version && last && compareVersions(version, last) > 0 ? version : null;
  return launchUpdate;
}

/**
 * The desktop app's update dialogs, mounted once around every page:
 * - a toast when a new version is out, which opens the updates dialog;
 * - "ready to install" once it has downloaded, with Restart;
 * - "updated" on the first launch of a new version, with its release notes;
 * - the updates dialog itself, also opened by the menu's "Check for Updates…".
 */
export function UpdatesHost() {
  const bridge = desktopBridge();
  if (!bridge) return null;
  return <DesktopUpdates />;
}

function DesktopUpdates() {
  const { t } = useTranslation("settings");
  const { t: tCommon } = useTranslation();
  const updates = useUpdates();
  const { state } = updates;
  const [open, setOpen] = useState(false);
  // Downloaded: ask to restart, once per version.
  const [declined, setDeclined] = useState<string | null>(null);
  const readyOpen = state.status === "ready" && declined !== state.version;
  const [updatedTo, setUpdatedTo] = useState<string | null>(updatedOnLaunch);
  const announced = useRef<string | null>(null);

  // The menu's "Check for Updates…".
  useEffect(() => desktopBridge()?.updates.onOpen(() => setOpen(true)), []);

  // A new version: a toast, once per version.
  useEffect(() => {
    if (state.status !== "available" || announced.current === state.version) return;
    announced.current = state.version;
    toast(t("updates.toast", { version: state.version }), {
      action: { label: t("updates.view"), onClick: () => setOpen(true) },
    });
  }, [state, t]);

  return (
    <>
      <Dialog open={open && !readyOpen} onOpenChange={setOpen}>
        <Dialog.Content size="sm" closeLabel={tCommon("actions.close")}>
          <Dialog.Header
            title={t("updates.title")}
            description={t("about.version", { version: bridgeVersion() })}
          />
          <Dialog.Body>
            <UpdateStatus updates={updates} />
          </Dialog.Body>
        </Dialog.Content>
      </Dialog>

      <Dialog
        open={readyOpen}
        onOpenChange={(next) => !next && state.status === "ready" && setDeclined(state.version)}
      >
        <Dialog.Content size="sm" closeLabel={tCommon("actions.close")}>
          <Dialog.Header
            title={t("updates.readyTitle")}
            description={
              state.status === "ready"
                ? t("updates.readyBody", { version: state.version })
                : undefined
            }
          />
          <Dialog.Footer>
            <Button
              variant="secondary"
              onClick={() => state.status === "ready" && setDeclined(state.version)}
            >
              {t("updates.later")}
            </Button>
            <Button onClick={updates.install}>{t("updates.restartNow")}</Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog>

      <Dialog open={updatedTo !== null} onOpenChange={(next) => !next && setUpdatedTo(null)}>
        <Dialog.Content size="sm" closeLabel={tCommon("actions.close")}>
          <Dialog.Header title={t("updates.updatedTitle", { version: updatedTo ?? "" })} />
          <Dialog.Body>
            <p className="text-sm text-muted-foreground">
              {t("updates.updatedBody")}{" "}
              <a
                href={releaseNotesUrl(updatedTo ?? "")}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-foreground underline underline-offset-4"
              >
                {t("updates.releaseNotes")}
              </a>
            </p>
          </Dialog.Body>
          <Dialog.Footer>
            <Button onClick={() => setUpdatedTo(null)}>{t("updates.gotIt")}</Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog>
    </>
  );
}

function bridgeVersion() {
  return desktopBridge()?.version ?? "";
}
