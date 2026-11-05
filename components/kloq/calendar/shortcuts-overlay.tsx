"use client";

/**
 * shortcuts-overlay — the "?" sheet. Remappable rows carry an `action` id and
 * resolve through `lib/keymap.ts`, so remapped keys show their real binding.
 */

import { useMemo } from "react";
import {
  displayKey,
  KEY_ACTIONS,
  type KeyActionId,
  type Keymap,
  resolveKeymap,
} from "../lib/keymap";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "../ui/dialog";
import { Separator } from "../ui/separator";
import { KbdKeys } from "./kbd-keys";
import { SectionLabel } from "./panel-rows";
import { useReturnFocus } from "./use-return-focus";

interface Row {
  keys?: string[];
  /** Resolved from the keymap; the row hides while unbound. */
  action?: KeyActionId;
  label: string;
}

const actionLabel = (id: KeyActionId): string => KEY_ACTIONS.find((a) => a.id === id)?.label ?? id;

const SECTIONS: { title: string; rows: Row[] }[] = [
  {
    title: "Create & edit",
    rows: [
      { keys: ["drag"], label: "Draw an event on the grid" },
      { action: "create", label: actionLabel("create") },
      { keys: ["dbl-click"], label: "New 30-min event under the cursor" },
      { keys: ["↵"], label: "Open the selected event" },
      { keys: ["⌘", "↵"], label: "Save the open panel" },
      { keys: ["esc"], label: "Close the panel, then clear the selection / cancel a drag" },
      { keys: ["1", "–", "5"], label: "Recolor the selected event" },
      { keys: ["⇧", "⌘", "E"], label: "Export the selected event as .ics" },
    ],
  },
  {
    title: "Select",
    rows: [
      { keys: ["⌘", "drag"], label: "Marquee-select (⇧ adds to the selection)" },
      { keys: ["⌘", "click"], label: "Add / remove one event" },
      { keys: ["⇧", "click"], label: "Extend the selection to this event" },
      { keys: ["⇧", "arrows"], label: "Extend as the arrows walk" },
      { keys: ["⌘", "A"], label: "Select all visible events" },
    ],
  },
  {
    title: "Clipboard",
    rows: [
      { keys: ["⌘", "C"], label: "Copy the selection (.ics + text)" },
      { keys: ["⌘", "X"], label: "Cut the selection" },
      { keys: ["⌘", "V"], label: "Paste at the hovered slot" },
      { keys: ["⌘", "D"], label: "Duplicate in place" },
      { keys: ["⌫"], label: "Delete the selection" },
    ],
  },
  {
    title: "Pointer",
    rows: [
      { keys: ["⌥", "drag"], label: "Move → duplicate (ghost solidifies)" },
      { keys: ["⌥"], label: "Create/resize → 5-minute snap" },
      { keys: ["edges"], label: "Resize — handles overhang the block" },
    ],
  },
  {
    title: "Navigate",
    rows: [
      { keys: ["←", "→"], label: "Previous / next range (nothing selected)" },
      { keys: ["PgUp", "PgDn"], label: "Previous / next range" },
      { action: "prev-period", label: actionLabel("prev-period") },
      { action: "next-period", label: actionLabel("next-period") },
      { action: "today", label: actionLabel("today") },
      { action: "view-day", label: actionLabel("view-day") },
      { action: "view-3days", label: actionLabel("view-3days") },
      { action: "view-week", label: actionLabel("view-week") },
      { action: "view-month", label: actionLabel("view-month") },
      { action: "view-year", label: actionLabel("view-year") },
      { action: "view-agenda", label: actionLabel("view-agenda") },
    ],
  },
  {
    title: "Keyboard",
    rows: [
      { keys: ["↑", "↓", "←", "→"], label: "Walk selection between events" },
      { keys: ["⌥", "arrows"], label: "Nudge the selected event" },
      { keys: ["⌥", "⇧", "↑↓"], label: "Grow / shrink from the end" },
      { keys: ["⌥", "⇧", "⌘", "↑↓"], label: "Grow / shrink from the start" },
      { keys: ["⌘", "Z"], label: "Undo" },
      { keys: ["⇧", "⌘", "Z"], label: "Redo" },
    ],
  },
  {
    title: "App",
    rows: [
      { keys: ["⌘", "K"], label: "Command menu — every action, grouped" },
      { keys: ["⌥", "D"], label: "Design mode" },
      { keys: ["⇧", "⌘", ",", "/", "."], label: "Zoom hours out / in" },
      { keys: ["⇧", "⌘", "0"], label: "Default hour size" },
      { action: "shortcuts", label: "This sheet" },
    ],
  },
  {
    title: "Inside ⌘K",
    rows: [
      { keys: ["⌘", "K"], label: "Quick add — write “lunch tomorrow 1pm”" },
      { keys: ["⌘", "K"], label: "Search every event, not just this week" },
      { keys: ["⌘", "K"], label: "Go to date… · Go to today · Jump to a day" },
      { keys: ["⌘", "K"], label: "Set theme… · light / dark / system" },
      { keys: ["esc"], label: "Step back out of a ⌘K picker" },
    ],
  },
];

interface ShortcutsOverlayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Host keymap overrides. */
  keymap?: Keymap;
  /** `false` drops the ⌘K rows — nothing advertised that can't fire. */
  commandPalette?: boolean;
  /** "Customize…" was pressed. Omit and the button isn't rendered. */
  onCustomize?: () => void;
}

const isCmdK = (row: Row) => row.keys?.[0] === "⌘" && row.keys?.[1] === "K";

export function ShortcutsOverlay({
  open,
  onOpenChange,
  keymap,
  commandPalette = true,
  onCustomize,
}: ShortcutsOverlayProps) {
  const resolved = useMemo(() => resolveKeymap(keymap), [keymap]);
  const sections = commandPalette
    ? SECTIONS
    : SECTIONS.filter((s) => s.title !== "Inside ⌘K").map((s) => ({
        ...s,
        rows: s.rows.filter((r) => !isCmdK(r)),
      }));
  const keysOf = (row: Row): string[] | null => {
    if (row.keys) return row.keys;
    const binding = row.action ? resolved.byAction[row.action] : null;
    return binding ? [displayKey(binding)] : null;
  };
  const finalFocus = useReturnFocus(open);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="max-w-md" finalFocus={finalFocus}>
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
        </DialogHeader>
        <DialogPanel className="flex flex-col gap-4">
          {sections.map((section, i) => (
            <div key={section.title} className="flex flex-col gap-2">
              {i > 0 ? <Separator className="mb-1" /> : null}
              <SectionLabel>{section.title}</SectionLabel>
              {section.rows.map((row) => {
                const keys = keysOf(row);
                if (!keys) return null; // unbound — no dead keys advertised
                return (
                  <div key={row.label} className="flex items-center justify-between gap-4 text-sm">
                    <span>{row.label}</span>
                    <KbdKeys keys={keys} />
                  </div>
                );
              })}
            </div>
          ))}
        </DialogPanel>
        {onCustomize ? (
          <DialogFooter variant="bare">
            <Button variant="outline" size="sm" onClick={onCustomize}>
              Customize shortcuts…
            </Button>
          </DialogFooter>
        ) : null}
      </DialogPopup>
    </Dialog>
  );
}
