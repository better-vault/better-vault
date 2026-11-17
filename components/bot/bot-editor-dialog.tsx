import { Loading03Icon } from "@hugeicons/core-free-icons";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Field } from "@/components/common/field";
import { Icon } from "@/components/icon";
import { Button } from "@/components/panelui/button";
import { Dialog } from "@/components/panelui/dialog";
import { Input } from "@/components/panelui/input";
import { Switch } from "@/components/panelui/switch";
import { Textarea } from "@/components/panelui/textarea";
import { botShapeIds } from "@/lib/bot/avatars";
import { botColor, botColorKeys } from "@/lib/bot/colors";
import type { NewBot } from "@/lib/db/bots";
import { cn } from "@/lib/utils";
import { BotAvatar } from "./bot-avatar";

export type BotDetails = Pick<
  NewBot,
  "name" | "title" | "instructions" | "avatar" | "canDelegate" | "pinned"
>;

interface BotEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initial: BotDetails;
  /** Saves; the dialog shows a spinner until it settles and closes after. */
  onSubmit: (details: BotDetails) => Promise<void>;
}

/** A bot's name, role, instructions and face: to make a bot, or to change one. */
export function BotEditorDialog({ open, onOpenChange, mode, ...props }: BotEditorDialogProps) {
  const { t } = useTranslation("bot");
  const { t: tCommon } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Dialog.Content size="lg" closeLabel={tCommon("actions.close")}>
        <Dialog.Header
          title={mode === "create" ? t("editor.createTitle") : t("editor.editTitle")}
          description={mode === "create" ? t("editor.createDescription") : undefined}
        />
        {/* Mounted only while open, so each opening starts from `initial`. */}
        <BotForm mode={mode} {...props} onDone={() => onOpenChange(false)} />
      </Dialog.Content>
    </Dialog>
  );
}

function BotForm({
  mode,
  initial,
  onSubmit,
  onDone,
}: Omit<BotEditorDialogProps, "open" | "onOpenChange"> & { onDone: () => void }) {
  const { t } = useTranslation("bot");
  const { t: tCommon } = useTranslation();
  const formId = useId();
  const nameId = useId();
  const roleId = useId();
  const instructionsId = useId();
  const [details, setDetails] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (change: Partial<BotDetails>) => setDetails((current) => ({ ...current, ...change }));
  const name = details.name.trim();

  async function submit() {
    if (!name || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit({ ...details, name, title: details.title.trim() });
      onDone();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Dialog.Body>
        <form
          id={formId}
          className="flex flex-col gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <div className="flex items-center gap-4">
            <BotAvatar avatar={details.avatar} size={72} followPointer />
            <div className="flex min-w-0 flex-1 flex-col gap-3">
              <Field label={t("editor.name")} htmlFor={nameId}>
                <Input
                  id={nameId}
                  value={details.name}
                  placeholder={t("editor.namePlaceholder")}
                  maxLength={80}
                  onChange={(event) => set({ name: event.target.value })}
                  autoFocus
                />
              </Field>
              <Field label={t("editor.role")} htmlFor={roleId}>
                <Input
                  id={roleId}
                  value={details.title}
                  placeholder={t("editor.rolePlaceholder")}
                  maxLength={200}
                  onChange={(event) => set({ title: event.target.value })}
                />
              </Field>
            </div>
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium">{t("editor.shape")}</legend>
            <div
              className="grid grid-cols-7 gap-1.5 sm:grid-cols-13"
              role="radiogroup"
              aria-label={t("editor.shape")}
            >
              {botShapeIds.map((shape) => (
                <button
                  key={shape}
                  type="button"
                  role="radio"
                  aria-checked={details.avatar.shape === shape}
                  aria-label={t(`shapes.${shape}`)}
                  title={t(`shapes.${shape}`)}
                  onClick={() => set({ avatar: { ...details.avatar, shape } })}
                  className={cn(
                    "flex aspect-square cursor-pointer items-center justify-center rounded-xl transition-colors outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
                    details.avatar.shape === shape && "bg-muted ring-1 ring-foreground/20",
                  )}
                >
                  <BotAvatar avatar={{ ...details.avatar, shape }} size={28} />
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium">{t("editor.color")}</legend>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("editor.color")}>
              {botColorKeys.map((color) => (
                <button
                  key={color}
                  type="button"
                  role="radio"
                  aria-checked={details.avatar.color === color}
                  aria-label={t(`colors.${color}`)}
                  title={t(`colors.${color}`)}
                  onClick={() => set({ avatar: { ...details.avatar, color } })}
                  className={cn(
                    "size-7 cursor-pointer rounded-full ring-offset-2 ring-offset-popover outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    botColor(color).swatch,
                    details.avatar.color === color && "ring-2 ring-foreground",
                  )}
                />
              ))}
            </div>
          </fieldset>

          <Field label={t("editor.instructions")} htmlFor={instructionsId}>
            <Textarea
              id={instructionsId}
              value={details.instructions}
              placeholder={t("editor.instructionsPlaceholder")}
              maxLength={20_000}
              minRows={4}
              maxRows={10}
              onChange={(event) => set({ instructions: event.target.value })}
            />
          </Field>

          <div className="flex flex-col gap-3">
            <label className="flex cursor-pointer items-center justify-between gap-4 text-sm">
              {t("editor.delegate")}
              <Switch
                checked={details.canDelegate ?? false}
                onCheckedChange={(on) => set({ canDelegate: on })}
              />
            </label>
            <label className="flex cursor-pointer items-center justify-between gap-4 text-sm">
              {t("editor.pinned")}
              <Switch
                checked={details.pinned ?? false}
                onCheckedChange={(on) => set({ pinned: on })}
              />
            </label>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </form>
      </Dialog.Body>
      <Dialog.Footer>
        <Dialog.Close render={<Button variant="secondary" />}>
          {tCommon("actions.cancel")}
        </Dialog.Close>
        <Button type="submit" form={formId} disabled={!name || busy} aria-busy={busy}>
          {busy ? <Icon icon={Loading03Icon} size={16} className="animate-spin" /> : null}
          {mode === "create" ? t("editor.create") : t("editor.save")}
        </Button>
      </Dialog.Footer>
    </>
  );
}
