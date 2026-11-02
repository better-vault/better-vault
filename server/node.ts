import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { createApi } from "./app";

/**
 * `npm start`: the built app on http://localhost:3000 (or $PORT). It serves
 * the pages from dist/client and the API from ./app.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const client = path.join(here, "..", "client");
const port = Number(process.env.PORT) || 3000;
const hostname = process.env.HOSTNAME || "localhost";

const index = await readFile(path.join(client, "index.html"), "utf8");
const app = new Hono();
app.route("/", createApi());
app.use("/*", serveStatic({ root: path.relative(process.cwd(), client) }));
// Every other path is a page of the single-page app.
app.get("*", (c) => c.html(index));

serve({ fetch: app.fetch, port, hostname }, (info) => {
  console.log(`better-vault is running on http://${hostname}:${info.port}`);
});
