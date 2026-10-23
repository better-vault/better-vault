"use client";

import { useTranslation } from "react-i18next";
import { FocusField } from "@/studio/shared/fields";
import type { ToolFormProps } from "@/studio/shared/form";
import type { DataTableOptions } from "./definition";

export function DataTableForm({ focus, onFocusChange }: ToolFormProps<DataTableOptions>) {
  const { t } = useTranslation("studio");
  return (
    <FocusField
      label={t("data-table.focusLabel")}
      placeholder={t("data-table.focusPlaceholder")}
      value={focus}
      onChange={onFocusChange}
      rows={4}
    />
  );
}
