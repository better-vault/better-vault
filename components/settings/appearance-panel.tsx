"use client";

import { ComputerIcon, Moon02Icon, Sun03Icon } from "@hugeicons/core-free-icons";
import { useTranslation } from "react-i18next";
import { Field } from "@/components/common/field";
import { Segmented } from "@/components/common/segmented";
import { Icon } from "@/components/icon";
import { Sheet } from "@/components/panelui/sheet";
import { useTheme, type Theme } from "@/components/providers/theme-provider";

export function AppearancePanel() {
  const { t } = useTranslation("settings");
  const { theme, setTheme } = useTheme();

  return (
    <>
      <Sheet.Header title={t("appearance.title")} />
      <Sheet.Body>
        <div className="pb-4">
          <Field label={t("appearance.theme")}>
            <Segmented<Theme>
              aria-label={t("appearance.theme")}
              value={theme}
              onValueChange={setTheme}
              className="w-full *:flex-1"
              options={[
                { value: "system", label: t("appearance.system"), icon: <Icon icon={ComputerIcon} size={16} /> },
                { value: "light", label: t("appearance.light"), icon: <Icon icon={Sun03Icon} size={16} /> },
                { value: "dark", label: t("appearance.dark"), icon: <Icon icon={Moon02Icon} size={16} /> },
              ]}
            />
          </Field>
        </div>
      </Sheet.Body>
    </>
  );
}
