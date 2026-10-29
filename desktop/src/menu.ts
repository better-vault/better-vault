import { app, Menu, shell, type MenuItemConstructorOptions } from "electron";
import { checkForUpdatesNow } from "./updates";

/** The standard menus (the OS translates their role items), plus updates and help. */
export function setMenu() {
  const mac = process.platform === "darwin";
  const updates: MenuItemConstructorOptions = {
    label: "Check for Updates…",
    click: () => void checkForUpdatesNow(),
  };
  const template: MenuItemConstructorOptions[] = [
    ...(mac
      ? [
          {
            label: app.name,
            submenu: [
              { role: "about" },
              updates,
              { type: "separator" },
              { role: "services" },
              { type: "separator" },
              { role: "hide" },
              { role: "hideOthers" },
              { role: "unhide" },
              { type: "separator" },
              { role: "quit" },
            ] satisfies MenuItemConstructorOptions[],
          },
        ]
      : []),
    { role: "fileMenu" },
    { role: "editMenu" },
    { role: "viewMenu" },
    { role: "windowMenu" },
    {
      role: "help",
      submenu: [
        {
          label: "Documentation",
          click: () => void shell.openExternal("https://better-vault.dev/docs"),
        },
        {
          label: "Report an Issue",
          click: () =>
            void shell.openExternal("https://github.com/better-vault/better-vault/issues"),
        },
        ...(mac ? [] : [{ type: "separator" } as const, updates]),
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
