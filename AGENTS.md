<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# better-vault: guide for contributors and AI agents

better-vault is an open-source, bring-your-own-model alternative to Google's NotebookLM ("Gemini Notebook"). This file holds the concepts, decisions and rules that are easy to forget. Read it before changing code.

## Core concepts

| Concept              | Meaning                                                                                                                                                                                                                                                                     |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Notebook**         | A workspace with its own sources, chats (conversations, listed in History) and Studio outputs.                                                                                                                                                                              |
| **Source**           | A document added to a notebook: pasted text, a TXT/MD/PDF file or a web page. It is stored as plain text and split into **chunks** for retrieval. A source can be selected or deselected; only selected sources are used as context.                                        |
| **Chat mode**        | **Sources** (default): the model answers only from the notebook's selected sources and cites passages as `[n]`. **Web**: the model may also use its provider's own web search.                                                                                              |
| **Studio**           | The sheet opened by **Create**. It holds **tools** (Report, Flashcards, Quiz, Data table, Mind map, Anatomy, Slide deck, Infographic, Whiteboard). Each tool opens a **dialog** of options, except **local** tools (the Whiteboard), which are made in the browser at once. |
| **Output**           | One generated Studio result (for example "Entrepreneurship Flashcards"). It is listed under the tools and opened in a **viewer** in the Studio tab.                                                                                                                         |
| **Desktop app**      | The same app inside Electron (`desktop/`) for macOS, Windows and Linux. It runs the Next.js server locally and stores data in SQLite instead of IndexedDB; the interface is identical.                                                                                    |
| **Provider / model** | Where a request goes: OpenAI, Anthropic, Google, Ollama or LM Studio, plus a model id. Chosen in the prompt bar; keys are entered in Settings.                                                                                                                              |

## Interface

The repository holds two Next.js projects and a desktop shell. The **app** is the root project: notebooks at `/`, a notebook at `/notebook/[id]` (paths from `lib/routes.ts`); people run it themselves, and nothing hosts it for them. The **desktop app** (`desktop/`, its own npm project) packages that same app with Electron; see "Desktop app" below. The **website** (landing page and Fumadocs docs, deployed at better-vault.dev) is its own project in `site/`, with its own `package.json`, lockfile and checks; it never links into a running app. The rest of this section describes the app.

- **Top left:** Panel's `ButtonGroup` (small buttons): **Settings** (opens the Settings sheet, whose rows open nested sheets with `Sheet.Next`) and **Create** (opens the **Studio sheet**: tools grid and outputs list) share a track; on the Chat tab, the white **History** button follows in a track of its own and opens the History sheet (the notebook's chats).
- **Top centre:** the notebook's name, opening a menu to switch, create, rename or delete notebooks.
- **Top right:** tabs switch the main view: **Chat · Sources · Studio**.
- **Bottom centre, in the Chat tab only:** the **prompt bar** (Panel `Prompt`) with the model picker and the Sources/Web switch. It does not appear over the Sources or Studio views.
- Choosing a tool closes the Studio sheet and opens the tool's Panel `Dialog`. Choosing an output closes the sheet, switches to the Studio tab and shows its viewer.
- **Rule: a choice in a sheet that opens a dialog closes the sheet first.** Such dialogs are rendered outside the sheet (workspace state in `components/workspace/workspace-context.tsx`, or beside the `<Sheet>`), because closing a sheet unmounts its content.
- Each assistant answer cites passages with small numbered marks (`components/chat/citation.tsx`, a preview card on hover or focus) and lists its references as footnotes under the answer (`components/chat/answer-references.tsx`), for notebook sources and web results alike.

## Decisions (do not change without discussing first)

