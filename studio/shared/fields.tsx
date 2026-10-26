"use client";

import { ArrowDown01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { useId, useMemo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Field } from "@/components/common/field";
import { Segmented, type SegmentedOption } from "@/components/common/segmented";
import { Icon, type IconSvgElement } from "@/components/icon";
import { Label } from "@/components/panelui/label";
import { Menu } from "@/components/panelui/menu";
import { Select } from "@/components/panelui/select";
import { Textarea } from "@/components/panelui/textarea";
import type { Source } from "@/lib/db/database";
import { cn } from "@/lib/utils";
import { languageName, outputLanguages } from "@/studio/languages";

/** The language the output is written in. */
export function LanguageField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const { t, i18n } = useTranslation("studio");
  const id = useId();
  const items = useMemo(() => {
    const named = outputLanguages
      .map((code) => ({ value: code, label: languageName(code, i18n.language) }))
      .sort((a, b) => a.label.localeCompare(b.label, i18n.language));
    return [{ value: "auto", label: t("dialog.languageAuto") }, ...named];
  }, [i18n.language, t]);

  return (
    <Field label={t("dialog.language")} htmlFor={id}>
      <Select
        items={items}
        value={value}
        onValueChange={(next) => typeof next === "string" && onChange(next)}
      >
        <Select.Trigger id={id} className="w-full">
          <Select.Value />
        </Select.Trigger>
        <Select.Content className="max-h-72">
          {items.map((item) => (
            <Select.Item key={item.value} value={item.value}>
              {item.label}
            </Select.Item>
          ))}
        </Select.Content>
      </Select>
    </Field>
  );
}

/** Which of the notebook's sources the output is made from. */
export function SourcesField({
  sources,
  value,
  onChange,
}: {
  sources: Source[];
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const { t } = useTranslation("studio");
  const { t: tCommon } = useTranslation();
  const chosen = new Set(value);
  const all = sources.length > 0 && sources.every((source) => chosen.has(source.id));
  return (
    <Field label={t("dialog.sources")}>
      <Menu>
        <Menu.Trigger
          className={cn(
            "flex h-9 w-full cursor-pointer items-center justify-between gap-2 rounded-lg border border-input bg-background px-3 text-sm shadow-xs outline-none dark:bg-input/30",
            "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30",
          )}
        >
          <span className={cn("truncate", value.length === 0 && "text-destructive")}>
            {all ? t("dialog.allSources") : tCommon("sourceCount", { count: value.length })}
          </span>
          <Icon icon={ArrowDown01Icon} size={16} className="shrink-0 text-muted-foreground" />
        </Menu.Trigger>
        <Menu.Content align="start" className="max-h-72 min-w-(--anchor-width)">
          <Menu.CheckboxItem
            checked={all}
            onCheckedChange={(checked) =>
              onChange(checked ? sources.map((source) => source.id) : [])
            }
          >
            {t("dialog.allSources")}
          </Menu.CheckboxItem>
          <Menu.Separator />
          {sources.map((source) => (
            <Menu.CheckboxItem
              key={source.id}
              checked={chosen.has(source.id)}
              onCheckedChange={(checked) =>
                onChange(
                  checked
                    ? sources.filter((s) => chosen.has(s.id) || s.id === source.id).map((s) => s.id)
                    : value.filter((id) => id !== source.id),
                )
              }
            >
              <span className="truncate">{source.title}</span>
            </Menu.CheckboxItem>
          ))}
        </Menu.Content>
      </Menu>
    </Field>
  );
}

/** A free-text field for what the output should focus on. */
export function FocusField({
  label,
  placeholder,
  value,
  onChange,
  optional = true,
  rows = 3,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  optional?: boolean;
  rows?: number;
}) {
  const { t } = useTranslation("studio");
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>
        <Label.Text>{label}</Label.Text>
        {optional ? <Label.Hint>{t("dialog.optional")}</Label.Hint> : null}
      </Label>
      <Textarea
        id={id}
        minRows={rows}
        maxRows={8}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

/** A labelled choice of a few options, side by side. */
export function ChoiceField<Value extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: Value;
  onChange: (value: Value) => void;
  options: readonly SegmentedOption<Value>[];
}) {
  return (
    <Field label={label}>
      <Segmented<Value>
        aria-label={label}
        value={value}
        onValueChange={onChange}
        options={options}
        className="w-full *:flex-1"
      />
    </Field>
  );
}

export interface OptionCard<Value extends string> {
  value: Value;
  title: ReactNode;
  description?: ReactNode;
  icon?: IconSvgElement;
}

/** Larger choices, as cards in a grid: report formats, kinds of diagram. */
export function OptionCards<Value extends string>({
  label,
  value,
  onChange,
  options,
  columns = 2,
}: {
  label: string;
  /** The chosen option; any other value leaves every card unchosen. */
  value: string;
  onChange: (value: Value) => void;
  options: readonly OptionCard<Value>[];
  columns?: 2 | 3;
}) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-sm font-medium">{label}</legend>
      <div
        role="radiogroup"
        aria-label={label}
        className={cn(
          "grid grid-cols-1 gap-2",
          columns === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3",
        )}
      >
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(option.value)}
              className={cn(
                "relative flex cursor-pointer items-start gap-2.5 rounded-2xl border p-3 text-start transition-colors outline-none",
                "hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring",
                selected &&
                  "border-primary bg-primary/[0.04] ring-1 ring-primary hover:bg-primary/[0.06]",
              )}
            >
              {option.icon ? (
                <Icon
                  icon={option.icon}
                  size={18}
                  className="mt-0.5 shrink-0 text-muted-foreground"
                />
              ) : null}
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{option.title}</span>
                {option.description ? (
                  <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                    {option.description}
                  </span>
                ) : null}
              </span>
              {selected ? (
                <Icon icon={Tick02Icon} size={16} className="shrink-0 text-primary" />
              ) : null}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
