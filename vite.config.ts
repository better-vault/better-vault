import { getRequestListener } from "@hono/node-server";
import { defineConfig, mergeConfig, type Plugin } from "vite";
import { appConfig } from "./vite.shared.ts";

/**
 * Serves the API (server/app.ts) from the dev server, so `npm run dev` runs
 * the whole app on one port. The module is reloaded when its code changes.
 */
function devApi(): Plugin {
  return {
    name: "better-vault:dev-api",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/api/")) return next();
        try {
          const { createApi } = (await server.ssrLoadModule(
            "/server/app.ts",
          )) as typeof import("./server/app");
          await getRequestListener(createApi().fetch)(req, res);
        } catch (error) {
          next(error);
        }
      });
    },
  };
}

export default defineConfig(
  mergeConfig(appConfig(), {
    plugins: [devApi()],
    server: { port: 3000, strictPort: true },
    preview: { port: 3000 },
    build: { outDir: "dist/client", emptyOutDir: true },
  }),
);
