import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Tests of the desktop app's main-process code that runs without Electron
 * (the MCP tools). Run from the root with `npm run desktop:test`.
 */
export default defineConfig({
  root: fileURLToPath(new URL("./", import.meta.url)),
  resolve: {
    alias: { "@": fileURLToPath(new URL("../", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
