import { cleanText } from "@/lib/grounding/clean";
import type { ChatMessage } from "./types";

/** Longest title made from a question, in characters. */
const MAX = 72;

/** A conversation's title: its first question on one line, shortened. Empty when there is none yet. */
export function conversationTitle(messages: readonly ChatMessage[]): string {
  const first = messages.find((message) => message.role === "user");
  const text = cleanText(
    first?.parts.flatMap((part) => (part.type === "text" ? [part.text] : [])).join(" ") ?? "",
  )
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= MAX) return text;
  const cut = text.slice(0, MAX);
  const space = cut.lastIndexOf(" ");
  return `${(space > MAX * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}