1. **Local-first.** All user data lives on the user's device: in the browser's IndexedDB (Dexie) in the web app, and in a SQLite file in the desktop app. Both are stores behind one `Backend` interface (`lib/db/backend.ts`); components only use the functions in `lib/db/*.ts`, never a store directly. There is no server database and no auth. API routes are stateless. A schema change needs a new Dexie version with an upgrade **and** a new SQLite migration (`lib/db/sqlite/store.ts`), and a backup format change keeps old backups importable (`lib/db/backup.ts`).
2. **Bring your own key.** Keys are stored in the browser and sent with each request in the JSON body. Routes never log or store them. Error messages must never echo a key.
3. **Web search uses only the provider's built-in tool** (`openai.tools.webSearch`, `anthropic.tools.webSearch_*`, `google.tools.googleSearch`). No third-party search APIs. Models without one (Ollama, LM Studio) cannot use Web mode; the toggle is disabled.
4. **AI calls go through the Vercel AI SDK** (`ai` v7 and `@ai-sdk/*`). Never call provider HTTP APIs for generation directly. (Listing models is the exception; see `app/api/models`.)
5. **No audio or video overviews.**
6. **Mind maps and diagrams** are Mermaid text rendered to SVG with [Pele](https://pele.run). The model writes Mermaid, and the server validates it with Pele and asks the model to repair it on error.
7. **Anatomy figures are generated by the model, every time.** The model designs a real object whose working explains the sources (parts, assemblies, steps, with citations), then builds its geometry from a small vocabulary of shapes (box, cylinder, rod, spring, ball, needle, cable) and details the renderer draws (groove, screws, ruler, knurl, …). `studio/tools/anatomy/validate.ts` closes small gaps itself and sends floating or overlapping parts back to the model (two repairs at most). Figures are drawn with Anatomy's MIT kit, copied unchanged into `studio/tools/anatomy/kit/` (keep its notice; don't edit it). Never ship ready-made figures, community figures included: they may be used only as local test data, outside the repository. The example in the prompt and the tests (`example.ts`) is our own.

