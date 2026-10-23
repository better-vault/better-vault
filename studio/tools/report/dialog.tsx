"use client";

import {
  BookOpen01Icon,
  DocumentValidationIcon,
  News01Icon,
  PencilEdit02Icon,
  SparklesIcon,
} from "@hugeicons/core-free-icons";
import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";
import { ChoiceField, FocusField, OptionCards } from "@/studio/shared/fields";
import type { ToolFormProps } from "@/studio/shared/form";
import { reportLengths, type ReportOptions } from "./definition";
import { useReportSuggestions } from "./suggestions";

const ICONS = {
  briefing: DocumentValidationIcon,
  "study-guide": BookOpen01Icon,
  "blog-post": News01Icon,
  custom: PencilEdit02Icon,
};

export function ReportForm({ value, onChange, focus, onFocusChange, sourceIds }: ToolFormProps<ReportOptions>) {
  const { t, i18n } = useTranslation("studio");
  const suggestions = useReportSuggestions(sourceIds, i18n.language);
  const suggested = suggestions.items.findIndex(
    (item) => value.template === "custom" && item.instructions === value.instructions,
  );
  const selected = suggested >= 0 ? `suggestion-${suggested}` : value.template;

  return (
    <>
      <OptionCards
        label={t("report.format")}
        value={selected}
        onChange={(template) => onChange({ ...value, template, instructions: template === "custom" ? "" : value.instructions })}
        options={(["custom", "briefing", "study-guide", "blog-post"] as const).map((template) => ({
          value: template,
          title: t(`report.templates.${template}.name`),
          description: t(`report.templates.${template}.description`),
          icon: ICONS[template],
        }))}
      />

      {suggestions.status === "loading" ? (
        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-medium">{t("report.suggested")}</p>
          <p className="text-xs text-muted-foreground">{t("report.loadingSuggestions")}</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {[0, 1, 2, 3].map((at) => (
              <Skeleton key={at} className="h-[74px] rounded-2xl" />
            ))}
          </div>
        </div>
      ) : suggestions.items.length > 0 ? (
        <OptionCards
          label={t("report.suggested")}
          value={selected}
          onChange={(key) => {
            const item = suggestions.items[Number(key.replace("suggestion-", ""))];
            if (item) onChange({ ...value, template: "custom", instructions: item.instructions });
          }}
          options={suggestions.items.map((item, at) => ({
            value: `suggestion-${at}`,
            title: item.title,
            description: item.description,
            icon: SparklesIcon,
          }))}
        />
      ) : null}

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

      <ChoiceField
        label={t("report.length")}
        value={value.length}
        onChange={(length) => onChange({ ...value, length })}
        options={reportLengths.map((length) => ({ value: length, label: t(`report.lengths.${length}`) }))}
      />
    </>
  );
}
