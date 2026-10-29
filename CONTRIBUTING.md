# Contributing to better-vault

Thank you for helping. This guide covers setup, the rules the code follows and how to send a change.

## Setup

Requirements: Node.js 20.9+ with npm 10 (included with Node.js).

```bash
git clone https://github.com/<you>/better-vault.git
cd better-vault
npm install
npm run dev
```

The app runs at <http://localhost:3000>. Add an API key in **Settings → AI providers** to try AI features, or use a local model through Ollama or LM Studio.

## Before you start

Read [AGENTS.md](AGENTS.md) first. It explains the concepts, such as notebooks, sources, Studio tools and outputs, and the decisions behind the code. For anything larger than a small fix, open an issue so we can agree on the approach before you write it.

## Rules the code follows

The interface uses Panel UI first and shadcn only for what Panel lacks, with colours from theme tokens and icons from Hugeicons. No interface text is hard-coded: every string goes through `t()` and lives in `locales/en/*.json`. Layout uses logical CSS such as `ms-*`, `pe-*` and `text-start`, so right-to-left languages work.

Every AI call goes through the Vercel AI SDK, and web search uses only the provider's built-in tool. User data stays on the device, in the browser or the desktop app's SQLite file. API routes store nothing and never log keys.

## Making a change

1. Create a branch: `feat/short-name`, `fix/short-name` or `docs/short-name`.
2. Commit with [Conventional Commits](https://www.conventionalcommits.org): `feat: add quiz hints`, `fix(chat): keep citations after reload`.
3. Run every check:
   ```bash
   npm run lint && npm run typecheck && npm test && npm run i18n:check && npm run build
   ```
4. Open a pull request and fill in the template. Add screenshots for UI changes, in light and dark mode.

## The desktop app

The desktop app in `desktop/` is the same web app inside Electron, so most changes reach it without extra work. Data goes through `lib/db`, which has an IndexedDB store for the browser and a SQLite store for the desktop; `npm test` runs the database tests against both.

If your change touches the server, storage, environment variables, new windows, downloads or files, check the desktop app as well. From the repository root, install the website and desktop projects once, then run the desktop checks:

```bash
npm run setup
npm run desktop:check
```

This builds an unpacked app in `desktop/release/` that you can open. To work on the desktop app with hot reload, run `npm run desktop:dev`, which starts the app's dev server and opens the desktop app on it.

## The website

The website and documentation live in `site/`. Run `npm run site:dev` to open it at <http://localhost:3001>, and `npm run site:check` before you send a change to it.

## Adding a language

1. Copy `locales/en/` to `locales/<code>/` and translate the values (not the keys). Keep `{{placeholders}}` as they are.
2. Import the files in `lib/i18n/resources.ts`.
3. Add the language to `lib/i18n/config.ts`; use `dir: "rtl"` for right-to-left scripts.
4. Run `npm run i18n:check`.

## Adding a Studio tool

See "How to… add a Studio tool" in [AGENTS.md](AGENTS.md). A tool is one folder under `studio/tools/` with its definition, server prompt, dialog and viewer.

## Reporting bugs and requesting features

Use the [issue templates](https://github.com/better-vault/better-vault/issues/new/choose). Never paste API keys. Report security problems privately, as described in [SECURITY.md](SECURITY.md).

## Code of conduct

This project follows the [Code of Conduct](CODE_OF_CONDUCT.md). By taking part you agree to it.
