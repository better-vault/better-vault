<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# better-vault: guide for contributors and AI agents

better-vault is an open-source, bring-your-own-model alternative to Google's NotebookLM ("Gemini Notebook"). This file holds the concepts, decisions and rules that are easy to forget. Read it before changing code.

## Core concepts

| Concept              | Meaning                                                                                                                                                                                                                              |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Notebook**         | A workspace with its own sources, chat and Studio outputs.                                                                                                                                                                           |
| **Source**           | A document added to a notebook: pasted text, a TXT/MD/PDF file or a web page. It is stored as plain text and split into **chunks** for retrieval. A source can be selected or deselected; only selected sources are used as context. |
| **Chat mode**        | **Sources** (default): the model answers only from the notebook's selected sources and cites passages as `[n]`. **Web**: the model may also use its provider's own web search.                                                       |
| **Studio**           | The `+` sheet. It holds **tools** (Report, Flashcards, Quiz, Data table, Mind map, and later Slide deck, Infographic, Anatomy). Each tool opens a **dialog** of options.                                                             |
| **Output**           | One generated Studio result (for example "Entrepreneurship Flashcards"). It is listed under the tools and opened in a **viewer** in the Studio tab.                                                                                  |
| **Provider / model** | Where a request goes: OpenAI, Anthropic, Google, Ollama or LM Studio, plus a model id. Chosen in the prompt bar; keys are entered in Settings.                                                                                       |

## Interface

- **Top left:** `+` opens the **Studio sheet** (tools grid and outputs list). The button next to it opens the **Settings sheet**, whose rows open nested sheets (`Sheet.Next`).
- **Top right:** tabs switch the main view: **Chat · Sources · Studio**.
- **Bottom centre, in the Chat tab only:** the **prompt bar** (Panel `Prompt`) with the model picker and the Sources/Web switch. It does not appear over the Sources or Studio views.
- Choosing a tool closes the Studio sheet and opens the tool's Panel `Dialog`. Choosing an output closes the sheet, switches to the Studio tab and shows its viewer.
- **Rule: a choice in a sheet that opens a dialog closes the sheet first.** Such dialogs are rendered outside the sheet (workspace state in `components/workspace/workspace-context.tsx`, or beside the `<Sheet>`), because closing a sheet unmounts its content.
- Each assistant answer shows its sources and citations with the Rare UI `WebSearch` component, for notebook sources and web results alike.

## Decisions (do not change without discussing first)

1. **Local-first.** All user data lives in the browser's IndexedDB (Dexie, `lib/db`). There is no server database and no auth. API routes are stateless.
2. **Bring your own key.** Keys are stored in the browser and sent with each request in the JSON body. Routes never log or store them. Error messages must never echo a key.
3. **Web search uses only the provider's built-in tool** (`openai.tools.webSearch`, `anthropic.tools.webSearch_*`, `google.tools.googleSearch`). No third-party search APIs. Models without one (Ollama, LM Studio) cannot use Web mode; the toggle is disabled.
4. **AI calls go through the Vercel AI SDK** (`ai` v7 and `@ai-sdk/*`). Never call provider HTTP APIs for generation directly. (Listing models is the exception; see `app/api/models`.)
5. **No audio or video overviews.**
6. **Mind maps and diagrams** are Mermaid text rendered to SVG with [Pele](https://pele.run). The model writes Mermaid, and the server validates it with Pele and asks the model to repair it on error.
7. **Anatomy diagrams** (v0.2): the model returns a structured scene (parts, groups, explanations, steps). It is rendered in the isometric style of [Anatomy](https://github.com/wheresryan22/anatomy) with its MIT `iso-kit`. The real Anatomy skill takes an agent hours per figure, so it cannot run per request.

## UI rules

- **Components:** Panel UI first (`components/panelui`, added with `npx shadcn@latest add @panelui/<name>`). Use shadcn (`components/ui`) only when Panel has no such component. Do not hand-edit vendored components unless necessary, and note why in the file.
- **Colours:** only semantic tokens (`bg-card`, `text-muted-foreground`, `text-info`, `bg-chart-3`, …) from `app/globals.css`, which holds the Panel palette. Never use raw colours like `bg-neutral-800` or hex values in app code.
- **Icons:** only [Hugeicons](https://hugeicons.com): `import { HugeiconsIcon } from "@hugeicons/react"` and icons from `@hugeicons/core-free-icons`. No lucide or other sets. The small glyphs built into Panel components are left as they ship.
- **Text:** every user-facing string goes through i18next (`useTranslation`, `t("…")`). No hard-coded UI strings. English in `locales/en/*.json` is the source of truth. Keys are typed, so a missing key is a type error.
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
components/ui             shadcn fallbacks + Rare UI web-search (vendored)
components/providers      app-wide providers (theme, i18n, Sheet.Stage)
components/workspace      the notebook screen: top bar, sheets, tabs, prompt, views
studio/                   Studio tools: registry, shared dialog fields, one folder per tool
lib/ai                    providers, model catalog, web-search tools, prompts
lib/db                    Dexie schema and data hooks
lib/grounding             chunking, retrieval and citations
lib/i18n                  language registry and i18next setup
locales/<lng>/*.json      translations
```

## How to…

- **Add a Studio tool:** create `studio/tools/<id>/` with `definition.ts` (id, icon, tint, option schema and defaults), `server.ts` (prompt and output schema), `dialog.tsx` (options form) and `viewer.tsx` (output view). Register it in the client and server registries and add its strings under `studio` in `locales/en/studio.json`.
- **Add a UI language:** copy `locales/en/` to `locales/<code>/`, import it in `lib/i18n/resources.ts`, add it to `lib/i18n/config.ts`, run `npm run i18n:check`.
- **Add a provider:** add it to the catalog in `lib/ai/catalog.ts` and handle it in `lib/ai/providers.ts` (model factory, optional web-search tool, model listing).

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

## Workflow

- **Commit every change** with a [Conventional Commit](https://www.conventionalcommits.org) message (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`, `ci:`).
- **Push** to GitHub when a set of tasks is complete.
- **Versioning:** SemVer, starting at 0.1.0. The version lives in `package.json`, and `CHANGELOG.md` collects changes under "Unreleased".
- **Releases:** when a phase is complete, **ask the maintainer whether to release**. Only on a yes: bump the version, move "Unreleased" under the new version in the changelog, tag `vX.Y.Z` and create a GitHub release.
- Before pushing: `npm run lint && npm run typecheck && npm test && npm run i18n:check && npm run build`.

## Roadmap

- **v0.1.0:** app shell, notebooks and sources, chat (Sources/Web), Reports, Flashcards, Quiz, Data table, Mind map (Pele).
- **v0.2.0:** Slide deck, Infographic (provider image models), Anatomy diagrams.
- **Later:** notebook overview and suggested questions, notes, embedding-based retrieval, more source types (DOCX, YouTube), more providers (OpenRouter, AI Gateway), more UI languages.
