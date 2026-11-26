import {
  DashboardSquareAddIcon,
  MagicWand01Icon,
  Notebook01Icon,
  PaintBoardIcon,
  PencilEdit02Icon,
  SourceCodeIcon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";
import type { IsoFigureKind } from "@/components/site/iso-figures";

/*
 * The landing page's words. The website is English only, so they live here.
 * The FAQ also feeds the page's FAQPage JSON-LD and llms-full.txt, so the
 * answers an assistant reads are the ones a visitor reads.
 */

/** A feature card: an isometric figure, a short title and one line. */
export interface Feature {
  figure: IsoFigureKind;
  title: string;
  body: string;
  /** The docs page that explains it. */
  href: string;
}

export const features: Feature[] = [
  {
    figure: "citations",
    title: "Cited answers",
    body: "Every claim points to its passage.",
    href: "/docs/chat",
  },
  {
    figure: "web",
    title: "Web mode",
    body: "Your provider's own search, when you want it.",
    href: "/docs/chat",
  },
  {
    figure: "studio",
    title: "Studio tools",
    body: "From audio overviews to slide decks.",
    href: "/docs/studio",
  },
  {
    figure: "providers",
    title: "Your key, your model",
    body: "OpenAI, Claude, Gemini or local.",
    href: "/docs/providers",
  },
  {
    figure: "vault",
    title: "Local-first",
    body: "Notebooks stay on your device.",
    href: "/docs/privacy",
  },
  {
    figure: "exports",
    title: "Real exports",
    body: "Word, PowerPoint, Anki, Excel, SVG.",
    href: "/docs/studio",
  },
];

/** `true` and `false` draw a mark; a string is shown as written. */
export type Cell = boolean | string;

export const comparison: { label: string; vault: Cell; notebooklm: Cell }[] = [
  { label: "Open source", vault: "MIT", notebooklm: false },
  {
    label: "Choose your AI model",
    vault: "OpenAI, Claude, Gemini, local",
    notebooklm: "Gemini only",
  },
  { label: "Local, offline models", vault: true, notebooklm: false },
  { label: "No account needed", vault: true, notebooklm: false },
  { label: "Data stays on your device", vault: true, notebooklm: false },
  { label: "Self-host it", vault: true, notebooklm: false },
  { label: "Cited answers", vault: true, notebooklm: true },
  { label: "Reports, flashcards, quizzes, mind maps", vault: true, notebooklm: true },
  { label: "Slide decks and infographics", vault: true, notebooklm: true },
  { label: "Anatomy figures and whiteboard", vault: true, notebooklm: false },
  { label: "Audio overviews", vault: "Two hosts, ElevenLabs voices", notebooklm: true },
  { label: "Video overviews", vault: false, notebooklm: true },
  { label: "Notes with links and a graph", vault: true, notebooklm: false },
  { label: "Bots and plugins", vault: true, notebooklm: false },
];

export const roadmapTeaser: { icon: IconSvgElement; title: string; body: string }[] = [
  {
    icon: Notebook01Icon,
    title: "A notebook guide",
    body: "A summary, key topics and suggested questions for each notebook, and a goal, style and tutor mode for its chat.",
  },
  {
    icon: SourceCodeIcon,
    title: "Images, audio and deep research",
    body: "Pictures read by vision models, audio files transcribed, and web research that finds sources for you.",
  },
  {
    icon: PencilEdit02Icon,
    title: "Edit outputs with a prompt",
    body: "Change one slide, one section of a report or one branch of a mind map, and review a deck's outline first.",
  },
];

/** The landing page's notes section. */
export const notesFeatures: { title: string; body: string }[] = [
  {
    title: "Links that go both ways",
    body: "Type [[ to link a note, a notebook or a source. Every note shows what links to it, and renaming a note updates every link.",
  },
  {
    title: "A graph across your vaults",
    body: "See every note and link at once, with each vault in its own colour, or only what is near the note you're on.",
  },
  {
    title: "Canvas and shortcuts",
    body: "Lay ideas out as cards joined by arrows, saved as an open .canvas file. ⌘O, ⌘E, ⌘G and the other shortcuts keep your hands on the keyboard.",
  },
  {
    title: "Skills your agents share",
    body: "Keep SKILL.md instructions in a vault, use them in chat, and let Claude Code, Cursor or Codex read and edit them through MCP.",
  },
];

/** The landing page's plugins section: what a plugin can add, each with its guide. */
export const pluginKinds: { icon: IconSvgElement; title: string; body: string; href: string }[] = [
  {
    icon: DashboardSquareAddIcon,
    title: "Studio tools",
    body: "Add tools of your own beside Reports and Flashcards, each with its own dialog and viewer.",
    href: "/docs/plugins/studio-tools",
  },
  {
    icon: MagicWand01Icon,
    title: "Mods",
    body: "Reshape how the app looks and works, and turn each change on or off from Settings.",
    href: "/docs/plugins/mods",
  },
  {
    icon: PaintBoardIcon,
    title: "Themes",
    body: "Recolour the whole app in light and dark, and give the notes graph a new look.",
    href: "/docs/plugins/themes",
  },
];

export const faq: { question: string; answer: string }[] = [
  {
    question: "What is better-vault?",
    answer:
      "better-vault is a free, open-source alternative to Google NotebookLM. You add PDFs, web pages, notes and text files to a notebook, chat with them with cited answers, and turn them into reports, flashcards, quizzes, mind maps, slide decks and infographics, using the AI model you choose.",
  },
  {
    question: "Is better-vault free?",
    answer:
      "Yes. It is MIT-licensed and free to use and host. You pay your AI provider for what you use with your own API key, or nothing at all with a local model through Ollama or LM Studio.",
  },
  {
    question: "Can I use it with Claude, ChatGPT or Gemini models?",
    answer:
      "Yes. better-vault works with Anthropic's Claude, OpenAI's GPT and Google's Gemini models with your own API key, and you can switch models for each question.",
  },
  {
    question: "Does it work with local models?",
    answer:
      "Yes. Run better-vault on your computer and connect Ollama or LM Studio. Your sources then never leave your machine.",
  },
  {
    question: "Where is my data stored?",
    answer:
      "On your device: in your browser's IndexedDB on the web, or in a SQLite file on your computer in the desktop app. No account is needed, and no server database holds your notebooks. Requests are forwarded to the provider you pick, and keys and content are never stored or logged.",
  },
  {
    question: "Can I self-host it?",
    answer:
      "Yes. better-vault is a Vite app with a small API and no database. Run npm run build and npm start on any host with Node.js 22.12 or later, or use the desktop app for macOS, Windows and Linux.",
  },
  {
    question: "Does it make audio overviews like NotebookLM?",
    answer:
      "Yes. An Audio Overview is a conversation between two hosts about your sources, written by your chat model and spoken with ElevenLabs voices, with a transcript that cites your sources. Video overviews are out of scope.",
  },
  {
    question: "Is there a desktop app?",
    answer:
      "Yes. better-vault runs as a desktop app on macOS, Windows and Linux, with the same interface as the web app. It keeps notebooks in a file on your computer and updates itself.",
  },
];
