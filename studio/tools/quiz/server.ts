import { generateText, Output } from "ai";
import { z } from "zod";
import { clean, seededRandom, studioSystem, type Generator } from "@/studio/server/shared";
import { quizCounts, type QuizData, type QuizOptions, type QuizQuestion } from "./definition";

const LEVEL = {
  easy: "Questions check the main ideas; wrong options are clearly wrong.",
  medium: "Questions check main ideas and important details; wrong options are plausible.",
  hard: "Questions need careful reading and reasoning; wrong options are close to the truth.",
};

const schema = z.object({
  title: z.string().describe("A short title for the quiz"),
  questions: z.array(
    z.object({
      question: z.string(),
      options: z.array(z.string()).describe("Exactly four answer options"),
      answer: z.number().int().describe("Index (0 to 3) of the correct option"),
      explanation: z.string().describe("Why the correct option is right, one or two sentences"),
      hint: z.string().describe("A short hint that does not give the answer away"),
    }),
  ),
});

/** Moves the right answer to a random place, so it is not always first. */
export function shuffleOptions(question: QuizQuestion, random: () => number): QuizQuestion {
  const order = question.options.map((_, at) => at);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return { ...question, options: order.map((at) => question.options[at]), answer: order.indexOf(question.answer) };
}

export const generateQuiz: Generator<QuizOptions, QuizData> = async ({ model, options, abortSignal, ...args }) => {
  const count = quizCounts[options.amount];
  const { output } = await generateText({
    model,
    output: Output.object({ schema }),
    system: studioSystem(
      `Create a multiple-choice quiz of ${count} questions about the sources. ${LEVEL[options.difficulty]} Each question has exactly four options and one correct answer.`,
      args,
    ),
    prompt: `Create the ${count} questions now.`,
    abortSignal,
  });
  const random = seededRandom(output.title + output.questions.length);
  const questions = output.questions
    .map((q) => ({
      question: clean(q.question),
      options: q.options.map(clean).filter(Boolean),
      answer: q.answer,
      explanation: clean(q.explanation),
      hint: clean(q.hint),
    }))
    .filter((q) => q.question && q.options.length >= 2 && q.answer >= 0 && q.answer < q.options.length)
    .map((q) => shuffleOptions(q, random));
  if (questions.length === 0) throw new Error("The model returned no usable questions.");
  return { title: clean(output.title) || "Quiz", data: { questions } };
};
