"use client";

import { useEffect, useId, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Field } from "@/components/common/field";
import { Alert } from "@/components/panelui/alert";
import { Button } from "@/components/panelui/button";
import { Select } from "@/components/panelui/select";
import { useWorkspace } from "@/components/workspace/workspace-context";
import { modelKey, parseModelKey, providers, type ImageProviderId } from "@/lib/ai/catalog";
import { activeModel, availableImageModels, useSettings } from "@/lib/db/settings";
import { ChoiceField, FocusField, OptionCards } from "@/studio/shared/fields";
import type { ToolFormProps } from "@/studio/shared/form";
import {
  infographicDetails,
  infographicStyles,
  orientations,
  type InfographicOptions,
} from "./definition";

export function InfographicForm({
  value,
  onChange,
  focus,
  onFocusChange,
}: ToolFormProps<InfographicOptions>) {
  const { t } = useTranslation("studio");
  const { closeTool, setSettingsOpen } = useWorkspace();
  const settings = useSettings();
  const id = useId();
  const models = useMemo(() => (settings ? availableImageModels(settings) : []), [settings]);
  const chat = settings ? activeModel(settings) : null;
  const chosen = value.imageModel;
  const chosenAvailable = chosen
    ? models.some((model) => modelKey(model) === modelKey(chosen))
    : false;

  // Picks an image model when none is chosen or the chosen one is gone:
  // the chat model's provider first, so one key is enough.
  useEffect(() => {
    if (!settings || chosenAvailable) return;
    const preferred =
      models.find((model) => model.provider === chat?.provider) ?? models[0] ?? null;
    if (preferred || chosen) {
      onChange({ ...value, imageModel: preferred as InfographicOptions["imageModel"] });
    }
  }, [settings, chosenAvailable, models, chat?.provider, chosen, onChange, value]);

  if (settings && models.length === 0) {
    return (
      <Alert tone="info" variant="plain">
        <Alert.Title>{t("infographic.noKey.title")}</Alert.Title>
        <Alert.Description>{t("infographic.noKey.body")}</Alert.Description>
        <Alert.Actions>
          <Button
            size="sm"
            onClick={() => {
              closeTool();
              setSettingsOpen(true);
            }}
          >
            {t("infographic.noKey.action")}
          </Button>
        </Alert.Actions>
      </Alert>
    );
  }

  const groups = [...new Set(models.map((model) => model.provider))] as ImageProviderId[];
  const items = models.map((model) => ({ value: modelKey(model), label: model.modelId }));

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <ChoiceField
          label={t("infographic.orientation")}
          value={value.orientation}
          onChange={(orientation) => onChange({ ...value, orientation })}
          options={orientations.map((orientation) => ({
            value: orientation,
            label: t(`infographic.orientations.${orientation}`),
          }))}
        />
        <ChoiceField
          label={t("infographic.detail")}
          value={value.detail}
          onChange={(detail) => onChange({ ...value, detail })}
          options={infographicDetails.map((detail) => ({
            value: detail,
            label: t(`infographic.details.${detail}`),
          }))}
        />
      </div>
      <OptionCards
        label={t("infographic.style")}
        value={value.style}
        onChange={(style) => onChange({ ...value, style })}
        columns={3}
        options={infographicStyles.map((style) => ({
          value: style,
          title: t(`infographic.styles.${style}.name`),
          description: t(`infographic.styles.${style}.description`),
        }))}
      />
      <Field label={t("infographic.imageModel")} htmlFor={id}>
        <Select
          items={items}
          value={chosen && chosenAvailable ? modelKey(chosen) : null}
          onValueChange={(next) => {
            const model = typeof next === "string" ? parseModelKey(next) : null;
            if (model)
              onChange({ ...value, imageModel: model as InfographicOptions["imageModel"] });
          }}
        >
          <Select.Trigger id={id} className="w-full">
            <Select.Value />
          </Select.Trigger>
          <Select.Content className="max-h-72">
            {groups.map((provider) => (
              <Select.Group key={provider}>
                <Select.GroupLabel>{providers[provider].name}</Select.GroupLabel>
                {models
                  .filter((model) => model.provider === provider)
                  .map((model) => (
                    <Select.Item key={modelKey(model)} value={modelKey(model)}>
                      {model.modelId}
                    </Select.Item>
                  ))}
              </Select.Group>
            ))}
          </Select.Content>
        </Select>
      </Field>
      {chat && chosen ? (
        <p className="-mt-2 text-xs text-muted-foreground">
          {t("infographic.who", { chat: chat.modelId, image: chosen.modelId })}
        </p>
      ) : null}
      <FocusField
        label={t("infographic.focusLabel")}
        placeholder={t("infographic.focusPlaceholder")}
        value={focus}
        onChange={onFocusChange}
      />
    </>
  );
}
