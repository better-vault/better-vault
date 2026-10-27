import path from "node:path";
import type { NextConfig } from "next";
import { createMDX } from "fumadocs-mdx/next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // This folder is its own project inside the app's repository; without this,
  // Next would take the repository root (the app's lockfile) as the root.
  turbopack: { root: path.join(__dirname) },
  async headers() {
    return [
      {
        // Points agents at the plain-text index of the site and docs.
        source: "/((?!api|_next).*)",
        headers: [{ key: "Link", value: '</llms.txt>; rel="alternate"; type="text/plain"' }],
      },
    ];
  },
};

// Compiles the MDX docs in content/docs (see source.config.ts).
const withMDX = createMDX();

export default withMDX(nextConfig);
