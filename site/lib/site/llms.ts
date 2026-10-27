import type { Item as TreeItem, Node as TreeNode } from "fumadocs-core/page-tree";
import { faq } from "@/lib/site/copy";
import { absoluteUrl, site } from "@/lib/site/config";
import { source } from "@/lib/source";

/*
 * llms.txt (https://llmstxt.org): what better-vault is, its key facts, and a
 * map of the docs with absolute links, so an assistant can answer a question
 * about it or fetch the one page it needs. Built from the docs' page tree, so
 * new pages appear without editing this file.
 */

const SELF = new Set(["/llms.txt", "/llms.md"]);

function titleOf(node: TreeNode): string {
  if (node.type === "page") {
    const page = source.getNodePage(node);
    if (page?.data.title) return page.data.title;
  }
  return typeof node.name === "string" ? node.name : "";
}

function itemOf(node: TreeItem): string {
  const page = source.getNodePage(node);
  const description = page?.data.description?.trim();
  const link = `- [${titleOf(node)}](${absoluteUrl(node.url)})`;
  return description ? `${link}: ${description}` : link;
}

const KEY_FACTS = [
  "Open source under the MIT license; free to use and self-host.",
  "An alternative to Google NotebookLM (renamed Gemini Notebook in 2026).",
  "Providers: OpenAI, Anthropic (Claude), Google (Gemini) with the user's own API key, or local models through Ollama and LM Studio.",
  "Chat answers cite numbered passages from the user's sources; Web mode uses the provider's built-in web search.",
  "Studio tools: Report, Flashcards, Quiz, Data table, Mind map (plus 11 diagram kinds), Slide deck, Infographic, Anatomy, Whiteboard.",
  "Sources: PDF, Markdown and text files, web pages and pasted text.",
  "Local-first: notebooks are stored in the browser (IndexedDB); no account, no server database.",
  "No audio or video overviews.",
  `Runs on your own machine (npm run dev) or your own server; there is no hosted service. Source code: ${site.repo}.`,
  "Built with Next.js 16 and the Vercel AI SDK.",
];

/** The index served at /llms.txt and /llms.md. */
export function llmsIndex(): string {
  const lines: string[] = [
    `# ${site.name}`,
    "",
    `> ${site.definition}`,
    "",
    "## Key facts",
    "",
    ...KEY_FACTS.map((fact) => `- ${fact}`),
  ];

  const walk = (nodes: TreeNode[]): void => {
    for (const node of nodes) {
      if (node.type === "separator") {
        lines.push("", `## ${titleOf(node) || "Docs"}`, "");
      } else if (node.type === "folder") {
        if (node.index) lines.push(itemOf(node.index));
        walk(node.children);
      } else if (!SELF.has(node.url) && !node.external) {
        lines.push(itemOf(node));
      }
    }
  };
  walk(source.pageTree.children);

  lines.push(
    "",
    "## Optional",
    "",
    `- [Full documentation in one file](${absoluteUrl("/llms-full.txt")}): every docs page as Markdown.`,
    `- [Source code on GitHub](${site.repo}): README, AGENTS.md and CHANGELOG.md.`,
  );
  return `${lines.join("\n").trim()}\n`;
}

/** Every docs page as Markdown, in sidebar order, plus the FAQ. */
export async function llmsFull(): Promise<string> {
  const parts: string[] = [`# ${site.name} documentation`, "", `> ${site.definition}`];
  for (const page of source.getPages()) {
    const raw = await page.data.getText("processed");
    parts.push("", "---", "", `# ${page.data.title}`, "", `URL: ${absoluteUrl(page.url)}`, "", raw.trim());
  }
  parts.push("", "---", "", "# Frequently asked questions", "");
  for (const item of faq) parts.push(`## ${item.question}`, "", item.answer, "");
  return `${parts.join("\n").trim()}\n`;
}

/** A rough token count for the X-Markdown-Tokens header (four characters a token). */
export function approximateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
