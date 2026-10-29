import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";
import type { DesktopBridge } from "../../lib/desktop/bridge";

// Runs before the page, isolated from it. It gives the page `window.betterVault`
// and nothing else from Electron.

const versionArg = process.argv.find((arg) => arg.startsWith("--better-vault-version="));

const bridge: DesktopBridge = {
  version: versionArg?.split("=")[1] ?? "",
  db: {
    call: (method, args) => ipcRenderer.invoke("db", method, args),
    onChange: (listener) => {
      const handler = (_event: IpcRendererEvent, tables: Parameters<typeof listener>[0]) =>
        listener(tables);
      ipcRenderer.on("db:changed", handler);
      return () => {
        ipcRenderer.removeListener("db:changed", handler);
      };
    },
  },
};

contextBridge.exposeInMainWorld("betterVault", bridge);