8. **Pictures come from the provider's image model** (`lib/ai/catalog.ts` `imageModels`: OpenAI GPT Image or Google Gemini image models), through the AI SDK's `generateImage`. The image model is chosen per output in the tool's dialog and its key is sent with that request only (`imageCredentials`). No third-party image services.
9. **Local tools** (`local` in a tool's definition, the Whiteboard) are made and edited in the browser: no route, no model, no sources. Their viewers save edits with `onDataChange`. Boards store theme palette names, not colours, so they follow light and dark mode; exports resolve them to the light theme.

## Desktop app

The desktop app is the web app, not a copy of it. `desktop/scripts/build-server.mjs` builds the root app with `BETTER_VAULT_STANDALONE=1` (Next's `output: "standalone"`, set in `next.config.ts`) and copies the server into `desktop/server/`. The main process (`desktop/src/main.ts`) starts that server on a free local port in a utility process and serves it to the window as `app://better-vault`, so the origin, and with it localStorage, stays the same across launches.

Data goes to `<userData>/better-vault.sqlite` through Node's built-in `node:sqlite`. The preload script (`desktop/src/preload.ts`) exposes `window.betterVault`; `lib/db/store.ts` picks the desktop backend when it exists, and `lib/db/live.ts` re-runs live queries when the main process reports changed tables. Updates come from GitHub releases through `electron-updater`. Packaging is `desktop/electron-builder.config.mjs`, including the DMG design in `desktop/build/dmgly/`.

**Rule: every change to the web app must keep working in the desktop app.** Interface changes reach it on their own. In the same change, update `desktop/` and run its checks when you:

- change `lib/db` (add the method to `Backend`, both stores, `backendMethods` and `writes`; the contract tests in `lib/db/db.test.ts` run on both stores),
- add an API route, a server dependency, a file the server reads at runtime, or an environment variable,
- use a browser feature Electron handles differently: new windows or `target="_blank"`, downloads, file pickers, the clipboard, notifications or permissions,
- change `next.config.ts`, `public/` or anything else the standalone build copies.

Keep the desktop shell thin: desktop-only behaviour belongs in `desktop/src/`, and the page learns it is on desktop only through `lib/desktop/bridge.ts`.

## UI rules

- **Components:** Panel UI first (`components/panelui`, added with `npx shadcn@latest add @panelui/<name>`). Use shadcn (`components/ui`) only when Panel has no such component. Do not add other component libraries (Rare UI was removed on purpose); build what is missing from Panel and shadcn parts, with a design of our own. Do not hand-edit vendored components unless necessary, and note why in the file.
- **Colours:** only semantic tokens (`bg-card`, `text-muted-foreground`, `text-info`, `bg-chart-3`, …) from `app/tokens.css`, which holds the Panel palette (`site/app/tokens.css` is a copy; keep the two in step). Never use raw colours like `bg-neutral-800` or hex values in app code.
- **Icons:** only [Hugeicons](https://hugeicons.com): `import { HugeiconsIcon } from "@hugeicons/react"` and icons from `@hugeicons/core-free-icons`. No lucide or other sets. The small glyphs built into Panel components are left as they ship. The one exception is the providers' own logos on the website (`site/public/providers`, see its README).
- **Text:** every user-facing string in the app goes through i18next (`useTranslation`, `t("…")`). No hard-coded UI strings. English in `locales/en/*.json` is the source of truth. Keys are typed, so a missing key is a type error. The website and docs are English only: landing copy lives in `site/lib/site/copy.ts` and docs in `site/content/docs/*.mdx`.
- **Direction:** use logical utilities (`ms-*`, `pe-*`, `start-*`, `text-start`) so right-to-left languages work.
- **CSS:** keep a single `@layer components` block in `app/globals.css`; the Turbopack Tailwind loader drops any later one.
- **Scrolling:** pages scroll in shadcn's `ScrollArea` (`components/ui/scroll-area.tsx`), never the browser's bar. Panel sheet and dialog bodies have their own.
- **Accessibility:** icon-only buttons need an `aria-label` (translated).

## Code map

```
app/                      Next.js App Router (pages and API routes)
  api/chat                streamText: Sources (grounded) or Web (provider search)
  api/studio              one Studio generation, validated against the tool's schema
  api/models              list a provider's models with the user's key
  api/sources/parse       PDF / web page → plain text
components/panelui        Panel UI (vendored registry code)
components/ui             shadcn fallbacks (vendored)
components/providers      app-wide providers (theme, i18n, Sheet.Stage)
components/workspace      the notebook screen: top bar, sheets, tabs, prompt, views
studio/                   Studio tools: registry, shared dialog fields, one folder per tool
lib/ai                    providers, model catalog, web-search tools, prompts
lib/db                    data functions and hooks; Backend interface; Dexie (web) and SQLite (desktop) stores
lib/desktop               the bridge type the desktop preload puts on window.betterVault
lib/grounding             chunking, retrieval and citations
lib/i18n                  language registry and i18next setup
locales/<lng>/*.json      translations
desktop/                  the desktop app: its own npm project (Electron, electron-builder)
  src/                    main process (server, app:// protocol, SQLite over IPC, menu, updates) and preload
  scripts/                build-server.mjs (standalone server → server/), bundle.mjs (esbuild)
  build/                  app icon, macOS entitlements, Dmgly DMG background
site/                     the website: its own Next.js project (see below)
  app/(home), app/docs    landing page, and the Fumadocs docs layout and pages
  content/docs            the documentation, as MDX (sidebar order in meta.json)
  lib/site                site name, URL, description, landing copy, tool list, llms.txt, social card
  components/site         landing page parts: hero, isometric figures, provider diagram
  app/sitemap.ts, robots.txt, llms*.txt, llms.mdx, proxy.ts   SEO and files for AI agents
  lib/dither, components/dithercn   the hero's dither engine, copied unchanged from its registry
```

## How to…

- **Add a Studio tool:** create `studio/tools/<id>/` with `definition.ts` (id, icon, tint, option schema and defaults), `server.ts` (prompt and output schema), `dialog.tsx` (options form) and `viewer.tsx` (output view). Register it in the client and server registries and add its strings under `studio` in `locales/en/studio.json`.
- **Add a local tool** (made in the browser, like the Whiteboard): give its `definition.ts` a `local: { blank }` and no `server.ts` or dialog; its viewer receives `onDataChange` to save edits. Mark its client `immersive` to give the viewer the whole tab: the page drops its header and passes the title, downloads, rename and delete as `chrome` for the viewer to show. Register it in `studio/client.ts` and `studio/definitions.ts`; the Studio sheet creates it at once and opens it.
- **Add a UI language:** copy `locales/en/` to `locales/<code>/`, import it in `lib/i18n/resources.ts`, add it to `lib/i18n/config.ts`, run `npm run i18n:check`.
- **Add a provider:** add it to the catalog in `lib/ai/catalog.ts` and handle it in `lib/ai/providers.ts` (model factory, optional web-search tool, model listing).

- **Change stored data:** add or change the row type in `lib/db/types.ts`, the `Backend` method in `lib/db/backend.ts`, both stores (`dexie-backend.ts` with a new Dexie version if indexes change, `sqlite/store.ts` with a new migration), and `writes` for any table a write touches. Add a test to the contract suite.

- **Add a docs page:** add `site/content/docs/<slug>.mdx` with a `title` and a 150–160 character `description` (quoted in the frontmatter), and list it in the folder's `meta.json`. Open with a plain sentence that says what the page is about. The sitemap, llms.txt, search and social card pick it up automatically.

## Writing docs

Docs, the README and CONTRIBUTING are read by people new to the project, so they are written as prose, in the style of [ui.shadcn.com](https://ui.shadcn.com/docs).

Open each page with one plain sentence that says what the thing is or what the page gives you. Write short paragraphs of one to three sentences, in the second person ("you"), in plain words. Introduce every command with a sentence that says what it does, and when useful follow it with one that confirms the result.

Explain in sentences. **Do not use a bullet list to stand in for an explanation**, and do not make lists of bold labels with fragments after them. Use the structure that fits the content:

| Content                                         | Use                                     |
| ----------------------------------------------- | --------------------------------------- |
| A procedure                                     | `<Steps>` with a short `###` heading per step, or a numbered list in Markdown files |
| Options, settings, comparisons, file locations  | A table                                 |
| Several related points                          | Paragraphs, with the key term in bold once |
| Short parallel items: links, credits, examples  | A bullet list is fine                   |

Headings are short noun phrases or tasks ("Add an API key"), never questions answered by "See …". Link with descriptive text ("[Privacy](/docs/privacy) explains what is sent where"), not "see here". AGENTS.md and CLAUDE.md are reference files for agents and may use lists.

## Commands

The project uses **npm** (not pnpm or yarn). Keep `package-lock.json` committed and use `npx` for one-off tools.

```bash
npm run dev        # start on http://localhost:3000
npm run lint       # ESLint
npm run typecheck  # next typegen + tsc
npm test           # Vitest
npm run i18n:check # every locale has the same keys as English
npm run build      # production build
```

The website has its own commands, run inside `site/` (`npm install` there first):

```bash
npm run dev        # start on http://localhost:3001
npm run lint && npm run typecheck && npm run build
```

The desktop app has its own commands, run inside `desktop/` (`npm install` there first):

```bash
npm run build:server  # build the web app as a standalone server into desktop/server
npm run start         # open the app with that server
npm run dev           # open the app on a running `npm run dev` at the root (hot reload)
npm run typecheck
npm run pack          # unpacked app in desktop/release/ for this system
npm run dist          # installers (DMG, NSIS, AppImage, deb) for this system
```

## Workflow

- **Commit every change** with a [Conventional Commit](https://www.conventionalcommits.org) message (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`, `ci:`).
- **Push** to GitHub when a set of tasks is complete.
- **Versioning:** SemVer, starting at 0.1.0. The version lives in `package.json`, and `CHANGELOG.md` collects changes under "Unreleased".
- **Releases:** when a phase is complete, **ask the maintainer whether to release**. Only on a yes: bump the version, move "Unreleased" under the new version in the changelog, tag `vX.Y.Z` and create a GitHub release. The desktop app takes its version from the root `package.json`. Publishing the release starts the **Desktop** workflow (`.github/workflows/desktop.yml`), which builds the installers on macOS, Windows and Linux and attaches them, with the `latest*.yml` files the updater reads, to that release. Check that the run succeeds.
- **Website:** better-vault.dev does not deploy on push (`site/vercel.json` sets `git.deploymentEnabled: false`). It deploys only through the **Deploy site** workflow (`.github/workflows/deploy-site.yml`), which fires a Vercel deploy hook stored as the `VERCEL_DEPLOY_HOOK` secret. After each release, ask the maintainer whether to update the site, and run the workflow only on a yes.
- Before pushing: `npm run lint && npm run typecheck && npm test && npm run i18n:check && npm run build`, the website's checks in `site/` when it changed, and the desktop checks in `desktop/` (`npm run typecheck && npm run build:server && npm run pack`) when the change falls under the desktop rule above.

## Roadmap

The roadmap lives in [ROADMAP.md](ROADMAP.md) and on the site at `/docs/roadmap` (`site/content/docs/roadmap.mdx`). Keep the two in step.
