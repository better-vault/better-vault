# Contributing to better-vault

Thank you for helping. This guide covers setup, the rules the code follows and how to send a change.

## Setup

Requirements: Node.js 20.9+ and pnpm 9.

```bash
git clone https://github.com/<you>/better-vault.git
cd better-vault
pnpm install
pnpm dev
```

The app runs at <http://localhost:3000>. Add an API key in **Settings → AI providers** to try AI features, or use a local model through Ollama or LM Studio.

## Before you start

- Read [AGENTS.md](AGENTS.md). It explains the concepts (notebooks, sources, Studio tools, outputs) and the decisions behind the code.
- For anything larger than a small fix, open an issue first so we can agree on the approach.

## Rules the code follows

- **Panel UI first**, shadcn only for what Panel lacks. Colours come from theme tokens only.
- **Icons from Hugeicons only.**
- **No hard-coded UI text.** Every string goes through `t()` and lives in `locales/en/*.json`.
- **Logical CSS** (`ms-*`, `pe-*`, `text-start`) so right-to-left languages work.
- **AI calls through the Vercel AI SDK.** Web search uses only the provider's built-in tool.
- **Local-first.** User data stays in the browser. API routes do not store anything and never log keys.

## Making a change

1. Create a branch: `feat/short-name`, `fix/short-name` or `docs/short-name`.
2. Commit with [Conventional Commits](https://www.conventionalcommits.org): `feat: add quiz hints`, `fix(chat): keep citations after reload`.
3. Run every check:
   ```bash
   pnpm lint && pnpm typecheck && pnpm test && pnpm i18n:check && pnpm build
   ```
4. Open a pull request and fill in the template. Add screenshots for UI changes, in light and dark mode.

## Adding a language

1. Copy `locales/en/` to `locales/<code>/` and translate the values (not the keys). Keep `{{placeholders}}` as they are.
2. Import the files in `lib/i18n/resources.ts`.
3. Add the language to `lib/i18n/config.ts`; use `dir: "rtl"` for right-to-left scripts.
4. Run `pnpm i18n:check`.

## Adding a Studio tool

See "How to… add a Studio tool" in [AGENTS.md](AGENTS.md). A tool is one folder under `studio/tools/` with its definition, server prompt, dialog and viewer.

## Reporting bugs and requesting features

Use the [issue templates](https://github.com/better-vault/better-vault/issues/new/choose). Never paste API keys. Report security problems privately, as described in [SECURITY.md](SECURITY.md).

## Code of conduct

This project follows the [Code of Conduct](CODE_OF_CONDUCT.md). By taking part you agree to it.
