import {
  ArrowDataTransferHorizontalIcon,
  Copy01Icon,
  Delete02Icon,
  Download04Icon,
  Folder01Icon,
  LinkSquare02Icon,
  PinIcon,
  PinOffIcon,
} from "@hugeicons/core-free-icons";
import { useId, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { MenuAction } from "@/components/common/action-menu";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Field } from "@/components/common/field";
import { Button } from "@/components/panelui/button";
import { Dialog } from "@/components/panelui/dialog";
import { Input } from "@/components/panelui/input";
import { useVaultName } from "@/components/home/vault-name";
import { deleteNote, updateNote } from "@/lib/db/notes";
import type { Note, Vault } from "@/lib/db/types";
import { downloadText } from "@/lib/format";
import { notebookIcon } from "@/lib/notebooks/icons";

/** A note's menu (its row's "⋯" and right-click), and the dialogs it opens. */
export function useNoteActions(
  note: Note,
  vaults: Vault[],
  { onOpenTab, onDeleted }: { onOpenTab: () => void; onDeleted: () => void },
): { actions: MenuAction[]; dialogs: ReactNode } {
  const { t } = useTranslation("notes");
  const vaultName = useVaultName();
  const [moving, setMoving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const others = vaults.filter((vault) => vault.id !== note.vaultId);

  const actions: MenuAction[] = [
    {
      kind: "item",
      id: "tab",
      label: t("actions.openNewTab"),
      icon: LinkSquare02Icon,
      onSelect: onOpenTab,
    },
    {
      kind: "item",
      id: "copy",
      label: t("actions.copyLink"),
      icon: Copy01Icon,
      onSelect: () =>
        void navigator.clipboard
          .writeText(`[[${note.title}]]`)
          .then(() => toast.success(t("actions.linkCopied"))),
    },
    { kind: "separator", id: "s1" },
    {
      kind: "item",
      id: "pin",
      label: note.pinned ? t("actions.unpin") : t("actions.pin"),
      icon: note.pinned ? PinOffIcon : PinIcon,
      onSelect: () => void updateNote(note.id, { pinned: !note.pinned }),
    },
    {
      kind: "item",
      id: "folder",
      label: t("actions.moveFolder"),
      icon: Folder01Icon,
      onSelect: () => setMoving(true),
    },
    ...(others.length
      ? [
          {
            kind: "sub",
            id: "vault",
            label: t("actions.moveVault"),
            icon: ArrowDataTransferHorizontalIcon,
            items: others.map((vault): MenuAction => ({
              kind: "item",
              id: vault.id,
              label: vaultName(vault),
              icon: notebookIcon(vault.icon ?? "notebook"),
              onSelect: () => void updateNote(note.id, { vaultId: vault.id, folder: "" }),
            })),
          } satisfies MenuAction,
        ]
      : []),
    {
      kind: "item",
      id: "export",
      label: t("actions.export"),
      icon: Download04Icon,
      onSelect: () => downloadText(note.body, `${note.title}.md`, "text/markdown"),
    },
    { kind: "separator", id: "s2" },
    {
      kind: "item",
      id: "delete",
      label: t("actions.delete"),
      icon: Delete02Icon,
      destructive: true,
      onSelect: () => setDeleting(true),
    },
  ];

  const dialogs = (
    <>
      <FolderDialog note={note} open={moving} onOpenChange={setMoving} />
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={t("delete.title", { title: note.title })}
        body={t("delete.body")}
        confirmLabel={t("delete.confirm")}
        onConfirm={async () => {
          await deleteNote(note.id);
          onDeleted();
        }}
      />
    </>
  );
  return { actions, dialogs };
}

/** Moves a note to a folder path inside its vault, like "Projects/2026". */
function FolderDialog({
  note,
  open,
  onOpenChange,
}: {
  note: Note;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation("notes");
  const { t: tCommon } = useTranslation();
  const id = useId();
  const [folder, setFolder] = useState(note.folder);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setFolder(note.folder);
        onOpenChange(next);
      }}
    >
      <Dialog.Content size="sm" closeLabel={tCommon("actions.close")}>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const clean = folder
              .split("/")
              .map((part) => part.trim())
              .filter(Boolean)
              .join("/");
            void updateNote(note.id, { folder: clean }).then(() => onOpenChange(false));
          }}
        >
          <Dialog.Header title={t("folder.title", { title: note.title })} />
          <Dialog.Body>
            <Field label={t("folder.label")} htmlFor={id} hint={t("folder.hint")}>
              <Input
                id={id}
                autoFocus
                value={folder}
                onChange={(event) => setFolder(event.target.value)}
              />
            </Field>
          </Dialog.Body>
          <Dialog.Footer>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              {tCommon("actions.cancel")}
            </Button>
            <Button type="submit">{tCommon("actions.save")}</Button>
          </Dialog.Footer>
        </form>
      </Dialog.Content>
    </Dialog>
  );
}
