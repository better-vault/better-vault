import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { loadEnv, type Plugin, type UserConfig } from "vite";
import { themeScript } from "./lib/theme/script.ts";
import packageJson from "./package.json" with { type: "json" };

/** The repository root, where the app's sources live. */
export const appRoot = fileURLToPath(new URL("./", import.meta.url));

/**
 * The OAuth apps that sign in to Google Drive and OneDrive. They identify
 * better-vault, not a user, and are public (they ship in every page), so they
 * are read at build time from the environment or a .env file. Without them
 * those two services say they are not set up in this build.
 */
const oauthKeys = [
  "VITE_GOOGLE_CLIENT_ID",
  "VITE_GOOGLE_API_KEY",
  "VITE_GOOGLE_APP_ID",
  "VITE_GOOGLE_DESKTOP_CLIENT_ID",
  "VITE_GOOGLE_DESKTOP_CLIENT_SECRET",
  "VITE_MICROSOFT_CLIENT_ID",
] as const;

const env = { ...loadEnv(process.env.NODE_ENV ?? "development", appRoot, "VITE_"), ...process.env };

/** Build-time constants shared by the page, the API and the desktop main process. */
export const appDefine = {
  "import.meta.env.VITE_APP_VERSION": JSON.stringify(packageJson.version),
  ...Object.fromEntries(
    oauthKeys.map((key) => [`import.meta.env.${key}`, JSON.stringify(env[key] ?? "")]),
  ),
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
