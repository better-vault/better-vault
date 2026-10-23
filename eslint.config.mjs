import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Vendored registry components (Panel UI, shadcn, Rare UI) follow their
    // upstream style and are not linted here.
    "components/panelui/**",
    "components/ui/**",
    // Anatomy's drawing kit, copied unchanged.
    "studio/tools/anatomy/kit/**",
  ]),
]);

export default eslintConfig;
