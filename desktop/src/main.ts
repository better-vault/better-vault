import { app, BrowserWindow, dialog, nativeTheme, shell, type WebFrameMain } from "electron";
import path from "node:path";
import { openDatabase } from "./database";
import { setMenu } from "./menu";
import { handleScheme, origin, registerScheme } from "./protocol";
import { startUpdates } from "./updates";

/**
 * The better-vault desktop app. It shows the same app as the web version,
 * built by Vite, runs the app's API in this process, and keeps notebooks in a
 * SQLite file instead of the browser's IndexedDB.
 *
 * `npm run dev` (electron-vite) sets ELECTRON_RENDERER_URL to its dev server;
 * the page is then fetched from there, with hot reload.
 */
const devServer = app.isPackaged ? undefined : process.env.ELECTRON_RENDERER_URL;
const startUrl = `${origin}/`;
const pageOrigin = origin;

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

/**
 * Only the app's own pages may use the database. `URL.origin` is "null" for
 * custom schemes, so the scheme and host are compared instead.
 */
function isTrusted(frame: WebFrameMain | null) {
  if (!frame) return false;
  try {
    const url = new URL(frame.url);
    return `${url.protocol}//${url.host}` === pageOrigin;
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
const icon = path.join(__dirname, "..", "..", "build", "icon.png");

/**
 * On macOS the window has no title bar: its buttons sit in a strip above the
 * app's own top bar, on the right when the system language reads right to left.
 */
function windowControlsSide(): "left" | "right" {
  try {
    const locale = new Intl.Locale(app.getPreferredSystemLanguages()[0] ?? "en") as Intl.Locale & {
      getTextInfo?: () => { direction?: string };
      textInfo?: { direction?: string };
    };
    const direction = (locale.getTextInfo?.() ?? locale.textInfo)?.direction;
    return direction === "rtl" ? "right" : "left";
  } catch {
    return "left";
  }
}

function createWindow() {
  const mac = process.platform === "darwin";
  const window = new BrowserWindow({
    ...(mac ? { titleBarStyle: "hidden" as const, trafficLightPosition: { x: 14, y: 12 } } : {}),
    icon,
    width: 1280,
    height: 840,
    minWidth: 900,
    minHeight: 600,
    show: false,
    title: "better-vault",
    // The app's own background (--background in src/styles/tokens.css), so no white flash.
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#0a0a0a" : "#ffffff",
    webPreferences: {
      preload: path.join(__dirname, "..", "preload", "preload.js"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      additionalArguments: [
        `--better-vault-version=${app.getVersion()}`,
        ...(mac ? [`--better-vault-window-controls=${windowControlsSide()}`] : []),
      ],
    },
  });

  // Windows and Linux draw the application menu as a bar under the title bar.
  // The app has its own controls, so the bar stays hidden; its shortcuts still work.
  if (process.platform !== "darwin") window.setMenuBarVisibility(false);

  window.once("ready-to-show", () => window.show());
  // The window buttons hide in full screen, and so does the room left for them.
  window.on("enter-full-screen", () => window.webContents.send("window:fullscreen", true));
  window.on("leave-full-screen", () => window.webContents.send("window:fullscreen", false));

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

app.whenReady().then(() => {
  if (!firstInstance) return;
  try {
    // Where the API keeps the ChatGPT sign-in (lib/chatgpt/store.ts).
    process.env.BETTER_VAULT_DATA_DIR = app.getPath("userData");
    closeDatabase = openDatabase(isTrusted).close;
    handleScheme(devServer ?? path.join(__dirname, "..", "renderer"));
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
  startUpdates(isTrusted);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("will-quit", () => {
  closeDatabase?.();
});
