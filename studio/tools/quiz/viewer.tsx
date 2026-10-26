"use client";

import {
  BulbIcon,
  CancelCircleIcon,
  CheckmarkCircle02Icon,
  RotateLeft01Icon,
} from "@hugeicons/core-free-icons";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/icon";
import { Button } from "@/components/panelui/button";
import { cn } from "@/lib/utils";
import type { ToolViewerProps } from "@/studio/shared/form";
import type { QuizData } from "./definition";

const LETTERS = "ABCDEFGH";

/** One question at a time: pick an answer, see why, and get a score at the end. */
export function QuizViewer({ data }: ToolViewerProps<QuizData>) {
  const { t } = useTranslation("studio");
  const total = data.questions.length;
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(() => data.questions.map(() => null));
  const [hint, setHint] = useState(false);
  const finished = index >= total;

  if (finished) {
    const score = answers.filter((answer, at) => answer === data.questions[at].answer).length;
    return (
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 py-16 text-center">
        <p className="text-4xl font-semibold tabular-nums">
          {score}/{total}
        </p>
        <p className="text-muted-foreground">{t("quiz.viewer.score", { score, total })}</p>
        <Button
          shape="pill"
          onClick={() => {
            setAnswers(data.questions.map(() => null));
            setIndex(0);
            setHint(false);
          }}
        >
          <Icon icon={RotateLeft01Icon} size={16} />
          {t("quiz.viewer.retry")}
        </Button>
      </div>
    );
  }

  const question = data.questions[index];
  const chosen = answers[index];
  const answered = chosen !== null;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 pb-10">
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground tabular-nums">
          {t("quiz.viewer.progress", { current: index + 1, total })}
        </p>
        <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-chart-3 transition-[width]"
            style={{ width: `${(index / total) * 100}%` }}
          />
        </div>
      </div>

      <h3 className="text-xl leading-snug font-semibold">{question.question}</h3>

      <div role="radiogroup" aria-label={question.question} className="flex flex-col gap-2">
        {question.options.map((option, at) => {
          const right = at === question.answer;
          const picked = at === chosen;
          return (
            <button
              key={at}
              type="button"
              role="radio"
              aria-checked={picked}
              disabled={answered}
              onClick={() =>
                setAnswers((list) => list.map((value, i) => (i === index ? at : value)))
              }
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 text-start transition-colors outline-none",
                "hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:hover:bg-transparent",
                answered && right && "border-success bg-success/10 disabled:hover:bg-success/10",
                answered &&
                  picked &&
                  !right &&
                  "border-destructive bg-destructive/10 disabled:hover:bg-destructive/10",
              )}
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                {LETTERS[at]}
              </span>
              <span className="min-w-0 flex-1 pt-0.5 text-[0.9375rem] leading-6">{option}</span>
              {answered && right ? (
                <Icon icon={CheckmarkCircle02Icon} size={18} className="mt-0.5 text-success" />
              ) : null}
              {answered && picked && !right ? (
                <Icon icon={CancelCircleIcon} size={18} className="mt-0.5 text-destructive" />
              ) : null}
            </button>
          );
        })}
      </div>

      {answered ? (
        <div className="rounded-2xl bg-muted/60 px-4 py-3 text-sm leading-6">
          <p
            className={cn(
              "font-semibold",
              chosen === question.answer ? "text-success" : "text-destructive",
            )}
          >
            {chosen === question.answer ? t("quiz.viewer.correct") : t("quiz.viewer.incorrect")}
          </p>
          <p className="mt-1">{question.explanation}</p>
        </div>
      ) : question.hint ? (
        hint ? (
          <p className="flex items-start gap-2 rounded-2xl bg-warning/10 px-4 py-3 text-sm leading-6">
            <Icon icon={BulbIcon} size={16} className="mt-1 shrink-0 text-warning" />
            {question.hint}
          </p>
        ) : (
          <button
            type="button"
            onClick={() => setHint(true)}
            className="inline-flex w-fit cursor-pointer items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            <Icon icon={BulbIcon} size={16} />
            {t("quiz.viewer.showHint")}
          </button>
        )
      ) : null}

      <div className="flex justify-end">
        <Button
          shape="pill"
          disabled={!answered}
          onClick={() => {
            setIndex(index + 1);
            setHint(false);
          }}
        >
          {index + 1 === total ? t("quiz.viewer.finish") : t("quiz.viewer.next")}
        </Button>
      </div>
    </div>
  );
}
