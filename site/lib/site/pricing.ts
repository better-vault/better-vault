/**
 * The pricing page's plans and comparison. The app itself is free and open
 * source; the plans add Better Vault AI (answers without an API key) and
 * Better Vault Cloud. Keep these in step with better-vault-backend's
 * src/credits.ts and the Polar products.
 */
export interface Plan {
  id: "free" | "pro" | "max";
  name: string;
  price: string;
  per: string;
  tagline: string;
  features: string[];
  cta: { label: string; href: string };
  featured?: boolean;
}

export const plans: Plan[] = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    per: "forever",
    tagline: "Everything in better-vault, with your own API keys.",
    features: [
      "Notebooks, chat with citations and every Studio tool",
      "Notes with links, graph and canvas",
      "Bring your own key: OpenAI, Anthropic, Google, DeepSeek and more",
      "Local models with Ollama and LM Studio",
      "Your data stays on your device",
    ],
    cta: { label: "Download", href: "/download" },
  },
  {
    id: "pro",
    name: "Pro",
    price: "$4.99",
    per: "a month",
    tagline: "Better Vault AI, without an API key.",
    features: [
      "Everything in Free",
      "Better Vault AI with 1,250 AI credits a month",
      "20 GB of Better Vault Cloud for backups and exports",
      "Extra usage when you want it, capped by you",
    ],
    cta: { label: "Get Pro", href: "/download" },
    featured: true,
  },
  {
    id: "max",
    name: "Max",
    price: "$9.99",
    per: "a month",
    tagline: "For heavy use and big libraries.",
    features: [
      "Everything in Pro",
      "Better Vault AI with 3,500 AI credits a month",
      "50 GB of Better Vault Cloud",
    ],
    cta: { label: "Get Max", href: "/download" },
  },
];

export type Cell = boolean | string;

export const comparisonGroups: {
  title: string;
  rows: { label: string; free: Cell; pro: Cell; max: Cell }[];
}[] = [
  {
    title: "AI",
    rows: [
      { label: "Your own API keys", free: true, pro: true, max: true },
      { label: "Local models (Ollama, LM Studio)", free: true, pro: true, max: true },
      { label: "Better Vault AI, no key needed", free: false, pro: true, max: true },
      { label: "AI credits a month", free: "—", pro: "1,250", max: "3,500" },
      {
        label: "Extra usage past the credits",
        free: "—",
        pro: "$2 per 1,000 credits",
        max: "$2 per 1,000 credits",
      },
    ],
  },
  {
    title: "Storage",
    rows: [
      { label: "Notebooks on your device", free: true, pro: true, max: true },
      { label: "Google Drive, OneDrive, S3 and R2", free: true, pro: true, max: true },
      { label: "Better Vault Cloud", free: false, pro: "20 GB", max: "50 GB" },
    ],
  },
  {
    title: "Studio and notes",
    rows: [
      {
        label: "Reports, flashcards, quizzes, mind maps and more",
        free: true,
        pro: true,
        max: true,
      },
      { label: "Visuals in chat answers", free: true, pro: true, max: true },
      { label: "Notes with [[links]], graph and canvas", free: true, pro: true, max: true },
      { label: "Audio overviews (with an ElevenLabs key)", free: true, pro: true, max: true },
    ],
  },
  {
    title: "Desktop and agents",
    rows: [
      { label: "macOS, Windows and Linux apps", free: true, pro: true, max: true },
      { label: "MCP for Claude Code, Cursor and Codex", free: true, pro: true, max: true },
      { label: "Shared skills", free: true, pro: true, max: true },
    ],
  },
  {
    title: "Privacy",
    rows: [
      { label: "Open source (MIT)", free: true, pro: true, max: true },
      { label: "Your API keys never leave your device", free: true, pro: true, max: true },
      { label: "No account needed", free: true, pro: false, max: false },
    ],
  },
];

export const pricingFaq: { question: string; answer: string }[] = [
  {
    question: "Do I need a plan to use better-vault?",
    answer:
      "No. better-vault is free and open source. With your own API key, or a local model, every feature works without an account. A plan adds Better Vault AI, so you can ask without a key, and Better Vault Cloud.",
  },
  {
    question: "What is an AI credit?",
    answer:
      "Credits measure how much Better Vault AI you use. A short question uses a fraction of a credit; a long answer over many sources uses more. Settings → Subscription shows what you have used and what is left, and credits renew each month.",
  },
  {
    question: "What happens when my credits run out?",
    answer:
      "Better Vault AI pauses until the next month, unless you turn on extra usage in Settings → Subscription. Extra usage costs $2 per 1,000 credits, up to a monthly limit you choose. Your own API keys keep working either way.",
  },
  {
    question: "Are my API keys or notebooks sent to Better Vault?",
    answer:
      "No. Your notebooks, notes and API keys stay on your device. Only the questions you ask Better Vault AI, and the files you choose to put in Better Vault Cloud, go to our servers.",
  },
  {
    question: "Can I cancel any time?",
    answer:
      "Yes. Cancel in Settings → Subscription → Manage, and your plan stays until the end of the month you paid for. Payments and invoices are handled by Polar.",
  },
];
