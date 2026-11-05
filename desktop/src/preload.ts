import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";
import type { DesktopBridge, UpdateState } from "../../lib/desktop/bridge";

// Runs before the page, isolated from it. It gives the page `window.betterVault`
// and nothing else from Electron.

const versionArg = process.argv.find((arg) => arg.startsWith("--better-vault-version="));

/** Listens on a main → page channel; returns an unsubscribe. */
function listen<T>(channel: string, listener: (value: T) => void) {
  const handler = (_event: IpcRendererEvent, value: T) => listener(value);
  ipcRenderer.on(channel, handler);
  return () => {
    ipcRenderer.removeListener(channel, handler);
  };
}

const bridge: DesktopBridge = {
  version: versionArg?.split("=")[1] ?? "",
  platform: process.platform,
  db: {
    call: (method, args) => ipcRenderer.invoke("db", method, args),
    onChange: (listener) => listen("db:changed", listener),
  },
  updates: {
    state: () => ipcRenderer.invoke("updates:state"),
    onState: (listener) => listen<UpdateState>("updates:state", listener),
    check: () => ipcRenderer.invoke("updates:check"),
    download: () => ipcRenderer.invoke("updates:download"),
    install: () => ipcRenderer.invoke("updates:install"),
    onOpen: (listener) => listen<void>("updates:open", () => listener()),
  },
};

contextBridge.exposeInMainWorld("betterVault", bridge);

// macOS: the window has no title bar. <html data-window-controls="left|right">
// moves the page's top bar (data-window-bar) below the window buttons and lets
// it move the window (src/styles/globals.css).
const controls = process.argv
  .find((arg) => arg.startsWith("--better-vault-window-controls="))
  ?.split("=")[1];
if (controls) {
  let fullScreen = false;
  const apply = () => {
    if (fullScreen) delete document.documentElement.dataset.windowControls;
    else document.documentElement.dataset.windowControls = controls;
  };
  if (document.documentElement) apply();
  else document.addEventListener("readystatechange", apply, { once: true });
  ipcRenderer.on("window:fullscreen", (_event, value: boolean) => {
    fullScreen = value;
    apply();
  });
}
