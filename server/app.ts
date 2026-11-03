import { Hono } from "hono";
import { setDesktopRuntime } from "@/lib/ai/server-config";
import { POST as chat } from "./routes/chat";
import { POST as chatgpt } from "./routes/chatgpt";
import { POST as models } from "./routes/models";
import { POST as sourcesParse } from "./routes/sources-parse";
import { POST as studio } from "./routes/studio";
import { POST as studioSuggest } from "./routes/studio-suggest";
import { POST as storageOAuth } from "./routes/storage-oauth";
import { POST as storageS3 } from "./routes/storage-s3";
import { POST as voices } from "./routes/voices";

/**
 * The app's API: stateless routes that take the user's keys in each request
 * and talk to the providers. The web server (`server/node.ts`), the Vite dev
 * server (`vite.config.ts`) and the desktop app's main process all serve it;
 * the desktop app passes `desktop: true`, which allows Sign in with ChatGPT.
 */
export function createApi({ desktop = false }: { desktop?: boolean } = {}) {
  setDesktopRuntime(desktop);
  const api = new Hono().basePath("/api");
  api.post("/chat", (c) => chat(c.req.raw));
  api.post("/chatgpt", (c) => chatgpt(c.req.raw));
  api.post("/models", (c) => models(c.req.raw));
  api.post("/sources/parse", (c) => sourcesParse(c.req.raw));
  api.post("/studio", (c) => studio(c.req.raw));
  api.post("/studio/suggest", (c) => studioSuggest(c.req.raw));
  api.post("/voices", (c) => voices(c.req.raw));
  api.post("/storage/s3", (c) => storageS3(c.req.raw));
  api.post("/storage/oauth", (c) => storageOAuth(c.req.raw));
  api.notFound((c) => c.json({ error: "Not found." }, 404));
  return api;
}
