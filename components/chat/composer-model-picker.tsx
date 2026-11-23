import { useTranslation } from "react-i18next";
import { ModelPicker } from "@/components/panelui/model-picker";
import { ProviderIcon } from "@/components/provider-icon";
import {
  chatProviderIds,
  modelKey,
  parseModelKey,
  providers,
  type ModelRef,
} from "@/lib/ai/catalog";
import { availableModels, updateSettings, usesChatGPT, type AppSettings } from "@/lib/db/settings";

/**
 * The model picker in a prompt's footer, shared by the notebook chat and the
 * bots, so both list models, tags and favourites the same way.
 */
export function ComposerModelPicker({
  settings,
  model,
  onChange,
}: {
  settings: AppSettings;
  model: ModelRef;
  onChange: (next: ModelRef) => void;
}) {
  const { t } = useTranslation("chat");
  const { t: tSettings } = useTranslation("settings");
  const models = availableModels(settings);
  if (models.length === 0) return null;

  const items = models.map((ref) => {
    const info = providers[ref.provider];
    return {
      value: modelKey(ref),
      label: ref.modelId,
      provider: ref.provider,
      note: usesChatGPT(settings, ref.provider) ? tSettings("chatgpt.planLabel") : undefined,
      contextWindow: settings.providers[ref.provider].contextTokens[ref.modelId],
      tags: [
        ...(info.webSearch ? [t("modelTags.web")] : []),
        ...(info.local ? [t("modelTags.local")] : []),
      ],
    };
  });
  const pickerProviders = chatProviderIds
    .filter((id) => models.some((ref) => ref.provider === id))
    .map((id) => ({
      value: id,
      label: providers[id].name,
      icon: <ProviderIcon provider={id} size={20} />,
    }));

  return (
    <ModelPicker
      variant="rail"
      items={items}
      providers={pickerProviders}
      value={modelKey(model)}
      label={t("model")}
      favorites={settings.favoriteModels}
      onFavoritesChange={(favorites) =>
        void updateSettings((saved) => void (saved.favoriteModels = favorites))
      }
      onValueChange={(key) => {
        const next = parseModelKey(key);
        if (next) onChange(next);
      }}
    >
      <ModelPicker.Trigger appearance="ghost" className="max-w-48" placeholder={t("chooseModel")} />
      <ModelPicker.Content side="top" placeholder={t("searchModels")} emptyText={t("noModels")} />
    </ModelPicker>
  );
}
