import { Folder01Icon, Home01Icon } from "@hugeicons/core-free-icons";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Field } from "@/components/common/field";
import { Icon } from "@/components/icon";
import { Button } from "@/components/panelui/button";
import { Dialog } from "@/components/panelui/dialog";
import { Input } from "@/components/panelui/input";
import type { Folder } from "@/lib/db/database";
import { ancestors } from "@/lib/db/folders";
import { itemColor, itemColorKeys } from "@/lib/notebooks/colors";
import { cn } from "@/lib/utils";

interface FolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initial: { name: string; color?: string };
  onSubmit: (details: { name: string; color?: string }) => Promise<void>;
}

/** A folder's name and colour, before creating it or when editing it. */
export function FolderDialog({ open, onOpenChange, mode, initial, onSubmit }: FolderDialogProps) {
  const { t } = useTranslation("home");
  const { t: tCommon } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Dialog.Content size="sm" closeLabel={tCommon("actions.close")}>
        <Dialog.Header
          title={mode === "create" ? t("folders.createTitle") : t("folders.editTitle")}
        />
        <FolderForm
          mode={mode}
          initial={initial}
          onSubmit={async (details) => {
            await onSubmit(details);
            onOpenChange(false);
          }}
        />
      </Dialog.Content>
    </Dialog>
  );
}

function FolderForm({
  mode,
  initial,
  onSubmit,
}: Pick<FolderDialogProps, "mode" | "initial" | "onSubmit">) {
  const { t } = useTranslation("home");
  const { t: tCommon } = useTranslation();
  const formId = useId();
  const nameId = useId();
  const [name, setName] = useState(initial.name);
  const [color, setColor] = useState(initial.color);
  const trimmed = name.trim();
  return (
    <>
      <Dialog.Body>
        <form
          id={formId}
          className="flex flex-col gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            if (trimmed) void onSubmit({ name: trimmed, color });
          }}
        >
          <Field label={t("folders.name")} htmlFor={nameId}>
            <Input
              id={nameId}
              value={name}
              placeholder={t("folders.untitled")}
              onChange={(event) => setName(event.target.value)}
              autoFocus
              onFocus={(event) => event.target.select()}
            />
          </Field>
          <fieldset>
            <legend className="mb-2 text-sm font-medium">{t("dialog.color")}</legend>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("dialog.color")}>
              {[undefined, ...itemColorKeys].map((key) => (
                <button
                  key={key ?? "none"}
                  type="button"
                  role="radio"
                  aria-checked={color === key}
                  aria-label={t(`colors.${key ?? "none"}`)}
                  title={t(`colors.${key ?? "none"}`)}
                  onClick={() => setColor(key)}
                  className={cn(
                    "flex size-8 cursor-pointer items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    color === key && "ring-2 ring-foreground/40",
                  )}
                >
                  <span className={cn("size-6 rounded-full", itemColor(key).swatch)} />
                </button>
              ))}
            </div>
          </fieldset>
        </form>
      </Dialog.Body>
      <Dialog.Footer>
        <Dialog.Close render={<Button variant="secondary" />}>
          {tCommon("actions.cancel")}
        </Dialog.Close>
        <Button type="submit" form={formId} disabled={!trimmed}>
          {mode === "create" ? t("folders.create") : tCommon("actions.save")}
        </Button>
      </Dialog.Footer>
    </>
  );
}

interface MoveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** What is moved, for the title. */
  name: string;
  folders: Folder[];
  /** Where it is now. */
  current: string | null;
  /** A folder being moved can't go into itself or its own folders. */
  movingFolderId?: string;
  onMove: (folderId: string | null) => Promise<void>;
}

/** Picks the folder a notebook or folder moves to. */
export function MoveDialog({
  open,
  onOpenChange,
  name,
  folders,
  current,
  movingFolderId,
  onMove,
}: MoveDialogProps) {
  const { t } = useTranslation("home");
  const { t: tCommon } = useTranslation();
  const blocked = (id: string) =>
    movingFolderId !== undefined &&
    ancestors(id, folders).some((folder) => folder.id === movingFolderId);
  const options = folders
    .filter((folder) => !blocked(folder.id))
    .map((folder) => ({
      folder,
      label: ancestors(folder.id, folders)
        .map((at) => at.name)
        .join(" / "),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  async function pick(id: string | null) {
    await onMove(id);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Dialog.Content size="sm" closeLabel={tCommon("actions.close")}>
        <Dialog.Header title={t("move.title", { name })} />
        <Dialog.Body>
          <div className="-mx-2 flex max-h-80 flex-col gap-0.5 overflow-y-auto">
            <MoveOption
              icon={Home01Icon}
              label={t("move.top")}
              current={current === null}
              onClick={() => void pick(null)}
            />
            {options.map(({ folder, label }) => (
              <MoveOption
                key={folder.id}
                icon={Folder01Icon}
                tint={itemColor(folder.color).tile}
                label={label}
                current={current === folder.id}
                onClick={() => void pick(folder.id)}
              />
            ))}
          </div>
        </Dialog.Body>
      </Dialog.Content>
    </Dialog>
  );
}

function MoveOption({
  icon,
  tint = "bg-muted text-foreground",
  label,
  current,
  onClick,
}: {
  icon: typeof Folder01Icon;
  tint?: string;
  label: string;
  current: boolean;
  onClick: () => void;
}) {
  const { t } = useTranslation("home");
  return (
    <button
      type="button"
      disabled={current}
      onClick={onClick}
      className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-2 py-2 text-start text-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:opacity-60 disabled:hover:bg-transparent"
    >
      <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", tint)}>
        <Icon icon={icon} size={16} />
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {current ? <span className="text-xs text-muted-foreground">{t("move.current")}</span> : null}
    </button>
  );
}
