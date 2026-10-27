import {
  AiChat02Icon,
  ComputerIcon,
  Download04Icon,
  GlobalSearchIcon,
  Key01Icon,
  LockKeyIcon,
  Notebook01Icon,
  SourceCodeIcon,
  SparklesIcon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";
import type { StudioToolId } from "@/studio/tools";

/*
 * The landing page's words. The website and docs are English only, so they
 * are written here rather than in the app's i18next locales (see AGENTS.md).
 * The FAQ also feeds the page's FAQPage JSON-LD and llms.txt, so the answers
 * an assistant reads are the ones a visitor reads.
 */

export interface Feature {
  icon: IconSvgElement;
  title: string;
  body: string;
  href: string;
}

export const features: Feature[] = [
  {
    icon: AiChat02Icon,
    title: "Answers with citations",
    body: "Ask questions about your sources. Every claim is marked with a numbered citation you can point at to read the passage.",
    href: "/docs/chat",
  },
  {
    icon: GlobalSearchIcon,
    title: "Web mode",
    body: "Let the model search the internet with its provider's built-in search, and cite the pages it used.",
    href: "/docs/chat#web-mode",
  },
  {
    icon: SparklesIcon,
    title: "Nine Studio tools",
    body: "Reports, flashcards, quizzes, data tables, mind maps, slide decks, infographics, Anatomy figures and a whiteboard.",
    href: "/docs/studio",
  },
  {
    icon: Key01Icon,
    title: "Your key, your model",
    body: "OpenAI, Anthropic Claude or Google Gemini with your own API key. Switch models for each question.",
    href: "/docs/providers",
  },
  {
    icon: LockKeyIcon,
    title: "Local-first and private",
    body: "Notebooks stay in your browser. No account, no server database, and keys are never stored or logged.",
    href: "/docs/privacy",
  },
  {
    icon: Download04Icon,
    title: "Real exports",
    body: "Word, PowerPoint with speaker notes, Excel, Anki CSV, Markdown, SVG and PNG. Your work leaves with you.",
    href: "/docs/studio",
  },
];

/** One line per Studio tool, in the Studio sheet's order. */
export const toolBlurbs: Record<StudioToolId, { name: string; body: string }> = {
  report: { name: "Report", body: "Briefing docs, study guides, blog posts or your own format." },
  flashcards: { name: "Flashcards", body: "Flip cards to test yourself. Export to Anki." },
  quiz: { name: "Quiz", body: "Multiple choice with hints, explanations and a score." },
  "mind-map": { name: "Mind map", body: "An interactive map, or 11 other diagram kinds." },
  "data-table": { name: "Data table", body: "Facts from your sources in rows and columns." },
  anatomy: { name: "Anatomy", body: "A 3D-style figure you can take apart." },
  "slide-deck": { name: "Slide deck", body: "A deck to read, or slides with speaker notes." },
  infographic: { name: "Infographic", body: "A one-page picture from your image model." },
  whiteboard: { name: "Whiteboard", body: "Sketch, diagram and draw over your figures." },
};

export const providers = [
  { name: "OpenAI", note: "GPT models, web search, GPT Image" },
  { name: "Anthropic", note: "Claude models, web search" },
  { name: "Google", note: "Gemini models, Google Search, image models" },
  { name: "Ollama", note: "Local models, offline" },
  { name: "LM Studio", note: "Local models, offline" },
] as const;

/** `true` and `false` draw a mark; a string is shown as written. */
export type Cell = boolean | string;

export const comparison: { label: string; vault: Cell; notebooklm: Cell }[] = [
  { label: "Open source", vault: "MIT", notebooklm: false },
  { label: "Choose your AI model", vault: "OpenAI, Claude, Gemini, local", notebooklm: "Gemini only" },
  { label: "Local, offline models", vault: true, notebooklm: false },
  { label: "No account needed", vault: true, notebooklm: false },
  { label: "Data stays on your device", vault: true, notebooklm: false },
  { label: "Self-host it", vault: true, notebooklm: false },
  { label: "Cited answers", vault: true, notebooklm: true },
  { label: "Reports, flashcards, quizzes, mind maps", vault: true, notebooklm: true },
  { label: "Slide decks and infographics", vault: true, notebooklm: true },
  { label: "Anatomy figures and whiteboard", vault: true, notebooklm: false },
  { label: "Audio and video overviews", vault: false, notebooklm: true },
];

export const roadmapTeaser: { icon: IconSvgElement; title: string; body: string }[] = [
  {
    icon: Notebook01Icon,
    title: "Notes and a notebook guide",
    body: "Save answers as notes, get a summary and suggested questions, and set the chat's goal and style.",
  },
  {
    icon: SourceCodeIcon,
    title: "More sources and deep research",
    body: "DOCX, EPUB, YouTube, images and audio, plus web research that adds sources for you.",
  },
  {
    icon: ComputerIcon,
    title: "A desktop app",
    body: "macOS, Windows and Linux, with notebooks as files on disk and offline local models.",
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
      "In your browser's IndexedDB. There is no account and no server database. Requests are forwarded to the provider you pick, and keys and content are never stored or logged.",
  },
  {
    question: "Can I self-host it?",
    answer:
      "Yes. better-vault is a Next.js app with no database. Run npm run build and npm start on any Node.js 20.9+ host, or deploy it to Vercel.",
  },
  {
    question: "Does it make audio overviews like NotebookLM?",
    answer:
      "No. Audio and video overviews are out of scope. better-vault focuses on cited chat and written and visual outputs.",
  },
  {
    question: "Is there a desktop app?",
    answer:
      "Not yet. An Electron app for macOS, Windows and Linux is on the roadmap, with notebooks stored as files and offline local models.",
  },
];
