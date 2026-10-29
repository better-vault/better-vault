@AGENTS.md

# Notes for Claude Code

Everything in AGENTS.md applies. In addition:

- **Git identity:** commit with the repository's configured identity. Never pass `-c user.name` or `-c user.email`, and never change git config.
- **Commits:** one commit per change, Conventional Commit messages, ending with the `Co-Authored-By` trailer for the model that wrote the change.
- **Push** after each completed set of tasks. **Ask the maintainer before any release** (version bump, tag, GitHub release).
- **Website deploys:** pushes never deploy better-vault.dev (`site/vercel.json` turns Vercel's Git builds off). **After every release, ask the maintainer whether to update the website.** Only on a yes, run `gh workflow run deploy-site.yml -R better-vault/better-vault` and report the run; on a no, do nothing. Never start it otherwise unless the maintainer asks.
- **Docs first:** the AI SDK, Next.js and Panel UI change often. Read the bundled docs (`node_modules/ai/docs`, `node_modules/@ai-sdk/*/docs`, `node_modules/next/dist/docs`) and the vendored Panel sources before writing code against them, instead of relying on memory.
- **Model ids:** take them from the provider packages' type unions or the provider's models endpoint, not from memory.
- **Keys:** never type real API keys into the app or commit them. Real-model checks need the maintainer to paste a key in Settings.

## Desktop app

better-vault also ships as a desktop app for macOS, Windows and Linux, in `desktop/` (its own npm project). It is the same Next.js app, not a copy: AGENTS.md ("Desktop app") explains how it runs.

**How it runs.** The root app is built as a standalone Next server (`BETTER_VAULT_STANDALONE=1`) and copied into `desktop/server/`. Electron starts it on a free local port and shows it as `app://better-vault`. Data lives in `better-vault.sqlite` in the app's data folder, through Node's built-in `node:sqlite`. The page reaches it over IPC (`window.betterVault`, from `desktop/src/preload.ts`), and `lib/db/store.ts` chooses that store over IndexedDB when it is present.

**Keep web and desktop in step.** Every change to the web app must work in the desktop app too, in the same change:

- A `lib/db` change touches `Backend`, both stores, `backendMethods` and `writes`. The contract tests in `lib/db/db.test.ts` must pass on IndexedDB and SQLite.
- A new API route, server dependency, runtime file, environment variable or `next.config.ts` change needs `npm run build:server && npm run pack` in `desktop/` to succeed.
- New windows, `target="_blank"` links, downloads, file pickers, clipboard or permissions must be tried in the desktop app (`npm run dev` at the root and in `desktop/`).
- Desktop-only behaviour stays in `desktop/src/`; the page learns it is on desktop only through `lib/desktop/bridge.ts`.

**Checks.** From the root, run `npm run desktop:check` (after `npm run setup` once). CI runs the same checks on every push. `npm run desktop:dev` opens the desktop app on the app's dev server.

**Releases.** The desktop version is the root `package.json` version. Publishing the GitHub release starts `.github/workflows/desktop.yml`, which builds the installers on all three systems and attaches them, with the updater's `latest*.yml`, to the release. Check that run after each release. macOS signing and notarization need the `CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD` and `APPLE_TEAM_ID` secrets. Never put certificates or passwords in the repository.

**DMG design.** The macOS installer window shows `desktop/build/dmg/background.png` and its `@2x` twin, which electron-builder merges into one Retina image. Both are rendered by `python3 desktop/scripts/dmg-background.py` from `desktop/build/dmg/source/waves.png`: it draws the arrow, the white instruction text and the light pills behind the icon names. Finder always draws those names in black over a background picture, so the pills keep them readable. If you move an icon in the `dmg` block of `desktop/electron-builder.config.mjs`, change the same position in the script and render again. The app icon is `desktop/build/icon.png`, made from `public/brand/logo-dark.png`.
