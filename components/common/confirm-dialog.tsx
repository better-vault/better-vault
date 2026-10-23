"use client";

import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { AlertDialog } from "@/components/panelui/alert-dialog";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  body?: ReactNode;
  confirmLabel: ReactNode;
  /** Runs on confirm; a promise keeps the dialog open with a spinner until it settles. */
  onConfirm: () => void | Promise<unknown>;
  tone?: "destructive" | "neutral";
}

/** Asks before something that can't be undone. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  body,
  confirmLabel,
  onConfirm,
  tone = "destructive",
}: ConfirmDialogProps) {
  const { t } = useTranslation();
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Content tone={tone}>
        <AlertDialog.Title>{title}</AlertDialog.Title>
        {body ? <AlertDialog.Description>{body}</AlertDialog.Description> : null}
        <AlertDialog.Footer>
          <AlertDialog.Cancel>{t("actions.cancel")}</AlertDialog.Cancel>
          <AlertDialog.Action onClick={() => onConfirm()}>{confirmLabel}</AlertDialog.Action>
        </AlertDialog.Footer>
      </AlertDialog.Content>
    </AlertDialog>
  );
}
