import { AiBrain02Icon } from "@hugeicons/core-free-icons";
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/icon";
import { Button } from "@/components/panelui/button";
import { Menu } from "@/components/panelui/menu";
import { providers, type Effort, type ProviderId } from "@/lib/ai/catalog";
import { effortFor, updateProvider, type AppSettings } from "@/lib/db/settings";

/**
 * The chosen model's effort, switched from the prompt bar. It is the same
 * value as in the provider's settings, so the two never disagree.
 */
export function EffortMenu({
  settings,
  provider,
}: {
  settings: AppSettings;
  provider: ProviderId;
}) {
  const { t } = useTranslation();
  const levels = providers[provider].efforts;
  if (levels.length === 0) return null;
  const effort = effortFor(settings, provider);
  const name = t(`effort.levels.${effort}`);

  return (
    <Menu>
      <Menu.Trigger
        aria-label={`${t("effort.label")}: ${name}`}
        title={t("effort.label")}
        render={<Button variant="ghost" size="sm" shape="pill" className="gap-1.5 px-2.5" />}
      >
        <Icon icon={AiBrain02Icon} size={16} />
        <span className="hidden sm:inline">{name}</span>
      </Menu.Trigger>
      <Menu.Content side="top" align="start">
        <Menu.Group>
          <Menu.GroupLabel>{t("effort.label")}</Menu.GroupLabel>
          <Menu.RadioGroup
            value={effort}
            onValueChange={(next: unknown) =>
              typeof next === "string" && void updateProvider(provider, { effort: next as Effort })
            }
          >
            {levels.map((level) => (
              <Menu.RadioItem key={level} value={level}>
                {t(`effort.levels.${level}`)}
              </Menu.RadioItem>
            ))}
          </Menu.RadioGroup>
        </Menu.Group>
      </Menu.Content>
    </Menu>
  );
}
