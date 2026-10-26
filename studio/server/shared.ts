import type { ImageModel, LanguageModel } from "ai";
import type { ModelRef } from "@/lib/ai/catalog";
import { formatPassages, type Passage } from "@/lib/grounding/passages";
import { languageName } from "@/studio/languages";

export interface GenerateArgs<Options> {
  model: LanguageModel;
  options: Options;
  /** "auto" or a BCP 47 code. */
  language: string;
  focus: string;
  passages: Passage[];
  /** The image model chosen for the output, for tools that draw pictures. */
  image?: { model: ImageModel; ref: ModelRef };
  abortSignal?: AbortSignal;
}

export interface Generated<Data> {
  title: string;
  data: Data;
}

export type Generator<Options, Data> = (args: GenerateArgs<Options>) => Promise<Generated<Data>>;

export function languageRule(language: string): string {
  return language === "auto"
    ? "Write in the main language of the sources."
    : `Write everything, including the title, in ${languageName(language, "en")}, whatever the language of the sources.`;
}

/** The system prompt every Studio tool starts from. */
export function studioSystem(
  task: string,
  args: Pick<GenerateArgs<unknown>, "language" | "focus" | "passages">,
) {
  return [
    "You are better-vault's Studio. You turn the user's sources into study material.",
    task,
    "Use only what the numbered passages below say. Do not add facts from outside them.",
    languageRule(args.language),
    args.focus.trim() ? `The user asked you to focus on this:\n"""${args.focus.trim()}"""` : "",
    formatPassages(args.passages),
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** A small deterministic random generator, so the same input gives the same shuffle. */
export function seededRandom(seed: string): () => number {
  let state = 2166136261;
  for (let i = 0; i < seed.length; i++) state = Math.imul(state ^ seed.charCodeAt(i), 16777619);
  return () => {
    state = Math.imul(state ^ (state >>> 15), 2246822507);
    state = Math.imul(state ^ (state >>> 13), 3266489909);
    state ^= state >>> 16;
    return (state >>> 0) / 4294967296;
  };
}

export const clean = (text: string) => text.replace(/\s+/g, " ").trim();
