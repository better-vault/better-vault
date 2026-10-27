# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- A website at better-vault.dev: a landing page, and documentation built with Fumadocs (getting started, providers, privacy, self-hosting, every Studio tool, a comparison with NotebookLM, FAQ, roadmap and contributor guides), with search and "Copy Markdown" on every page.
- Search engine and AI assistant support: page titles, descriptions and canonical links, social cards, structured data (JSON-LD), a sitemap, robots.txt, `llms.txt`, `llms-full.txt`, and Markdown versions of the docs for agents that ask for them.
- A roadmap (ROADMAP.md and `/docs/roadmap`), including a desktop app.

### Changed

- The notebook app moved to `/app`; the landing page now owns `/`. Old `/notebook/…` links redirect.

## [0.2.0] - 2026-10-27

### Added

- Slide decks in the Studio: detailed or presenter decks with speaker notes, a slide rail, full-screen presenting, and downloads as PowerPoint (editable) or PDF.
- Infographics in the Studio, drawn by your provider's image model (OpenAI GPT Image or Google Gemini) from a brief written from your sources, with its citations beside the picture. Choose the orientation, style, detail and image model.
- Anatomy in the Studio: the model designs a real object whose working explains your sources and builds it part by part, drawn in isometric with Anatomy's kit. Point at a part to read what it does, step through how it works, take it apart, and download it as PNG or SVG.
- Whiteboard in the Studio: an Excalidraw-like board with its tools and shortcuts (shapes, arrows, lines, pen, text, pictures, eraser), a style panel, layers, groups, locking, undo, copy and paste, and zoom. Boards fill the Studio tab: the name and last edit show on the board's icon, and downloads, rename and delete are in its menu. They save as you draw and download as PNG, SVG or JSON. **Annotate** opens a mind map, Anatomy figure or infographic on a new board to draw over it.
- Several chats per notebook: History lists them by day, with New chat, rename and delete. Existing chats become each notebook's first conversation.

### Changed

- Citations are small numbered marks with a preview of the passage, answers list their references as footnotes, and reports have a new contents panel with reading progress. These replace the Rare UI components, which are no longer used.
- The top left is Panel's button group: Settings and Create (formerly Add), with History on the Chat tab. The notebook's name moves to the top centre.
- About no longer lists the libraries better-vault is built with; they are credited in the README.

### Fixed

- The contents of a long report can be scrolled to the end.
- PDF text no longer shows boxes for characters the file gives no text for; sources added earlier are cleaned too.
- Mind maps show their tree and diagram again.

## [0.1.0] - 2026-10-24

### Added

- Notebooks with sources from PDF, Markdown and text files, web pages and pasted text; per-source selection and a reader that opens at a cited passage.
- Chat grounded in the selected sources with "[n]" citations shown as Rare UI chips and source cards, or Web mode with the provider's own search (OpenAI, Anthropic, Google).
- Bring your own model: OpenAI, Anthropic, Google, Ollama and LM Studio, with model lists loaded from each provider.
- Studio sheet with Reports (four formats, suggested formats, length, document view with contents), Flashcards, Quiz, Data table and Mind map (interactive tree and 11 more diagram kinds drawn with Pele).
- Downloads as Word (with citations as footnotes), Excel, CSV, Markdown, PNG and SVG.
- Settings sheet with nested sheets for providers, appearance, language, data (backup export/import, delete all) and about.
- Local-first storage in IndexedDB; JSON backups never include API keys.
- Next.js 16 app with Panel UI, shadcn fallbacks, Rare UI web search and Hugeicons.
- i18next localisation with typed keys, a language registry ready for right-to-left languages, and `npm run i18n:check`.
- Project documentation: README, AGENTS.md, CLAUDE.md, contributing guide, code of conduct, security policy, issue and pull request templates, and CI.

[Unreleased]: https://github.com/better-vault/better-vault/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/better-vault/better-vault/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/better-vault/better-vault/releases/tag/v0.1.0
