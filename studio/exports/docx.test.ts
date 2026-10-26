import { describe, expect, it } from "vitest";
import { flashcardsTool } from "@/studio/tools/flashcards/definition";
import { quizTool } from "@/studio/tools/quiz/definition";
import { reportTool } from "@/studio/tools/report/definition";
import { isRightToLeft, markdownToBlocks } from "./docx";
import { isFileExport } from "@/studio/types";

const text = {
  question: "Question",
  answer: "Answer",
  answerKey: "Answer key",
  sources: "Sources",
};

async function isWordFile(blob: Blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  // A .docx is a zip: it starts with "PK".
  return blob.size > 1000 && bytes[0] === 0x50 && bytes[1] === 0x4b;
}

describe("Word exports", () => {
  const passage = {
    n: 1,
    chunkId: "s:0",
    sourceId: "s",
    title: "Chapter One",
    kind: "pdf" as const,
    snippet: "Opportunity…",
  };

  it("builds a report with headings, lists, a table and footnotes", async () => {
    const markdown = [
      "## Key takeaways",
      "- Ideas need **testing** [1]",
      "1. First step",
      "2. Second step",
      "| Term | Meaning |",
      "| --- | --- |",
      "| MVP | Minimum viable product |",
      "> A quote from the source.",
    ].join("\n");
    const docx = reportTool.exports![0];
    expect(docx.format).toBe("docx");
    if (!isFileExport(docx)) throw new Error("expected a file export");
    expect(
      await isWordFile(await docx.build("Report", { markdown, passages: [passage] }, text)),
    ).toBe(true);
  });

  it("turns citations into footnotes and drops unknown ones", () => {
    const blocks = markdownToBlocks("A fact [1] and a stray [9].", [passage]);
    expect(blocks).toHaveLength(1);
  });

  it("builds quiz and flashcard documents", async () => {
    const quiz = {
      questions: [
        { question: "Q?", options: ["a", "b"], answer: 1, explanation: "Because.", hint: "" },
      ],
    };
    const [quizDocx] = quizTool.exports!;
    const [cardsDocx] = flashcardsTool.exports!;
    if (!isFileExport(quizDocx) || !isFileExport(cardsDocx))
      throw new Error("expected file exports");
    expect(await isWordFile(await quizDocx.build("Quiz", quiz, text))).toBe(true);
    const cards = { cards: [{ front: "Front", back: "Back" }] };
    expect(await isWordFile(await cardsDocx.build("Cards", cards, text))).toBe(true);
  });

  it("detects right-to-left text", () => {
    expect(isRightToLeft("ريادة الأعمال هي خلق القيمة")).toBe(true);
    expect(isRightToLeft("Entrepreneurship creates value")).toBe(false);
  });
});
