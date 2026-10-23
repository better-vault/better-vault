"use client";

import { useTranslation } from "react-i18next";
import { ChoiceField, FocusField } from "@/studio/shared/fields";
import type { ToolFormProps } from "@/studio/shared/form";
import { amounts, difficulties } from "@/studio/tools/flashcards/definition";
import type { QuizOptions } from "./definition";

export function QuizForm({ value, onChange, focus, onFocusChange }: ToolFormProps<QuizOptions>) {
  const { t } = useTranslation("studio");
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <ChoiceField
          label={t("quiz.amount")}
          value={value.amount}
          onChange={(amount) => onChange({ ...value, amount })}
          options={amounts.map((amount) => ({ value: amount, label: t(`choices.${amount}`) }))}
        />
        <ChoiceField
          label={t("quiz.difficulty")}
          value={value.difficulty}
          onChange={(difficulty) => onChange({ ...value, difficulty })}
          options={difficulties.map((difficulty) => ({ value: difficulty, label: t(`choices.${difficulty}`) }))}
        />
      </div>
      <FocusField
        label={t("quiz.focusLabel")}
        placeholder={t("quiz.focusPlaceholder")}
        value={focus}
        onChange={onFocusChange}
      />
    </>
  );
}
