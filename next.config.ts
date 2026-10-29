import type { NextConfig } from "next";
import packageJson from "./package.json";

const nextConfig: NextConfig = {
  // The desktop app (desktop/) runs a self-contained copy of the server.
  // `npm run build:server` there sets this; web builds are unchanged.
  ...(process.env.BETTER_VAULT_STANDALONE === "1"
    ? {
        output: "standalone" as const,
        // sharp is a native module built for one CPU, and the desktop app is
        // built for several from one machine. Its few images need no resizing.
        images: { unoptimized: true },
        outputFileTracingExcludes: { "*": ["node_modules/sharp/**", "node_modules/@img/**"] },
      }
    : {}),
  env: {
    NEXT_PUBLIC_APP_VERSION: packageJson.version,
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
