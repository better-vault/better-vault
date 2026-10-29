import { Notebook01Icon, PencilEdit02Icon, SourceCodeIcon } from "@hugeicons/core-free-icons";
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
}

export const features: Feature[] = [
  { figure: "citations", title: "Cited answers", body: "Every claim points to its passage." },
  { figure: "web", title: "Web mode", body: "Your provider's own search, when you want it." },
  { figure: "studio", title: "Nine Studio tools", body: "From reports to slide decks." },
  { figure: "providers", title: "Your key, your model", body: "OpenAI, Claude, Gemini or local." },
  { figure: "vault", title: "Local-first", body: "Notebooks stay on your device." },
  { figure: "exports", title: "Real exports", body: "Word, PowerPoint, Anki, Excel, SVG." },
];

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
    icon: PencilEdit02Icon,
    title: "Edit outputs with a prompt",
    body: "Change one slide, one section of a report or one branch of a mind map, and review a deck's outline first.",
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
      "On your device: in your browser's IndexedDB on the web, or in a SQLite file on your computer in the desktop app. There is no account and no server database. Requests are forwarded to the provider you pick, and keys and content are never stored or logged.",
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
      "Yes. better-vault runs as a desktop app on macOS, Windows and Linux, with the same interface as the web app. It keeps notebooks in a file on your computer and updates itself.",
  },
];
