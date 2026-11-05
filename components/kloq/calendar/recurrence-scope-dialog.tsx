"use client";

/**
 * recurrence-scope-dialog — "this event / this and following / all events".
 * A chooser only; the caller turns the answer into a plan via `lib/recurrence.ts`.
 */

import { Repeat } from "@/components/kloq/lib/icons";
import { useState } from "react";
import { RECURRENCE_SCOPES, type RecurrenceScope } from "../lib/recurrence";
import { cn } from "../lib/utils";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "../ui/dialog";
import { Label } from "../ui/label";
import { Radio, RadioGroup } from "../ui/radio-group";
import { useReturnFocus } from "./use-return-focus";

export type RecurrenceScopeAction = "edit" | "delete";

const LABELS: Record<RecurrenceScope, string> = {
  this: "This event",
  following: "This and following",
  all: "All events",
};

const HINTS: Record<RecurrenceScopeAction, Record<RecurrenceScope, string>> = {
  edit: {
    this: "Detaches from the series",
    following: "Earlier ones stay as they are",
    all: "Past and future, together",
  },
  delete: {
    this: "The rest of the series stays",
    following: "Earlier ones stay as they are",
    all: "Removes the whole series",
  },
};

const CONFIRM: Record<RecurrenceScopeAction, Record<RecurrenceScope, string>> = {
  edit: {
    this: "Change this event",
    following: "Change following",
    all: "Change all",
  },
  delete: {
    this: "Delete this event",
    following: "Delete following",
    all: "Delete all",
  },
};

const DOTS = 7;
const THIS = 3;

function affected(scope: RecurrenceScope, i: number): boolean {
  if (scope === "all") return true;
  if (scope === "following") return i >= THIS;
  return i === THIS;
}

function Strip({
  scope,
  action,
  active,
}: {
  scope: RecurrenceScope;
  action: RecurrenceScopeAction;
  active: boolean;
}) {
  return (
    <span aria-hidden className="flex shrink-0 items-center gap-1">
      {Array.from({ length: DOTS }, (_, i) => {
        const hit = affected(scope, i);
        return (
          <span
            key={i}
            className={cn(
              "rounded-full transition-[background-color,box-shadow,scale] duration-(--overlay-enter)",
              i === THIS ? "size-2.5" : "size-2",
              hit
                ? action === "delete"
                  ? "bg-destructive"
                  : "bg-primary"
                : "bg-muted-foreground/25",
              hit && !active && "opacity-70",
              i === THIS &&
                "ring-2 ring-offset-1 ring-offset-popover " +
                  (hit
                    ? action === "delete"
                      ? "ring-destructive/35"
                      : "ring-primary/35"
                    : "ring-muted-foreground/30"),
            )}
          />
        );
      })}
    </span>
  );
}

export interface RecurrenceScopeDialogProps {
  open: boolean;
  /** Fired for every close, chosen or not. */
  onOpenChange: (open: boolean) => void;
  action: RecurrenceScopeAction;
  title?: string;
  /** `describeRRule` of the series — "Every week on Mon". */
  summary?: string;
  /** The answer. Only fires on confirm. */
  onChoose: (scope: RecurrenceScope) => void;
  /** Dismissed without answering. */
  onCancel?: () => void;
  /** Scopes to offer; the first occurrence has no "and following". */
  scopes?: readonly RecurrenceScope[];
}

export function RecurrenceScopeDialog({
  open,
  onOpenChange,
  action,
  title,
  summary,
  onChoose,
  onCancel,
  scopes = RECURRENCE_SCOPES,
}: RecurrenceScopeDialogProps) {
  const [scope, setScope] = useState<RecurrenceScope>("this");
  // Reset during render so the old choice never paints.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setScope("this");
  }

  const confirm = () => {
    onChoose(scope);
    onOpenChange(false);
  };
  const dismiss = () => {
    onCancel?.();
    onOpenChange(false);
  };

  const label = title?.trim() || "Untitled";
  const destructive = action === "delete";

  const finalFocus = useReturnFocus(open);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel?.();
        onOpenChange(next);
      }}
    >
      <DialogPopup
        className="max-w-sm"
        showCloseButton={false}
        finalFocus={finalFocus}
        onKeyDown={(e) => {
          // Enter on a radio confirms it; Space still just selects
          if (e.key !== "Enter" || e.defaultPrevented) return;
          if (!(e.target as HTMLElement).closest("[role=radio]")) return;
          e.preventDefault();
          confirm();
        }}
      >
        <DialogHeader>
          <DialogTitle>
            {destructive ? "Delete recurring event" : "Edit recurring event"}
          </DialogTitle>
          <DialogDescription className="flex min-w-0 items-center gap-1.5">
            <Repeat aria-hidden className="size-3.5 shrink-0" />
            <span className="truncate">
              <span className="text-foreground">{label}</span>
              {summary ? ` · ${summary.toLowerCase()}` : ""}
            </span>
          </DialogDescription>
        </DialogHeader>

        <DialogPanel>
          <RadioGroup
            aria-label={destructive ? "Delete scope" : "Edit scope"}
            className="gap-0 overflow-hidden rounded-xl border bg-background"
            value={scope}
            onValueChange={(next) => setScope(next as RecurrenceScope)}
          >
            {scopes.map((value) => (
              <Label
                key={value}
                className="cursor-pointer gap-3 px-3.5 py-3 font-normal transition-colors not-first:border-t hover:bg-accent/40 has-data-checked:bg-accent/70"
              >
                <Radio value={value} />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-sm text-foreground">{LABELS[value]}</span>
                  <span className="block text-xs text-muted-foreground">
                    {HINTS[action][value]}
                  </span>
                </span>
                <Strip scope={value} action={action} active={scope === value} />
              </Label>
            ))}
          </RadioGroup>
        </DialogPanel>

        <DialogFooter variant="bare">
          <Button variant="outline" size="sm" onClick={dismiss}>
            Cancel
          </Button>
          <Button size="sm" variant={destructive ? "destructive" : "default"} onClick={confirm}>
            {CONFIRM[action][scope]}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
