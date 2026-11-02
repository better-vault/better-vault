import { app, BrowserWindow, ipcMain, powerMonitor, type WebFrameMain } from "electron";
import { autoUpdater } from "electron-updater";
import { existsSync } from "node:fs";
import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import type { UpdateState } from "../../lib/desktop/bridge";

/**
 * Updates come from the project's GitHub releases (see `publish` in
 * electron-builder.config.mjs). The app checks at launch, every hour and when
 * the computer wakes; the page shows what it finds in Settings → About &
 * Updates and lets the person download it and restart. Nothing downloads on
 * its own, but a downloaded update is installed when the app quits.
 *
 * Everything the updater does is written to <userData>/logs/updates.log.
 */
const hour = 60 * 60 * 1000;
const retryAfterError = 10 * 60 * 1000;

/**
 * Installed builds carry app-update.yml (written by electron-builder from
 * `publish`); local unpacked test builds don't, and can't update.
 */
const supported = () =>
  app.isPackaged && existsSync(path.join(process.resourcesPath, "app-update.yml"));

let state: UpdateState = { status: "idle", supported: false };
let retry: NodeJS.Timeout | undefined;

const logFile = () => path.join(app.getPath("userData"), "logs", "updates.log");

function log(level: string, ...parts: unknown[]) {
  const line = `${new Date().toISOString()} ${level} ${parts
    .map((part) => (part instanceof Error ? (part.stack ?? part.message) : String(part)))
    .join(" ")}\n`;
  void mkdir(path.dirname(logFile()), { recursive: true })
    .then(() => appendFile(logFile(), line))
    .catch(() => {});
}

function setState(next: UpdateState) {
  state = next;
  for (const window of BrowserWindow.getAllWindows())
    window.webContents.send("updates:state", state);
}

function message(error: unknown) {
  const text = error instanceof Error ? error.message : String(error);
  // The first line is enough; the log has the rest.
  return text.split("\n")[0].slice(0, 300);
}

async function check() {
  if (!supported()) return;
  // A download in progress or a finished one is not interrupted by a check.
  if (state.status === "downloading" || state.status === "ready" || state.status === "checking")
    return;
  setState({ status: "checking" });
  try {
    const result = await autoUpdater.checkForUpdates();
    if (!result?.isUpdateAvailable) setState({ status: "upToDate", checkedAt: Date.now() });
  } catch (error) {
    failed(error);
  }
}

function failed(error: unknown) {
  log("error", error);
  setState({ status: "error", message: message(error) });
  clearTimeout(retry);
  retry = setTimeout(() => void check(), retryAfterError);
}

async function download() {
  if (state.status !== "available" && state.status !== "error") return;
  try {
    await autoUpdater.downloadUpdate();
  } catch (error) {
    failed(error);
  }
}

export function startUpdates(isTrusted: (frame: WebFrameMain | null) => boolean) {
  const trusted =
    <A extends unknown[]>(run: (...args: A) => unknown) =>
    (event: Electron.IpcMainInvokeEvent, ...args: A) => {
      if (!isTrusted(event.senderFrame)) throw new Error("This page cannot manage updates.");
      return run(...args);
    };
  ipcMain.handle(
    "updates:state",
    trusted(() => state),
  );
  ipcMain.handle(
    "updates:check",
    trusted(() => check()),
  );
  ipcMain.handle(
    "updates:download",
    trusted(() => download()),
  );
  ipcMain.handle(
    "updates:install",
    trusted(() => {
      if (state.status !== "ready") return;
      log("info", `Installing ${state.version} and restarting.`);
      // Silent on Windows, and the app opens again once installed.
      setImmediate(() => autoUpdater.quitAndInstall(true, true));
    }),
  );

  if (!supported()) return;
  state = { status: "idle", supported: true };

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.logger = {
    info: (...parts: unknown[]) => log("info", ...parts),
    warn: (...parts: unknown[]) => log("warn", ...parts),
    error: (...parts: unknown[]) => log("error", ...parts),
    debug: () => {},
  };
  autoUpdater.on("update-available", (info) =>
    setState({ status: "available", version: info.version }),
  );
  autoUpdater.on("update-not-available", () =>
    setState({ status: "upToDate", checkedAt: Date.now() }),
  );
  autoUpdater.on("download-progress", (progress) => {
    const version =
      state.status === "available" || state.status === "downloading" ? state.version : "";
    setState({ status: "downloading", version, percent: Math.round(progress.percent) });
  });
  autoUpdater.on("update-downloaded", (info) =>
    setState({ status: "ready", version: info.version }),
  );
  autoUpdater.on("error", (error) => failed(error));

  void check();
  setInterval(() => void check(), hour);
  powerMonitor.on("resume", () => void check());
}

/** The "Check for Updates…" menu item: opens About & Updates in the window and checks. */
export function checkForUpdatesNow() {
  const [window] = BrowserWindow.getAllWindows();
  if (window) {
    if (window.isMinimized()) window.restore();
    window.focus();
    window.webContents.send("updates:open");
  }
  void check();
}
