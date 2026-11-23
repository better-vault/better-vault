import { ComputerIcon, Moon02Icon, Sun03Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Field } from "@/components/common/field";
import { Segmented } from "@/components/common/segmented";
import { Icon } from "@/components/icon";
import { BotAvatar } from "@/components/bot/bot-avatar";
import { GraphLookPicker } from "@/components/notes/graph-look-picker";
import { LookPicker } from "@/components/bot/look-picker";
import { Button } from "@/components/panelui/button";
import { Sheet } from "@/components/panelui/sheet";
import { Switch } from "@/components/panelui/switch";
import { useTheme, type Theme } from "@/components/providers/theme-provider";
import { defaultAnswerAvatar, updateSettings, useSettings } from "@/lib/db/settings";
import type { BotAvatar as BotLook } from "@/lib/db/types";
import { FontError, fontAccept, removeAppFont, saveAppFont, useAppFont } from "@/lib/theme/font";
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
          <FontField />
          <Field label={t("appearance.graph")} hint={t("appearance.graphHint")}>
            <GraphLookPicker />
          </Field>
          <AnswerAvatarField />
        </div>
      </Sheet.Body>
    </>
  );
}

/** The character beside the notebook chat's finished answers, or none. */
function AnswerAvatarField() {
  const { t } = useTranslation("settings");
  const settings = useSettings();
  if (!settings) return null;
  const avatar = settings.answerAvatar;
  const save = (next: BotLook | null) =>
    void updateSettings((saved) => void (saved.answerAvatar = next));

  return (
    <div className="flex flex-col gap-4 border-t pt-5">
      <div className="flex items-center gap-3">
        <div className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-muted">
          {avatar ? <BotAvatar avatar={avatar} size={48} followPointer /> : null}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-sm font-medium">{t("appearance.answerAvatar")}</span>
          <span className="text-xs text-muted-foreground">{t("appearance.answerAvatarHint")}</span>
        </div>
        <Switch
          checked={avatar !== null}
          label={t("appearance.answerAvatar")}
          onCheckedChange={(on) => save(on ? { ...defaultAnswerAvatar } : null)}
        />
      </div>
      {avatar ? <LookPicker avatar={avatar} onChange={save} /> : null}
    </div>
  );
}

/** Upload a font for the whole app, or go back to the app's own. */
function FontField() {
  const { t } = useTranslation("settings");
  const font = useAppFont();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    setBusy(true);
    try {
      await saveAppFont(file);
      toast.success(t("appearance.fontAdded", { name: file.name }));
    } catch (error) {
      toast.error(
        error instanceof FontError && error.reason === "too-big"
          ? t("appearance.fontTooBig")
          : t("appearance.fontUnreadable"),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Field label={t("appearance.font")} hint={t("appearance.fontHint")}>
      <div className="flex flex-col gap-3 rounded-2xl bg-muted/60 p-3">
        <div className="flex items-center gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-background text-lg font-semibold">
            Aa
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-medium">
              {font ? font.name : t("appearance.fontDefault")}
            </span>
            <span className="text-xs text-muted-foreground">
              {font ? t("appearance.fontCustom") : t("appearance.fontBuiltIn")}
            </span>
          </div>
        </div>
        <input
          ref={input}
          type="file"
          accept={fontAccept}
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void upload(file);
          }}
        />
        <div className="flex gap-2 *:flex-1">
          <Button size="sm" disabled={busy} onClick={() => input.current?.click()}>
            {font ? t("appearance.fontReplace") : t("appearance.fontUpload")}
          </Button>
          {font ? (
            <Button size="sm" variant="secondary" onClick={() => void removeAppFont()}>
              {t("appearance.fontRemove")}
            </Button>
          ) : null}
        </div>
      </div>
    </Field>
  );
}
