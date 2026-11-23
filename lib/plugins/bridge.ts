import { calendarEntry, entriesBetween } from "@/lib/calendar/entries";
import { calendarStore } from "@/lib/db/calendar";
import { createNote, listNotes } from "@/lib/db/notes";
import { listSkills } from "@/lib/db/skills";
import { activeModel, credentialsFor, effortFor, getSettings } from "@/lib/db/settings";
import { listSources } from "@/lib/db/sources";
import { store } from "@/lib/db/store";
import type { Plugin } from "@/lib/db/types";
import { currentVaultId } from "@/lib/db/vaults";
import { sourceFormatOf } from "@/lib/sources/formats";
import { bridgeApi, type BridgeMethod } from "./api";
import type { PluginPermission } from "./manifest";

/**
 * The bridge between a plugin's sandboxed panel and the user's data. The
 * panel calls `betterVault.call(method, params)`; the page checks the method
 * against what the user granted the plugin and answers through the normal
 * `lib/db` functions. Settings and keys are never reachable. The SDK the
 * panel gets is `pluginSdk` below; `describe_app` (MCP) lists these methods
 * for agents building plugins.
 */

/** Long text is cut before it goes to a plugin. */
const MAX_TEXT = 500_000;
const cut = (text: string) => (text.length > MAX_TEXT ? text.slice(0, MAX_TEXT) : text);

/** What the panel knows about where it runs; sent on load and when it changes. */
export interface PluginContext {
  notebook: { id: string; title: string } | null;
  theme: "light" | "dark";
  /** The app's colour tokens, as CSS values, set on the panel's :root as --name. */
  tokens: Record<string, string>;
  language: string;
}

interface MethodSpec {
  run: (
    params: Record<string, unknown>,
    plugin: Plugin,
    context: PluginContext,
  ) => Promise<unknown>;
}

const str = (value: unknown, name: string, max = 10_000): string => {
  if (typeof value !== "string" || value.length > max) throw new Error(`"${name}" must be text.`);
  return value;
};
const optional = (value: unknown, name: string, max = 10_000) =>
  value === undefined ? undefined : str(value, name, max);

/** Where a plugin's own storage is kept: with the settings, under its id. */
export const pluginStorageKey = (id: string) => `plugin-data:${id}`;
const MAX_STORAGE = 1024 * 1024;

async function pluginStorage(id: string): Promise<Record<string, unknown>> {
  const saved = await store().getSetting(pluginStorageKey(id));
  return saved && typeof saved === "object" ? (saved as Record<string, unknown>) : {};
}

