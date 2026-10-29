import { app, dialog } from "electron";
import { autoUpdater } from "electron-updater";

/**
 * Updates come from the project's GitHub releases (see `publish` in
 * electron-builder.config.mjs). An update downloads in the background and is
 * installed when the app quits, or at once if the person chooses to restart.
 */
const sixHours = 6 * 60 * 60 * 1000;

export function startUpdates() {
  if (!app.isPackaged) return;
  autoUpdater.on("error", (error) => console.error("Update failed:", error));
  autoUpdater.on("update-downloaded", async (info) => {
    const { response } = await dialog.showMessageBox({
      type: "info",
      buttons: ["Restart now", "Later"],
      defaultId: 0,
      cancelId: 1,
      message: `better-vault ${info.version} is ready to install.`,
      detail: "Restart to use it now, or it will be installed when you quit.",
    });
    if (response === 0) autoUpdater.quitAndInstall();
  });
  void autoUpdater.checkForUpdates().catch(() => {});
  setInterval(() => void autoUpdater.checkForUpdates().catch(() => {}), sixHours);
}

/** The "Check for Updates…" menu item. */
export async function checkForUpdatesNow() {
  if (!app.isPackaged) {
    await dialog.showMessageBox({ message: "Updates are only checked in the installed app." });
    return;
  }
  try {
    const result = await autoUpdater.checkForUpdates();
    if (!result?.isUpdateAvailable)
      await dialog.showMessageBox({
        message: "better-vault is up to date.",
        detail: `You have version ${app.getVersion()}.`,
      });
    else
      await dialog.showMessageBox({
        message: `Downloading better-vault ${result.updateInfo.version}…`,
        detail: "You will be asked to restart when it is ready.",
      });
  } catch (error) {
    await dialog.showMessageBox({
      type: "error",
      message: "Could not check for updates.",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}
