"use client";

import {
  BookOpen01Icon,
  DocumentValidationIcon,
  News01Icon,
  PencilEdit02Icon,
} from "@hugeicons/core-free-icons";
import { useTranslation } from "react-i18next";
import { FocusField, OptionCards } from "@/studio/shared/fields";
import type { ToolFormProps } from "@/studio/shared/form";
import type { ReportOptions } from "./definition";

const ICONS = {
  briefing: DocumentValidationIcon,
  "study-guide": BookOpen01Icon,
  "blog-post": News01Icon,
  custom: PencilEdit02Icon,
};

export function ReportForm({ value, onChange, focus, onFocusChange }: ToolFormProps<ReportOptions>) {
  const { t } = useTranslation("studio");
  return (
    <>
      <OptionCards
        label={t("report.format")}
        value={value.template}
        onChange={(template) => onChange({ ...value, template })}
        options={(["custom", "briefing", "study-guide", "blog-post"] as const).map((template) => ({
          value: template,
          title: t(`report.templates.${template}.name`),
          description: t(`report.templates.${template}.description`),
          icon: ICONS[template],
        }))}
      />
      {value.template === "custom" ? (
        <FocusField
          label={t("report.instructions")}
          placeholder={t("report.instructionsPlaceholder")}
          value={value.instructions}
          onChange={(instructions) => onChange({ ...value, instructions })}
          optional={false}
          rows={4}
        />
      ) : (
        <FocusField
          label={t("dialog.focus")}
          placeholder={t("dialog.focusPlaceholder")}
          value={focus}
          onChange={onFocusChange}
          rows={2}
        />
      )}
    </>
  );
}
