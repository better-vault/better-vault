import type { NextConfig } from "next";
import { createMDX } from "fumadocs-mdx/next";
import packageJson from "./package.json";

const nextConfig: NextConfig = {
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
  async redirects() {
    return [
      // The app moved under /app when the site took the root; keep old links working.
      { source: "/notebook/:id", destination: "/app/notebook/:id", permanent: true },
    ];
  },
  async headers() {
    return [
      {
        // Points agents at the plain-text index of the site and docs.
        source: "/((?!api|app|_next).*)",
        headers: [{ key: "Link", value: '</llms.txt>; rel="alternate"; type="text/plain"' }],
      },
    ];
  },
};

// Compiles the MDX docs in content/docs (see source.config.ts).
const withMDX = createMDX();

export default withMDX(nextConfig);
