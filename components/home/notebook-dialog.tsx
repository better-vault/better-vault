import { Cancel01Icon, File02Icon, Folder01Icon, Loading03Icon } from "@hugeicons/core-free-icons";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Field } from "@/components/common/field";
import { Icon } from "@/components/icon";
import { Button } from "@/components/panelui/button";
import { Dialog } from "@/components/panelui/dialog";
import { Input } from "@/components/panelui/input";
import { Select } from "@/components/panelui/select";
import type { Folder } from "@/lib/db/database";
import { ancestors } from "@/lib/db/folders";
import type { NotebookLook } from "@/lib/db/notebooks";
import { itemColor, itemColorKeys } from "@/lib/notebooks/colors";
import { notebookIcon, notebookIconKeys, type NotebookIconKey } from "@/lib/notebooks/icons";
import { cn } from "@/lib/utils";

export interface NotebookDetails extends NotebookLook {
  title: string;
}

interface NotebookDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** "create" asks for a new notebook; "edit" changes one. */
  mode: "create" | "edit";
  initial: NotebookDetails;
  folders: Folder[];
  /** Files dropped on the page, added as the new notebook's first sources. */
  files?: File[];
  onRemoveFile?: (file: File) => void;
  /** Saves; the dialog shows a spinner until it settles and closes after. */
  onSubmit: (details: NotebookDetails) => Promise<void>;
}

/**
 * Asks for a notebook's name, icon, colour and folder: before creating one,
 * from the "New notebook" button or files dropped on the page, and when
 * editing one.
 */
export function NotebookDialog({ open, onOpenChange, mode, ...props }: NotebookDialogProps) {
  const { t } = useTranslation("home");
  const { t: tCommon } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Dialog.Content size="md" closeLabel={tCommon("actions.close")}>
        <Dialog.Header
          title={mode === "create" ? t("dialog.createTitle") : t("dialog.editTitle")}
          description={mode === "create" ? t("dialog.createDescription") : undefined}
        />
        {/* Mounted only while open, so each opening starts from `initial`. */}
        <NotebookForm mode={mode} {...props} onDone={() => onOpenChange(false)} />
      </Dialog.Content>
    </Dialog>
  );
}

function NotebookForm({
  mode,
  initial,
  folders,
  files = [],
  onRemoveFile,
  onSubmit,
  onDone,
}: Omit<NotebookDialogProps, "open" | "onOpenChange"> & { onDone: () => void }) {
  const { t } = useTranslation("home");
  const { t: tCommon } = useTranslation();
  const formId = useId();
  const nameId = useId();
  const [title, setTitle] = useState(initial.title);
  const [icon, setIcon] = useState<string>(initial.icon ?? "notebook");
  const [color, setColor] = useState<string | undefined>(initial.color);
  const [folderId, setFolderId] = useState<string | null>(initial.folderId ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A new notebook may stay untitled; an edited one keeps a name.
  const trimmed = title.trim() || (mode === "create" ? t("untitled") : "");
  const look = itemColor(color);

  const top = "";
  const folderItems = [
    { value: top, label: t("dialog.noFolder") },
    ...folders
      .map((folder) => ({
        value: folder.id,
        label: ancestors(folder.id, folders)
          .map((at) => at.name)
          .join(" / "),
      }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  ];

  async function submit() {
    if (!trimmed || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit({ title: trimmed, icon, color, folderId });
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
          <div className="flex items-end gap-3">
            <span
              aria-hidden
              className={cn(
                "flex size-11 shrink-0 items-center justify-center rounded-2xl",
                look.tile,
              )}
            >
              <Icon icon={notebookIcon(icon)} />
            </span>
            <div className="min-w-0 flex-1">
              <Field label={t("dialog.name")} htmlFor={nameId}>
                <Input
                  id={nameId}
                  value={title}
                  placeholder={t("untitled")}
                  onChange={(event) => setTitle(event.target.value)}
                  autoFocus
                  onFocus={(event) => event.target.select()}
                />
              </Field>
            </div>
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium">{t("dialog.icon")}</legend>
            <div
              className="grid grid-cols-9 gap-1.5 sm:grid-cols-13"
              role="radiogroup"
              aria-label={t("dialog.icon")}
            >
              {notebookIconKeys.map((key: NotebookIconKey) => (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={icon === key}
                  aria-label={t(`icons.${key}`)}
                  title={t(`icons.${key}`)}
                  onClick={() => setIcon(key)}
                  className={cn(
                    "flex aspect-square cursor-pointer items-center justify-center rounded-xl text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
                    icon === key && "bg-muted text-foreground ring-1 ring-foreground/20",
                  )}
                >
                  <Icon icon={notebookIcon(key)} size={18} />
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium">{t("dialog.color")}</legend>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("dialog.color")}>
              <ColorButton
                selected={!color}
                label={t("colors.none")}
                onClick={() => setColor(undefined)}
                swatch={itemColor(undefined).swatch}
              />
              {itemColorKeys.map((key) => (
                <ColorButton
                  key={key}
                  selected={color === key}
                  label={t(`colors.${key}`)}
                  onClick={() => setColor(key)}
                  swatch={itemColor(key).swatch}
                />
              ))}
            </div>
          </fieldset>

          {folders.length > 0 ? (
            <Field label={t("dialog.folder")}>
              <Select
                items={folderItems}
                value={folderId ?? top}
                onValueChange={(next) => typeof next === "string" && setFolderId(next || null)}
              >
                <Select.Trigger aria-label={t("dialog.folder")} className="w-full">
                  <Select.Value />
                </Select.Trigger>
                <Select.Content>
                  {folderItems.map((item) => (
                    <Select.Item
                      key={item.value}
                      value={item.value}
                      icon={<Icon icon={Folder01Icon} size={16} />}
                    >
                      {item.label}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select>
            </Field>
          ) : null}

          {files.length > 0 ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">{t("dialog.files", { count: files.length })}</p>
              <ul className="flex flex-col gap-1">
                {files.map((file) => (
                  <li
                    key={`${file.name}-${file.size}-${file.lastModified}`}
                    className="flex items-center gap-2 rounded-xl bg-muted/60 px-3 py-2 text-sm"
                  >
                    <Icon icon={File02Icon} size={16} className="shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">{file.name}</span>
                    {onRemoveFile && files.length > 1 ? (
                      <button
                        type="button"
                        aria-label={t("dialog.removeFile", { name: file.name })}
                        onClick={() => onRemoveFile(file)}
                        className="flex size-6 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <Icon icon={Cancel01Icon} size={14} />
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </form>
      </Dialog.Body>
      <Dialog.Footer>
        <Dialog.Close render={<Button variant="secondary" />}>
          {tCommon("actions.cancel")}
        </Dialog.Close>
        <Button type="submit" form={formId} disabled={!trimmed || busy} aria-busy={busy}>
          {busy ? <Icon icon={Loading03Icon} size={16} className="animate-spin" /> : null}
          {mode === "create" ? t("dialog.create") : tCommon("actions.save")}
        </Button>
      </Dialog.Footer>
    </>
  );
}

function ColorButton({
  selected,
  label,
  swatch,
  onClick,
}: {
  selected: boolean;
  label: string;
  swatch: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "flex size-8 cursor-pointer items-center justify-center rounded-full ring-offset-2 ring-offset-background outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected && "ring-2 ring-foreground/40",
      )}
    >
      <span className={cn("size-6 rounded-full", swatch)} />
    </button>
  );
}
