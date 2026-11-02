import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import type { Plugin, UserConfig } from "vite";
import { themeScript } from "./lib/theme/script.ts";
import packageJson from "./package.json" with { type: "json" };

/** The repository root, where the app's sources live. */
export const appRoot = fileURLToPath(new URL("./", import.meta.url));

/** Build-time constants shared by the page and the API. */
export const appDefine = {
  "import.meta.env.VITE_APP_VERSION": JSON.stringify(packageJson.version),
};

/** Sets the theme class before the first paint, so a dark theme never flashes light. */
function themeBeforePaint(): Plugin {
  return {
    name: "better-vault:theme-script",
    transformIndexHtml: () => [{ tag: "script", children: themeScript, injectTo: "head-prepend" }],
  };
}

/**
 * The page's build, shared by the web app (vite.config.ts) and the desktop
 * app's renderer (desktop/electron.vite.config.ts).
 */
export function appConfig(): UserConfig {
  return {
    root: appRoot,
    plugins: [react(), tailwindcss(), themeBeforePaint()],
    resolve: { alias: { "@": appRoot } },
    define: appDefine,
  };
}
