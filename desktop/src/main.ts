import { app, BrowserWindow, dialog, nativeTheme, shell, type WebFrameMain } from "electron";
import path from "node:path";
import { openDatabase } from "./database";
import { setMenu } from "./menu";
import { handleScheme, origin, registerScheme } from "./protocol";
import { startServer, type LocalServer } from "./server";
import { startUpdates } from "./updates";

/**
 * The better-vault desktop app. It shows the same Next.js app as the web
 * version, served by a local copy of its server, and keeps notebooks in a
 * SQLite file instead of the browser's IndexedDB.
 *
 * `--dev-url=<address>` (passed by `npm run dev`) points the window at a
 * running `next dev` instead, for working on the app with hot reload.
 */
const devUrl = app.isPackaged
  ? undefined
  : process.argv.find((arg) => arg.startsWith("--dev-url="))?.slice("--dev-url=".length);
const startUrl = devUrl ?? `${origin}/`;
const pageOrigin = new URL(startUrl).origin;

let server: LocalServer | undefined;
let closeDatabase: (() => void) | undefined;

registerScheme();

const firstInstance = app.requestSingleInstanceLock();
if (!firstInstance) app.quit();

app.on("second-instance", () => {
  const [window] = BrowserWindow.getAllWindows();
  if (!window) return;
  if (window.isMinimized()) window.restore();
  window.focus();
});

/** Only the app's own pages may use the database. */
function isTrusted(frame: WebFrameMain | null) {
  if (!frame) return false;
  try {
    return new URL(frame.url).origin === pageOrigin;
  } catch {
    return false;
  }
}

function openExternal(url: string) {
  if (/^(https?|mailto):/i.test(url)) void shell.openExternal(url);
}

/**
 * Our icon for the Dock and the window. Installed apps get it from the
 * package (electron-builder, build/icon.png); this covers `npm start` and
 * `npm run dev`, and the window icon on Linux.
 */
const icon = path.join(__dirname, "..", "build", "icon.png");

function createWindow() {
  const window = new BrowserWindow({
    icon,
    width: 1280,
    height: 840,
    minWidth: 900,
    minHeight: 600,
    show: false,
    title: "better-vault",
    // The app's own background (--background in app/tokens.css), so no white flash.
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#0a0a0a" : "#ffffff",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      additionalArguments: [`--better-vault-version=${app.getVersion()}`],
    },
  });

  window.once("ready-to-show", () => window.show());

  // Links to other sites open in the default browser.
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(pageOrigin)) openExternal(url);
    return { action: "deny" };
  });
  window.webContents.on("will-navigate", (event, url) => {
    if (url.startsWith(pageOrigin)) return;
    event.preventDefault();
    openExternal(url);
  });

  void window.loadURL(startUrl);
  return window;
}

app.whenReady().then(async () => {
  if (!firstInstance) return;
  try {
    closeDatabase = openDatabase(isTrusted).close;
    if (!devUrl) {
      server = await startServer();
      handleScheme(`http://127.0.0.1:${server.port}`);
    }
  } catch (error) {
    dialog.showErrorBox(
      "better-vault could not start",
      error instanceof Error ? error.message : String(error),
    );
    app.quit();
    return;
  }
  if (!app.isPackaged) app.dock?.setIcon(icon);
  setMenu();
  createWindow();
  startUpdates();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("will-quit", () => {
  server?.stop();
  closeDatabase?.();
});
