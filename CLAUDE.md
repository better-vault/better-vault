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
