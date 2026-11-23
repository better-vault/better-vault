import type { PluginPermission } from "./manifest";

/**
 * The methods a plugin's panel can call with `betterVault.call(method,
 * params)`, the permission each needs and what it takes. The page runs them
 * (lib/plugins/bridge.ts); `describe_app` (MCP) lists them for agents that
 * build plugins. No method reaches settings or keys.
 */
export const bridgeApi = {
  "notebooks.list": {
    permission: "read:notebooks",
    params: "{}",
    description: "The user's notebooks.",
  },
  "sources.list": {
    permission: "read:sources",
    params: "{ notebookId?: string }",
    description: "A notebook's sources (the current notebook when notebookId is left out).",
  },
  "sources.read": {
    permission: "read:sources",
    params: "{ sourceId: string }",
    description: "A source's text.",
  },
  "notes.list": {
    permission: "read:notes",
    params: "{}",
    description: "The user's notes (without their text).",
  },
  "notes.read": {
    permission: "read:notes",
    params: "{ id: string }",
    description: "A note's Markdown.",
  },
  "notes.create": {
    permission: "write:notes",
    params: "{ title: string, body: string }",
    description: "Creates a note in the current vault.",
  },
  "skills.list": {
    permission: "read:skills",
    params: "{}",
    description: "The user's skills, with their instructions.",
  },
  "calendar.list": {
    permission: "read:calendar",
    params: "{ from: string, to: string }",
    description: "Calendar events between two days (YYYY-MM-DD, inclusive).",
  },
  "calendar.add": {
    permission: "write:calendar",
    params:
      "{ title: string, start: string, end?: string, description?: string, location?: string }",
    description: "Adds an event. start/end: YYYY-MM-DDTHH:mm (timed) or YYYY-MM-DD (all day).",
  },
  "ai.generate": {
    permission: "use:ai",
    params: "{ prompt: string, system?: string, schema?: JSONSchema }",
    description:
      "Asks the user's chosen AI model. Returns { text }, or { object } matching the JSON Schema when one is given. The plugin never sees the model or the key.",
  },
  "storage.get": {
    permission: null,
    params: "{ key: string }",
    description:
      "A value this plugin saved earlier (its own storage, kept on this device), or null.",
  },
  "storage.set": {
    permission: null,
    params: "{ key: string, value: JSON }",
    description: "Saves a value in this plugin's own storage (1 MB in all). null removes it.",
  },
} as const satisfies Record<
  string,
  { permission: PluginPermission | null; params: string; description: string }
>;
export type BridgeMethod = keyof typeof bridgeApi;

/** What a panel can do besides calls, for the docs and `describe_app`. */
export const sdkGuide = {
  call: "await betterVault.call(method, params): the method's result, or an error that says why not.",
  context:
    "betterVault.context and betterVault.onContext(listener): { notebook: { id, title } | null, theme: 'light' | 'dark', tokens, language }.",
  toast: "betterVault.toast(message): a short message in the app.",
  styles:
    "The app's colour tokens are on :root as CSS variables (var(--background), var(--foreground), var(--muted), var(--primary), var(--chart-1)…), and follow light and dark mode.",
  limits:
    "Panels run in a sandbox: no network (fetch, images and fonts from servers are blocked), no storage of the app, no popups or forms. Put scripts, styles and pictures (as data: URLs) in the plugin's files; <script src> and <link rel=stylesheet> to its own files are put inline.",
};
