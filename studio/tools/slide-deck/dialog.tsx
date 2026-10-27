"use client";

import { File01Icon, PresentationLineChart01Icon } from "@hugeicons/core-free-icons";
import { useTranslation } from "react-i18next";
import { ChoiceField, FocusField, OptionCards } from "@/studio/shared/fields";
import type { ToolFormProps } from "@/studio/shared/form";
import { slideFormats, slideLengths, type SlideDeckOptions } from "./definition";

const formatIcons = { detailed: File01Icon, presenter: PresentationLineChart01Icon } as const;

export function SlideDeckForm({
  value,
  onChange,
  focus,
  onFocusChange,
}: ToolFormProps<SlideDeckOptions>) {
  const { t } = useTranslation("studio");
  return (
    <>
      <OptionCards
        label={t("slide-deck.format")}
        value={value.format}
        onChange={(format) => onChange({ ...value, format })}
        columns={2}
        options={slideFormats.map((format) => ({
          value: format,
          title: t(`slide-deck.formats.${format}.name`),
          description: t(`slide-deck.formats.${format}.description`),
          icon: formatIcons[format],
        }))}
      />
      <ChoiceField
        label={t("slide-deck.length")}
        value={value.length}
        onChange={(length) => onChange({ ...value, length })}
        options={slideLengths.map((length) => ({
          value: length,
          label: t(`slide-deck.lengths.${length}`),
        }))}
      />
      <FocusField
        label={t("slide-deck.focusLabel")}
        placeholder={t("slide-deck.focusPlaceholder")}
        value={focus}
        onChange={onFocusChange}
      />
    </>
  );
}
