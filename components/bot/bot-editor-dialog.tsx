import { Loading03Icon } from "@hugeicons/core-free-icons";
import { useId, useState, type CSSProperties, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Field } from "@/components/common/field";
import { Segmented } from "@/components/common/segmented";
import { useVaultName } from "@/components/home/vault-name";
import { Icon } from "@/components/icon";
import { Button } from "@/components/panelui/button";
import { Dialog } from "@/components/panelui/dialog";
import { Input } from "@/components/panelui/input";
import { Select } from "@/components/panelui/select";
import { Switch } from "@/components/panelui/switch";
import { Tabs } from "@/components/panelui/tabs";
import { Textarea } from "@/components/panelui/textarea";
import { botAccess } from "@/lib/bot/access";
import type { NewBot } from "@/lib/db/bots";
import type { BotAccess } from "@/lib/db/types";
import { useVaults } from "@/lib/db/vaults";
import { BotAvatar } from "./bot-avatar";
import { LookPicker } from "./look-picker";

export type BotDetails = Pick<
  NewBot,
  | "name"
  | "title"
  | "instructions"
  | "avatar"
  | "canDelegate"
  | "canCreateBots"
  | "access"
  | "pinned"
>;

const ALL = "";

function AccessRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-8 items-center justify-between gap-4 text-sm">
      <span>{label}</span>
      {children}
    </div>
  );
}

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
  const [tab, setTab] = useState<"profile" | "access">("profile");
  const access = botAccess(details);
  const setAccess = (change: Partial<BotAccess>) => {
    const next: BotAccess = { ...access, ...change };
    if (next.vault === undefined) delete next.vault;
    set({ access: next });
  };
  const vaults = useVaults();
  const vaultName = useVaultName();
  const vaultItems = [
    { value: ALL, label: t("access.allVaults") },
    ...(vaults ?? []).map((vault) => ({ value: vault.id, label: vaultName(vault) })),
  ];
  const levels = (["none", "read", "write"] as const).map((value) => ({
    value,
    label: t(`access.${value}`),
  }));

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
      <Dialog.Body style={{ "--bot-surface": "var(--popover)" } as CSSProperties}>
        <form
          id={formId}
          className="flex flex-col gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <Tabs
            value={tab}
            onValueChange={(next) => setTab(next === "access" ? "access" : "profile")}
          >
            <Tabs.List aria-label={t("editor.editTitle")} className="w-full">
              <Tabs.Trigger value="profile" className="flex-1">
                {t("access.profileTab")}
              </Tabs.Trigger>
              <Tabs.Trigger value="access" className="flex-1">
                {t("access.tab")}
              </Tabs.Trigger>
            </Tabs.List>
            <Tabs.Content value="profile" className="flex flex-col gap-5 pt-5">
              <div className="flex items-center gap-4">
                <BotAvatar avatar={details.avatar} size={96} followPointer />
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

              <LookPicker avatar={details.avatar} onChange={(avatar) => set({ avatar })} />

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

              <label className="flex cursor-pointer items-center justify-between gap-4 text-sm">
                {t("editor.pinned")}
                <Switch
                  checked={details.pinned ?? false}
                  onCheckedChange={(on) => set({ pinned: on })}
                />
              </label>
            </Tabs.Content>
            <Tabs.Content value="access" className="flex flex-col gap-5 pt-5">
              <p className="text-sm text-muted-foreground">{t("access.intro")}</p>
              <div className="flex flex-col gap-3">
                <AccessRow label={t("access.notebooks")}>
                  <Switch
                    checked={access.notebooks}
                    onCheckedChange={(on) => setAccess({ notebooks: on })}
                    label={t("access.notebooks")}
                  />
                </AccessRow>
                <AccessRow label={t("access.notes")}>
                  <Segmented
                    size="sm"
                    aria-label={t("access.notes")}
                    value={access.notes}
                    onValueChange={(notes) => setAccess({ notes })}
                    options={levels}
                  />
                </AccessRow>
                <AccessRow label={t("access.calendar")}>
                  <Segmented
                    size="sm"
                    aria-label={t("access.calendar")}
                    value={access.calendar}
                    onValueChange={(calendar) => setAccess({ calendar })}
                    options={levels}
                  />
                </AccessRow>
                <AccessRow label={t("access.skills")}>
                  <Segmented
                    size="sm"
                    aria-label={t("access.skills")}
                    value={access.skills}
                    onValueChange={(skills) => setAccess({ skills })}
                    options={levels}
                  />
                </AccessRow>
              </div>

              <Field label={t("access.vault")} hint={t("access.vaultHint")}>
                <Select
                  items={vaultItems}
                  value={access.vault ?? ALL}
                  onValueChange={(next) =>
                    typeof next === "string" &&
                    setAccess({ vault: next === ALL ? undefined : next })
                  }
                >
                  <Select.Trigger aria-label={t("access.vault")} className="w-full">
                    <Select.Value />
                  </Select.Trigger>
                  <Select.Content>
                    {vaultItems.map((item) => (
                      <Select.Item key={item.value} value={item.value}>
                        {item.label}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select>
              </Field>

              <fieldset className="flex flex-col gap-3">
                <legend className="mb-2 text-sm font-medium">{t("access.bots")}</legend>
                <AccessRow label={t("editor.delegate")}>
                  <Switch
                    checked={details.canDelegate ?? false}
                    onCheckedChange={(on) => set({ canDelegate: on })}
                    label={t("editor.delegate")}
                  />
                </AccessRow>
                <AccessRow label={t("access.createBots")}>
                  <Switch
                    checked={details.canCreateBots ?? false}
                    onCheckedChange={(on) => set({ canCreateBots: on })}
                    label={t("access.createBots")}
                  />
                </AccessRow>
              </fieldset>
            </Tabs.Content>
          </Tabs>

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

/** One slot of the character's look: a tile per item, each showing the character wearing it. */