const bridgeMethods: Record<BridgeMethod, MethodSpec> = {
  "ai.generate": {
    run: async (params) => {
      const settings = await getSettings();
      const model = activeModel(settings);
      if (!model) throw new Error("The user has no AI model set up.");
      const schema = params.schema;
      if (
        schema !== undefined &&
        (typeof schema !== "object" || schema === null || Array.isArray(schema))
      )
        throw new Error('"schema" must be a JSON Schema object.');
      const response = await fetch("/api/plugins/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: str(params.prompt, "prompt", 50_000),
          system: optional(params.system, "system", 10_000),
          schema,
          model,
          credentials: credentialsFor(settings, model.provider),
          effort: effortFor(settings, model.provider),
        }),
      });
      const body = (await response.json()) as { text?: string; object?: unknown; error?: string };
      if (!response.ok) throw new Error(body.error ?? "The model did not answer.");
      return body;
    },
  },
  "storage.get": {
    run: async (params, plugin) =>
      (await pluginStorage(plugin.id))[str(params.key, "key", 200)] ?? null,
  },
  "storage.set": {
    run: async (params, plugin) => {
      const key = str(params.key, "key", 200);
      const data = await pluginStorage(plugin.id);
      if (params.value === null || params.value === undefined) delete data[key];
      else data[key] = params.value;
      if (JSON.stringify(data).length > MAX_STORAGE)
        throw new Error("This plugin's storage is full (1 MB).");
      await store().putSetting(pluginStorageKey(plugin.id), data);
      return { ok: true };
    },
  },
  "notebooks.list": {
    run: async () => {
      const [notebooks, counts] = await Promise.all([
        store().listNotebooks(),
        store().countSources(),
      ]);
      return notebooks.map((notebook) => ({
        id: notebook.id,
        title: notebook.title,
        sources: counts[notebook.id] ?? 0,
        updatedAt: notebook.updatedAt,
      }));
    },
  },
  "sources.list": {
    run: async (params, _plugin, context) => {
      const notebookId = optional(params.notebookId, "notebookId", 100) ?? context.notebook?.id;
      if (!notebookId) throw new Error("No notebook.");
      return (await listSources(notebookId)).map((source) => ({
        id: source.id,
        title: source.title,
        format: sourceFormatOf(source),
        url: source.url,
        characters: source.charCount,
        selected: source.selected,
        createdAt: source.createdAt,
      }));
    },
  },
  "sources.read": {
    run: async (params) => {
      const source = await store().getSource(str(params.sourceId, "sourceId", 100));
      if (!source) throw new Error("No such source.");
      return {
        id: source.id,
        title: source.title,
        format: sourceFormatOf(source),
        text: cut(source.text),
      };
    },
  },
  "notes.list": {
    run: async () =>
      (await listNotes()).map((note) => ({
        id: note.id,
        title: note.title,
        folder: note.folder,
        tags: note.tags,
        updatedAt: note.updatedAt,
      })),
  },
  "notes.read": {
    run: async (params) => {
      const note = await store().getNote(str(params.id, "id", 100));
      if (!note) throw new Error("No such note.");
      return { id: note.id, title: note.title, body: cut(note.body), tags: note.tags };
    },
  },
  "notes.create": {
    run: async (params) => {
      const note = await createNote({
        vaultId: currentVaultId(),
        title: str(params.title, "title", 200),
        body: str(params.body, "body", 200_000),
      });
      return { id: note.id, title: note.title };
    },
  },
  "skills.list": {
    run: async () =>
      (await listSkills()).map((skill) => ({
        name: skill.name,
        description: skill.description,
        body: cut(skill.body),
      })),
  },
  "calendar.list": {
    run: async (params) =>
      entriesBetween(
        await calendarStore.load(),
        str(params.from, "from", 20),
        str(params.to, "to", 20),
      )
        .slice(0, 500)
        .map((entry) => ({
          id: entry.id,
          title: entry.title,
          start: entry.start,
          end: entry.end,
          allDay: entry.allDay ?? false,
        })),
  },
  "calendar.add": {
    run: async (params) => {
      const entry = calendarEntry(
        {
          title: str(params.title, "title", 200),
          start: str(params.start, "start", 30),
          end: optional(params.end, "end", 30),
          description: optional(params.description, "description", 4000),
          location: optional(params.location, "location", 200),
        },
        Intl.DateTimeFormat().resolvedOptions().timeZone,
      );
      await calendarStore.save([...(await calendarStore.load()), entry]);
      return { id: entry.id };
    },
  },
};

/** Answers one call from a plugin's panel, or throws why it can't. */
export async function handleBridgeCall(
  plugin: Plugin,
  method: string,
  params: unknown,
  context: PluginContext,
): Promise<unknown> {
  if (!plugin.enabled) throw new Error("This plugin is turned off.");
  if (!Object.hasOwn(bridgeApi, method)) throw new Error(`Unknown method "${method}".`);
  const name = method as BridgeMethod;
  const permission = bridgeApi[name].permission as PluginPermission | null;
  if (permission && !plugin.granted.includes(permission))
    throw new Error(`The plugin may not use ${method}: it wasn't allowed ${permission}.`);
  const spec = bridgeMethods[name];
  const args =
    params && typeof params === "object" && !Array.isArray(params)
      ? (params as Record<string, unknown>)
      : {};
  return spec.run(args, plugin, context);
}

