import { useCallback, useEffect, useState } from "react";
import { desktopBridge, type UpdateState } from "@/lib/desktop/bridge";
import { appVersion } from "@/lib/version";
import { compareVersions } from "./version";

/**
 * What the updater knows. In the desktop app it comes from the main process
 * (desktop/src/updates.ts), which downloads and installs updates. On the web
 * there is nothing to install: the newest GitHub release is compared with
 * this version, so the page can say that a newer one is out.
 */
export interface Updates {
  state: UpdateState;
  /** True in the desktop app, where updates can be downloaded and installed. */
  desktop: boolean;
  check(): void;
  download(): void;
  install(): void;
}

const latestReleaseApi = "https://api.github.com/repos/better-vault/better-vault/releases/latest";
let webCheck: Promise<UpdateState> | undefined;

function checkOnWeb(again = false): Promise<UpdateState> {
  if (again) webCheck = undefined;
  webCheck ??= fetch(latestReleaseApi, { headers: { accept: "application/vnd.github+json" } })
    .then((response) =>
      response.ok
        ? response.json()
        : Promise.reject(new Error(`GitHub answered ${response.status}.`)),
    )
    .then((release: { tag_name?: string }): UpdateState => {
      const latest = release.tag_name ?? "";
      return latest && compareVersions(latest, appVersion) > 0
        ? { status: "available", version: latest.replace(/^v/, "") }
        : { status: "upToDate", checkedAt: Date.now() };
    })
    .catch((error: unknown): UpdateState => {
      webCheck = undefined;
      return { status: "error", message: error instanceof Error ? error.message : String(error) };
    });
  return webCheck;
}

export function useUpdates(): Updates {
  const bridge = desktopBridge();
  const [state, setState] = useState<UpdateState>({ status: "idle", supported: Boolean(bridge) });

  useEffect(() => {
    if (bridge) {
      void bridge.updates.state().then(setState);
      return bridge.updates.onState(setState);
    }
    let live = true;
    void checkOnWeb().then((next) => live && setState(next));
    return () => {
      live = false;
    };
  }, [bridge]);

  const check = useCallback(() => {
    if (bridge) {
      void bridge.updates.check();
      return;
    }
    setState({ status: "checking" });
    void checkOnWeb(true).then(setState);
  }, [bridge]);
  const download = useCallback(() => void bridge?.updates.download(), [bridge]);
  const install = useCallback(() => void bridge?.updates.install(), [bridge]);

  return { state, desktop: Boolean(bridge), check, download, install };
}
