"use client";

import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/panelui/button";
import { Dialog } from "@/components/panelui/dialog";
import { Input } from "@/components/panelui/input";

interface RenameDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  label: string;
  value: string;
  onSave: (value: string) => void | Promise<void>;
}

/** A small dialog with one name field. */
export function RenameDialog({ open, onOpenChange, title, label, value, onSave }: RenameDialogProps) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Dialog.Content size="sm" closeLabel={t("actions.close")}>
        <Dialog.Header title={title} />
        {/* Mounted only while open, so it starts from the current name each time. */}
        <RenameForm
          label={label}
          initial={value}
          onSave={async (next) => {
            await onSave(next);
            onOpenChange(false);
          }}
        />
      </Dialog.Content>
    </Dialog>
  );
}

function RenameForm({
  label,
  initial,
  onSave,
}: {
  label: string;
  initial: string;
  onSave: (value: string) => void;
}) {
  const { t } = useTranslation();
  const formId = useId();
  const [value, setValue] = useState(initial);
  const trimmed = value.trim();
  return (
    <>
      <Dialog.Body>
        <form
          id={formId}
          onSubmit={(event) => {
            event.preventDefault();
            if (trimmed) onSave(trimmed);
          }}
        >
          <Input
            value={value}
            onChange={(event) => setValue(event.target.value)}
            aria-label={label}
            autoFocus
            onFocus={(event) => event.target.select()}
          />
        </form>
      </Dialog.Body>
      <Dialog.Footer>
        <Dialog.Close render={<Button variant="secondary" />}>{t("actions.cancel")}</Dialog.Close>
        <Button type="submit" form={formId} disabled={!trimmed}>
          {t("actions.save")}
        </Button>
      </Dialog.Footer>
    </>
  );
}
