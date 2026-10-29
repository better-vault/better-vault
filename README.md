<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="public/brand/logo-dark-transparent.png">
  <img src="public/brand/logo-light-transparent.png" alt="better-vault logo" width="112">
</picture>

# better-vault

**An open-source, bring-your-own-model alternative to NotebookLM.**
Chat with your sources, and turn them into reports, flashcards, quizzes, tables and diagrams, using the AI model you choose.

[Website](https://better-vault.dev) · [Get started](https://better-vault.dev/docs/quickstart) · [Docs](https://better-vault.dev/docs) · [Roadmap](ROADMAP.md)

[![Version](https://img.shields.io/github/package-json/v/better-vault/better-vault?style=flat-square&color=262626&label=version)](https://github.com/better-vault/better-vault/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-3b82f6?style=flat-square)](LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/better-vault/better-vault/ci.yml?branch=main&style=flat-square&label=CI)](https://github.com/better-vault/better-vault/actions/workflows/ci.yml)
[![Issues](https://img.shields.io/github/issues/better-vault/better-vault?style=flat-square&color=f59e0b)](https://github.com/better-vault/better-vault/issues)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-10b981?style=flat-square)](CONTRIBUTING.md)

[![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=flat-square&logo=nextdotjs&logoColor=white)](https://nextjs.org)
[![AI SDK](https://img.shields.io/badge/AI%20SDK-7-000000?style=flat-square&logo=vercel&logoColor=white)](https://ai-sdk.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![i18next](https://img.shields.io/badge/i18n-i18next-26A69A?style=flat-square&logo=i18next&logoColor=white)](#-translating)
[![Translations welcome](https://img.shields.io/badge/translations-welcome-8b5cf6?style=flat-square)](#-translating)

</div>

---

## ✨ What it does

better-vault is a free, open-source alternative to Google NotebookLM (now Gemini Notebook). It is a research notebook: you add **sources** such as PDFs, web pages, notes and text files to a **notebook**, and work with them using the AI model you choose.

**Chat with your sources** and get answers that cite the passages they came from. Switch to **Web** mode to let the model search the internet with its provider's built-in search.

**Create study material** in the **Studio**: reports, flashcards, quizzes, data tables, mind maps, slide decks, infographics and Anatomy figures, each with a dialog of options much like NotebookLM's. A **whiteboard** in the style of Excalidraw is there for your own diagrams, or for drawing over a figure or an infographic.

**Choose your model** from OpenAI, Anthropic and Google with your own key, or run a local model through Ollama or LM Studio. Nothing is locked to one vendor.

**Keep your data on your device.** The web app stores everything in your browser's IndexedDB, and the **desktop app** for macOS, Windows and Linux keeps it in a SQLite file on your computer. There is no account and no server database, and your keys only leave your device to reach the model you picked.

| Studio tool     | What you get                                                                                                                                                                                                                           | Download as         |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| **Reports**     | Briefing doc, study guide, blog post, your own format, or a format suggested for your sources; read as a document with a table of contents and citations                                                                               | Word, Markdown      |
| **Flashcards**  | Flip cards with keyboard shortcuts, shuffle and "knew it / still learning" tallies                                                                                                                                                     | Word, CSV (Anki)    |
| **Quiz**        | Multiple-choice questions with hints, explanations and a score                                                                                                                                                                         | Word, Markdown      |
| **Data table**  | Facts from your sources in rows and columns                                                                                                                                                                                            | Excel, CSV          |
| **Mind map**    | An interactive tree like NotebookLM's: open branches, click a topic to ask about it in the chat. Plus 11 more diagram kinds (flowchart, timeline, cause and effect, …) drawn with [Pele](https://pele.run)                             | PNG, SVG, Mermaid   |
| **Slide deck**  | A presentation from your sources: a detailed deck to read, or a presenter deck with speaker notes. Present it full screen                                                                                                              | PowerPoint, PDF     |
| **Infographic** | A one-page picture drawn by your provider's image model (OpenAI GPT Image or Google Gemini), from a cited brief written from your sources                                                                                              | PNG, original image |
| **Anatomy**     | An interactive isometric figure of a real object whose working explains your sources, drawn with [Anatomy](https://skills.wheresryan.sh/anatomy)'s kit: point at a part to read what it does, step through how it works, take it apart | PNG, SVG            |
| **Whiteboard**  | A blank board with Excalidraw's tools and shortcuts: shapes, arrows, pen, text and pictures, in a hand-drawn style. **Annotate** opens a mind map, Anatomy figure or infographic on a board to draw over it. No model needed           | PNG, SVG, JSON      |

Audio and video overviews are out of scope.

## 🚀 Getting started

### Desktop app

Download the installer for macOS, Windows or Linux from the [latest release](https://github.com/better-vault/better-vault/releases/latest), install it and open it. It updates itself when a new version comes out. The [desktop docs](https://better-vault.dev/docs/desktop) cover installing and moving your notebooks over.

### Run from source

**Requirements:** [Node.js](https://nodejs.org) 20.9 or newer, with npm 10 (included with Node.js).

```bash
git clone https://github.com/better-vault/better-vault.git
cd better-vault
npm install
npm run dev
```

Open <http://localhost:3000>, then **Settings → AI providers** and paste an API key, or point it at a local model. No `.env` file is needed.

### Production build

```bash
npm run build
npm start
```

### Local models (Ollama, LM Studio)

1. Install [Ollama](https://ollama.com) or [LM Studio](https://lmstudio.ai) and download a model (for example `ollama pull llama3.2`).
2. In better-vault, open **Settings → AI providers**, enable Ollama or LM Studio and check the address (`http://localhost:11434` for Ollama, `http://localhost:1234` for LM Studio).
3. Pick the model in the prompt bar.

Local models work when better-vault runs on the same machine as the model server. Web search is only available with providers that have it built in (OpenAI, Anthropic, Google).

## 🔐 Where your data lives

Notebooks, sources, chats, Studio outputs and API keys stay on your device: in your browser's IndexedDB in the web app, or in `better-vault.sqlite` in the app's data folder in the desktop app. **Settings → Data** exports and imports notebooks as a JSON file, which also moves them between the two.

Each request sends your key to the app's own API route, which passes it to the provider and never stores or logs it. If you host better-vault for other people, they use their own keys in their own browsers.

### Hosting for others

Two optional environment variables tighten a public deployment:

| Variable                             | Default | Effect                                                                                                                  |
| ------------------------------------ | ------- | ----------------------------------------------------------------------------------------------------------------------- |
| `BETTER_VAULT_ALLOW_LOCAL_PROVIDERS` | `true`  | Set to `false` to turn off Ollama and LM Studio, whose address comes from the user and would make the server fetch it.  |
| `BETTER_VAULT_ALLOW_PRIVATE_URLS`    | `false` | Set to `true` to let web-page sources point at private or local network addresses (only for trusted, private installs). |

## 🧱 Tech stack

[Next.js 16](https://nextjs.org) · [Vercel AI SDK 7](https://ai-sdk.dev) · [Panel UI](https://panelui.dev) · [shadcn/ui](https://ui.shadcn.com) · [Pele](https://pele.run) · [Hugeicons](https://hugeicons.com) · [i18next](https://www.i18next.com) · [Dexie](https://dexie.org) · [Electron](https://www.electronjs.org) · [Tailwind CSS 4](https://tailwindcss.com)

## 🤝 Contributing

Contributions are welcome, from typo fixes to new Studio tools. Please read [CONTRIBUTING.md](CONTRIBUTING.md) first. In short:

1. Fork the repo and create a branch (`feat/…`, `fix/…`, `docs/…`).
2. Make your change. Use [Conventional Commits](https://www.conventionalcommits.org) for messages.
3. Run the checks:
   ```bash
   npm run lint && npm run typecheck && npm test && npm run i18n:check && npm run build
   ```
   If your change touches the server, storage or anything else the desktop app depends on, run the checks in `desktop/` too (see [CONTRIBUTING.md](CONTRIBUTING.md#the-desktop-app)).
4. Open a pull request and fill in the template.

Contributors and AI coding agents should also read [AGENTS.md](AGENTS.md), which explains the project's concepts and rules.

### 🌍 Translating

The UI is fully translatable with [i18next](https://www.i18next.com). English is the source language. To add a language:

1. Copy `locales/en/` to `locales/<code>/` (for example `locales/fr/`) and translate the values, not the keys.
2. Import the new files in `lib/i18n/resources.ts`.
3. Add the language to `lib/i18n/config.ts`, with `dir: "rtl"` for right-to-left scripts.
4. Run `npm run i18n:check` to find missing or extra keys, then open a pull request.

## 🐛 Reporting issues

Found a bug or have an idea? [Open an issue](https://github.com/better-vault/better-vault/issues/new/choose) and pick a template:

A **bug report** asks what happened, the steps to reproduce it, your browser or desktop system, and the provider and model you used. A **feature request** asks for the problem you want solved and how you imagine it working. The **translation** template is for offering or requesting a new language.

Please search existing issues first, and **never paste API keys** into an issue. Security problems should be reported privately, as described in [SECURITY.md](SECURITY.md).

## 🙏 Credits

- [Panel UI](https://panelui.dev) for the sheets, dialogs, prompt and the rest of the interface.
- [Pele](https://pele.run) for rendering Mermaid diagrams.
- [Anatomy](https://skills.wheresryan.sh/anatomy) by Ryan, whose MIT drawing kit draws the anatomy figures.
- [Hugeicons](https://hugeicons.com) for icons.
- [Excalidraw](https://excalidraw.com), whose whiteboard inspired ours, for Excalifont (SIL Open Font License 1.1); [Rough.js](https://roughjs.com) and [perfect-freehand](https://github.com/steveruizok/perfect-freehand) draw the sketchy shapes and pen strokes.
- Inspired by Google's NotebookLM.

## 📄 License

[MIT](LICENSE) © 2026 the better-vault contributors. Third-party code keeps its own license (see [LICENSE](LICENSE)).
