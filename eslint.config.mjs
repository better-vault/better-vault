import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig([
  globalIgnores([
    "dist/**",
    "coverage/**",
    // The website is its own project, with its own lint config.
    "site/**",
    // The desktop app's sources are linted here; its build output is not.
    "desktop/node_modules/**",
    "desktop/out/**",
    "desktop/dist/**",
    "desktop/release/**",
    // Vendored registry components (Panel UI, shadcn) follow their
    // upstream style and are not linted here.
    "components/panelui/**",
    "components/ui/**",
    // Anatomy's drawing kit, copied unchanged.
    "studio/tools/anatomy/kit/**",
  ]),
  {
    files: ["**/*.{ts,tsx,mts,mjs}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
    ],
    plugins: { "react-refresh": reactRefresh },
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
]);
