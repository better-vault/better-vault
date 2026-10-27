/**
 * What the site says about itself: used by page metadata, social cards,
 * JSON-LD, the sitemap, robots.txt and llms.txt. Keep the title under 60
 * characters and the description between 120 and 160, so search results
 * show them whole.
 */
export const site = {
  name: "better-vault",
  /** Override to point a preview deploy at its own host. */
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://better-vault.dev",
  /** For the <title> of the home page (with the name: 52 characters). */
  titleTagline: "The open-source NotebookLM alternative",
  /** For social cards, which have more room. */
  tagline: "The open-source NotebookLM alternative that runs on your own AI model",
  description:
    "Chat with your PDFs, notes and web pages with cited answers, and turn them into reports, flashcards, quizzes and mind maps. Use your own API key or local models.",
  /** One plain sentence that says what better-vault is, for answer engines. */
  definition:
    "better-vault is a free, open-source alternative to Google NotebookLM (now Gemini Notebook): you add your sources, chat with them with cited answers, and turn them into study and work material, using your own OpenAI, Anthropic or Google API key or local models through Ollama and LM Studio. Everything is stored in your browser.",
  repo: "https://github.com/better-vault/better-vault",
  license: "MIT",
  author: "Khalid Abdi",
  keywords: [
    "NotebookLM alternative",
    "open source NotebookLM",
    "Gemini Notebook alternative",
    "self-hosted NotebookLM",
    "bring your own API key",
    "chat with PDF",
    "AI notebook",
    "AI study tools",
    "flashcard generator",
    "quiz generator",
    "mind map generator",
    "local LLM",
    "Ollama",
    "LM Studio",
    "Claude",
    "ChatGPT",
    "Gemini",
    "local-first",
  ],
} as const;

/** Absolute URL for a path, for canonical tags, the sitemap and llms.txt. */
export function absoluteUrl(path = "/"): string {
  return new URL(path, site.url).toString();
}
