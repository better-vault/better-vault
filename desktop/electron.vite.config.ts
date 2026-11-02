import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "electron-vite";
import { appConfig, appDefine, appRoot } from "../vite.shared";

// The desktop app's build: the main process (with the app's API inside it),
// the preload script, and the page, which is the web app's own Vite build.
// https://electron-vite.org/config/

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  main: {
    resolve: { alias: { "@": appRoot } },
    define: appDefine,
    build: {
      outDir: path.join(here, "out/main"),
      rolldownOptions: { input: path.join(here, "src/main.ts") },
    },
  },
  preload: {
    build: {
      outDir: path.join(here, "out/preload"),
      // The window is sandboxed, so the preload script is one CommonJS file.
      rolldownOptions: { input: path.join(here, "src/preload.ts"), output: { format: "cjs" } },
    },
  },
  renderer: {
    ...appConfig(),
    build: {
      outDir: path.join(here, "out/renderer"),
      emptyOutDir: true,
      rolldownOptions: { input: path.join(appRoot, "index.html") },
    },
  },
});
