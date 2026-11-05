# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Fixed

- A page that fails shows a short message with Reload and Go to notebooks, instead of a developer error. In development, contexts survive hot reloads, which caused “must be used inside its provider” errors.
- Google Drive: files picked in Google's Picker sometimes never appeared as sources. The Add source dialog no longer closes or pulls focus while the Picker is open, a refused or expired token is renewed once, the Picker reports its errors instead of waiting forever, scripts that failed to load are tried again, shortcuts open their file, files named without an extension are read by their type, and files that can't be read are named in a message.
- Sources: the source sheet joins the lines a PDF broke back into paragraphs, keeps headings and bullets apart, and renders Markdown sources.

### Added

- Command palette: press ⌘K (Ctrl K on Windows and Linux) or the Search button to search every notebook, source, Studio output, folder and vault, including the text inside PDFs, and jump to the passage. It also runs actions (new notebook, add a source, switch tab, vault or theme) and opens any settings page.
- Vaults: separate spaces, each with its own notebooks and folders, a name, an icon and a colour. Everything you had is in “My vault”. Backups are format 4 and hold vaults; older backups import into “My vault”.
- Notebooks page, laid out like a Finder window: a side panel with Recent, All notebooks, pinned notebooks and your vaults; a toolbar with back and forward, an icon or list view and sorting, new notebook, new folder, import and search; and a path bar you can drop notebooks on. Notebooks can be pinned and moved to another vault.
- Sources: pictures in a PDF are kept with it and shown in the source sheet where their page ends; press one to see it larger. PDFs added before this version show their text only.
- Providers: DeepSeek, with your own key. It has no built-in web search, so Web mode stays off for it.
- Settings → AI providers: an Effort level for each provider (Default, None, Low, Medium, High, Max and more where the provider has them), used in chat and in the Studio.
- Chat: a new model picker, with providers in a rail, search and starred models; and, under the prompt, an Effort switch beside a usage ring showing how much of the model's context the last answer used, and the tokens sent and received in the chat.
- Settings → Appearance: a primary colour (Neutral, Blue, Violet, Teal, Green, Amber, Orange or Rose), tuned for light and dark mode.

## [0.5.0] - 2026-11-03

### Added

- Storage: connect Google Drive (drive.file only, with the Google Picker), OneDrive, Amazon S3 and Cloudflare R2 in Settings → Storage. Add sources from them, back up notebooks and restore from there, and save Studio exports.
- Audio Overview: two hosts, or one narrator, talk your sources through. Choose the format, the length (about 3, 7 or 12 minutes), the chat model that writes the script and the ElevenLabs voices. The player shows a wave per host and a transcript that follows along.
- Providers: OpenCode (Zen or Go key) for chat, and ElevenLabs for speech. The desktop app can check whether OpenCode is installed.
- Notebooks page: a dialog to name a new notebook and give it an icon, a colour and a folder; drop files on the page to start a notebook with them; folders, with breadcrumbs, search and sorting.
- Settings → Account: a local profile with your name and picture, connected accounts and what this device holds.
- Settings → About & Updates: the desktop app shows when an update is out, downloads it on request, asks to restart when it's ready and then links to the release notes.

### Changed

- The app is built with Vite and Hono instead of Next.js, and the desktop app with electron-vite. The desktop app runs the API in its own process: no local server or startup wait.
- Sign in with ChatGPT works in the desktop app only; the web app says it isn't supported.
- The mind map takes the whole Studio tab, like the whiteboard.
- On macOS the desktop app has no title bar; the window buttons sit above the app's own top bar.
- Backups are format 3, with folders and stored files; older backups still import.

### Security

- The web and desktop apps are served with a Content-Security-Policy: the page runs only its own scripts and Google's sign-in and Picker, and sends data only to its own API and the storage services. Also `nosniff`, a referrer policy and a permissions policy.
- The `shadcn` command-line tool moved to development dependencies; production dependencies have no known vulnerabilities.

### Fixed

- Windows: the desktop app was signed with the macOS certificate, so installed apps refused every update. Windows builds are no longer signed with it. **Apps on 0.4.x for Windows need to be reinstalled once by hand** from the download page; later versions update themselves.
- The notebook's top bar and the Audio Overview fit on phones.

## [0.4.2] - 2026-11-01

### Added

- Sign in with ChatGPT: OpenAI can use your ChatGPT plan instead of an API key, through OpenAI's official sign-in for open-source apps. The tokens stay with the local server, never in the browser.

### Changed

- The providers' logos in the app are their own marks, from theSVG.
- Panel's sheet is updated: text in a sheet can be selected with the mouse.
- The landing page shows the Studio tools one at a time on a stage built from the app's own viewers, with a walkthrough in which a cursor uses each tool and handwritten notes explain it. Anatomy draws a real figure with the app's renderer.

### Fixed

- The desktop app no longer shows a File/Edit/View menu bar on Windows and Linux.

## [0.4.1] - 2026-10-30

### Added

- The first desktop installers: a signed and notarized DMG for macOS (Apple silicon and Intel), an installer for Windows, and an AppImage and a .deb for Linux, available from better-vault.dev/download and this release.

## [0.4.0] - 2026-10-30

### Added

- A desktop app for macOS, Windows and Linux, built with Electron. It shows the same interface as the web app, runs the app's server on your computer, and keeps notebooks in a SQLite file (`better-vault.sqlite` in the app's data folder) instead of the browser. Backups from the web app import into it.
- Automatic updates for the desktop app from GitHub releases, with **Check for Updates…** in the menu. macOS builds are signed and notarized.
- A macOS installer window with a sharp Retina background, an arrow and an instruction to drag the app to Applications.
- A Desktop workflow that builds the installers for every published release and attaches them to it.
- A desktop app page in the documentation.
- A download page on the website (better-vault.dev/download) that offers the installer for your system, with the Download link next to Roadmap.
- Root scripts for the website and the desktop app: `setup`, `site:dev`, `site:check`, `desktop:dev`, `desktop:start`, `desktop:check` and more.

### Changed

- Storage goes through one interface with two stores, IndexedDB in the browser and SQLite on the desktop, and the database tests run against both.
- The documentation, README and contributing guide are rewritten in plain prose, with tables for options and steps for procedures.
- The roadmap moves the desktop app to shipped and renumbers the next milestones.

## [0.3.0] - 2026-10-27

### Added

- A website at better-vault.dev, its own project in `site/`: a landing page, and documentation built with Fumadocs (getting started, providers, privacy, self-hosting, every Studio tool, a comparison with NotebookLM, FAQ, roadmap and contributor guides), with search and "Copy Markdown" on every page.
- Search engine and AI assistant support: page titles, descriptions and canonical links, social cards, structured data (JSON-LD), a sitemap, robots.txt, `llms.txt`, `llms-full.txt`, and Markdown versions of the docs for agents that ask for them.
- A roadmap (ROADMAP.md and `/docs/roadmap`), including a desktop app.

### Changed

- The website deploys only when a maintainer starts the Deploy site workflow, not on every push.

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

[Unreleased]: https://github.com/better-vault/better-vault/compare/v0.5.0...HEAD
[0.5.0]: https://github.com/better-vault/better-vault/compare/v0.4.2...v0.5.0
[0.4.2]: https://github.com/better-vault/better-vault/compare/v0.4.1...v0.4.2
[0.4.1]: https://github.com/better-vault/better-vault/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/better-vault/better-vault/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/better-vault/better-vault/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/better-vault/better-vault/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/better-vault/better-vault/releases/tag/v0.1.0