/**
 * The script every panel starts with: `window.betterVault` with `call`, the
 * context (notebook, theme, language) and `onContext`. It also puts the
 * app's colour tokens on :root, so `var(--background)` and friends match.
 */
export const pluginSdk = `(() => {
  const pending = new Map();
  let next = 1;
  let context = null;
  const listeners = new Set();
  const applyTokens = (tokens) => {
    const root = document.documentElement;
    for (const [name, value] of Object.entries(tokens || {})) root.style.setProperty("--" + name, value);
    root.style.colorScheme = context && context.theme === "dark" ? "dark" : "light";
    root.classList.toggle("dark", Boolean(context && context.theme === "dark"));
  };
  window.addEventListener("message", (event) => {
    if (event.source !== window.parent) return;
    const data = event.data || {};
    if (data.type === "bv:result" && pending.has(data.id)) {
      const { resolve, reject } = pending.get(data.id);
      pending.delete(data.id);
      if (data.error) reject(new Error(data.error)); else resolve(data.result);
    } else if (data.type === "bv:context") {
      context = data.context;
      applyTokens(context.tokens);
      for (const listener of listeners) try { listener(context); } catch (error) { console.error(error); }
    }
  });
  window.betterVault = Object.freeze({
    call(method, params) {
      const id = next++;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        window.parent.postMessage({ type: "bv:call", id, method, params: params || {} }, "*");
      });
    },
    get context() { return context; },
    onContext(listener) {
      listeners.add(listener);
      if (context) listener(context);
      return () => listeners.delete(listener);
    },
    toast(message) {
      window.parent.postMessage({ type: "bv:toast", message: String(message).slice(0, 200) }, "*");
    },
  });
})();`;

const escapeScript = (code: string) => code.replace(/<\/(script)/gi, "<\\/$1");
const escapeStyle = (code: string) => code.replace(/<\/(style)/gi, "<\\/$1");

/**
 * A panel's page, ready for the host: its entry file with the SDK first and
 * the plugin's own scripts and stylesheets put inline (the host can load
 * nothing, so `<script src="app.js">` becomes the file's text).
 */
export function pluginPage(plugin: Pick<Plugin, "files">, entry: string): string {
  const files = plugin.files;
  const html = files[entry] ?? "";
  const local = (path: string) => {
    const clean = path.replace(/^\.\//, "").split(/[?#]/)[0];
    return Object.hasOwn(files, clean) ? files[clean] : undefined;
  };
  const inlined = html
    .replace(
      /<script\b([^>]*?)\bsrc=["']([^"']+)["']([^>]*)>\s*<\/script>/gi,
      (whole, before: string, src: string, after: string) => {
        const code = local(src);
        return code === undefined ? "" : `<script${before}${after}>${escapeScript(code)}</script>`;
      },
    )
    .replace(/<link\b[^>]*?\bhref=["']([^"']+)["'][^>]*>/gi, (whole, href: string) => {
      if (!/rel=["']?stylesheet/i.test(whole)) return whole;
      const css = local(href);
      return css === undefined ? "" : `<style>${escapeStyle(css)}</style>`;
    });
  const sdk = `<script>${escapeScript(pluginSdk)}</script>`;
  const base = `<style>:root{color-scheme:light dark}html,body{margin:0;background:var(--background);color:var(--foreground);font-family:system-ui,-apple-system,"Segoe UI",sans-serif}</style>`;
  if (/<head[^>]*>/i.test(inlined))
    return inlined.replace(/<head[^>]*>/i, (head) => `${head}${sdk}${base}`);
  return `<!doctype html><html><head><meta charset="utf-8">${sdk}${base}</head><body>${inlined}</body></html>`;
}
