"use client";

import { useTranslation } from "react-i18next";
import { ChoiceField, FocusField } from "@/studio/shared/fields";
import type { ToolFormProps } from "@/studio/shared/form";
import { anatomyDetails, type AnatomyOptions } from "./definition";

export function AnatomyForm({
  value,
  onChange,
  focus,
  onFocusChange,
}: ToolFormProps<AnatomyOptions>) {
  const { t } = useTranslation("studio");
  return (
    <>
      <ChoiceField
        label={t("anatomy.detail")}
        value={value.detail}
        onChange={(detail) => onChange({ ...value, detail })}
        options={anatomyDetails.map((detail) => ({
          value: detail,
          label: t(`anatomy.details.${detail}`),
        }))}
      />
      <p className="-mt-2 text-xs text-muted-foreground">
        {t(`anatomy.detailHints.${value.detail}`)}
      </p>
      <FocusField
        label={t("anatomy.focusLabel")}
        placeholder={t("anatomy.focusPlaceholder")}
        value={focus}
        onChange={onFocusChange}
      />
    </>
  );
}
