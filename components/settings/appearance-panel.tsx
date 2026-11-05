import { ComputerIcon, Moon02Icon, Sun03Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { useTranslation } from "react-i18next";
import { Field } from "@/components/common/field";
import { Segmented } from "@/components/common/segmented";
import { Icon } from "@/components/icon";
import { Sheet } from "@/components/panelui/sheet";
import { useTheme, type Theme } from "@/components/providers/theme-provider";
import { accents } from "@/lib/theme/script";
import { cn } from "@/lib/utils";

export function AppearancePanel() {
  const { t } = useTranslation("settings");
  const { theme, setTheme, accent, setAccent } = useTheme();

  return (
    <>
      <Sheet.Header title={t("appearance.title")} />
      <Sheet.Body>
        <div className="flex flex-col gap-5 pb-4">
          <Field label={t("appearance.theme")}>
            <Segmented<Theme>
              aria-label={t("appearance.theme")}
              value={theme}
              onValueChange={setTheme}
              className="w-full *:flex-1"
              options={[
                {
                  value: "system",
                  label: t("appearance.system"),
                  icon: <Icon icon={ComputerIcon} size={16} />,
                },
                {
                  value: "light",
                  label: t("appearance.light"),
                  icon: <Icon icon={Sun03Icon} size={16} />,
                },
                {
                  value: "dark",
                  label: t("appearance.dark"),
                  icon: <Icon icon={Moon02Icon} size={16} />,
                },
              ]}
            />
          </Field>
          <Field label={t("appearance.accent")} hint={t("appearance.accentHint")}>
            <div
              role="radiogroup"
              aria-label={t("appearance.accent")}
              className="grid grid-cols-8 gap-2"
            >
              {accents.map((value) => {
                const chosen = value === accent;
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={chosen}
                    aria-label={t(`appearance.accents.${value}`)}
                    title={t(`appearance.accents.${value}`)}
                    onClick={() => setAccent(value)}
                    className={cn(
                      "flex aspect-square items-center justify-center rounded-full ring-offset-2 ring-offset-background transition-[box-shadow,scale] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40 active:scale-95",
                      chosen && "ring-2 ring-foreground",
                    )}
                  >
                    <span
                      data-accent={value}
                      className={cn(
                        "flex size-full items-center justify-center rounded-full",
                        value === "default"
                          ? "bg-foreground text-background"
                          : "bg-primary text-primary-foreground",
                      )}
                    >
                      {chosen ? <Icon icon={Tick02Icon} size={14} /> : null}
                    </span>
                  </button>
                );
              })}
            </div>
          </Field>
        </div>
      </Sheet.Body>
    </>
  );
}
