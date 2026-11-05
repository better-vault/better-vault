"use client";

/**
 * context-menu-shared — what the day-grid menu and the timeline menu have in
 * common: the event item list, the colour swatch row, view metadata, and the
 * helpers that find, pop in and recolour a rendered block.
 */

import {
  Calendar,
  CalendarArrowDown,
  CalendarDays,
  CalendarRange,
  Clipboard,
  Columns3,
  CopyPlus,
  List,
  type LucideIcon,
  Pencil,
  Scissors,
  Square,
  Trash2,
} from "@/components/kloq/lib/icons";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import type { EventColor, KloqView, PlacedEvent } from "../lib/calendar-types";
import { EVENT_COLORS } from "../lib/event-palette";
import { toICS } from "../lib/ics";
import type { KeyActionId } from "../lib/keymap";
import type { PlacedOccurrence } from "../lib/projection";
import { applyPlan, deleteOccurrence } from "../lib/recurrence";
import {
  EASE_OUT,
  KEYBOARD_SPRING,
  KEYBOARD_SPRING_MS,
  ms,
  prefersReducedMotion,
} from "../lib/springs";
import {
  ContextMenuGroup,
  ContextMenuGroupLabel,
  ContextMenuItem,
  ContextMenuSeparator,
} from "../ui/context-menu";
import { KbdKeys } from "./kbd-keys";
import { useKloqStore } from "./store-context";
import { useRecurrenceScope } from "./use-recurrence-scope";
import { useKloqSelection } from "./use-selection";

export const COLOR_KEYS = Object.keys(EVENT_COLORS) as EventColor[];

// mirrors --overlay-exit
const OVERLAY_EXIT_MS = 100;

/** The popup's own enter/exit comes from the primitive; this is only its width. */
export const POPUP_MOTION = "min-w-52";

/** One label, key action and icon per view, for every place that lists views. */
export const VIEW_META: readonly {
  key: KloqView;
  label: string;
  /** how the ⌘K menu names it */
  command: string;
  action: KeyActionId;
  icon: LucideIcon;
}[] = [
  { key: "day", label: "Day", command: "Day view", action: "view-day", icon: Square },
  { key: 3, label: "3 days", command: "3-day view", action: "view-3days", icon: Columns3 },
  { key: "week", label: "Week", command: "Week view", action: "view-week", icon: CalendarRange },
  { key: "month", label: "Month", command: "Month view", action: "view-month", icon: CalendarDays },
  { key: "year", label: "Year", command: "Year view", action: "view-year", icon: Calendar },
  { key: "agenda", label: "Schedule", command: "Schedule view", action: "view-agenda", icon: List },
];

export const findNode = (host: HTMLElement | null, id: string) =>
  host?.querySelector<HTMLElement>(`[data-cal-event="${CSS.escape(id)}"]`) ?? null;

export function popIn(host: HTMLElement | null, id: string) {
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      const node = findNode(host, id);
      if (!node || prefersReducedMotion()) return;
      node.animate(
        [
          { opacity: 0, transform: "scale(0.92)" },
          { opacity: 1, transform: "none" },
        ],
        { duration: KEYBOARD_SPRING_MS, easing: KEYBOARD_SPRING },
      );
    }),
  );
}

/** Swap one palette's classes for another on a live block, returning the undo. */
export function paintColor(node: HTMLElement, from: EventColor, to: EventColor): () => void {
  if (from === to) return () => {};
  const f = EVENT_COLORS[from];
  const t = EVENT_COLORS[to];
  const undos: (() => void)[] = [];
  const swap = (el: HTMLElement, a: string, b: string) => {
    const remove = a.split(" ").filter((c) => c && el.classList.contains(c));
    if (!remove.length) return;
    const add = b.split(" ").filter(Boolean);
    el.classList.remove(...remove);
    el.classList.add(...add);
    undos.push(() => {
      el.classList.remove(...add);
      el.classList.add(...remove);
    });
  };
  swap(node, f.tint, t.tint);
  swap(node, f.text, t.text);
  swap(node, f.ring, t.ring);
  node.querySelectorAll<HTMLElement>("span").forEach((el) => swap(el, f.bar, t.bar));
  return () => {
    for (const undo of undos) undo();
  };
}

const count = (n: number) => `${n} ${n === 1 ? "event" : "events"}`;

export function Hint({ keys }: { keys: readonly string[] }) {
  return <KbdKeys keys={keys} className="ms-auto ps-4" />;
}

/** The dot inside a 24px swatch target; `on` draws the selection ring. */
export function SwatchDot({
  color,
  on,
  surface = "card",
}: {
  color: EventColor;
  on?: boolean;
  surface?: "card" | "popover";
}) {
  return (
    <span
      aria-hidden
      className={
        "size-3.5 rounded-full transition-[scale,box-shadow] duration-(--overlay-enter) group-hover/swatch:scale-110 motion-reduce:transition-none" +
        (on
          ? ` ring-2 ring-ring/40 ring-offset-2 ${surface === "card" ? "ring-offset-card" : "ring-offset-popover"}`
          : "")
      }
      style={{ backgroundColor: EVENT_COLORS[color].solid }}
    />
  );
}

export interface EventMenuItemsProps {
  event: PlacedEvent;
  /** Whether this is the selected event (the 1–5 colour hint only applies then). */
  selected: boolean;
  /** The element the event blocks render in; colour previews paint the live block. */
  host: React.RefObject<HTMLElement | null>;
  onSelect?: (id: string | null, opts?: { isNew?: boolean }) => void;
  close: () => void;
  /** Duplicate this one event: the only step that differs per host geometry. */
  onDuplicate: () => void;
  duplicateHint?: readonly string[];
}

/**
 * Everything an event's context menu offers, for one event or for the selection
 * it belongs to. Render inside a `ContextMenuPopup`.
 */
export function EventMenuItems({
  event,
  selected,
  host,
  onSelect,
  close,
  onDuplicate,
  duplicateHint,
}: EventMenuItemsProps) {
  const store = useKloqStore();
  const selection = useKloqSelection();
  const askScope = useRecurrenceScope();
  const restore = useRef<(() => void) | null>(null);
  const [active, setActive] = useState<EventColor>(event.color);
  const [forId, setForId] = useState(event.id);
  if (forId !== event.id) {
    setForId(event.id);
    setActive(event.color);
  }

  // bulk only when the right-clicked block is part of the selection
  const bulk = selection && selection.count > 1 && selection.has(event.id) ? selection : null;
  const n = bulk?.count ?? 0;
  // duplicate, cut and delete act on the store events the selection resolves to, minus the
  // read-only ones; an occurrence of a series is not one of those. The labels count what will change.
  const resolved = bulk ? bulk.selectedEvents() : [];
  const locked = resolved.filter((e) => e.readOnly === true).length;
  const editable = resolved.length - locked;
  const repeating = n - resolved.length;
  const skips = [
    locked ? `${locked} read-only` : "",
    repeating ? `${repeating} repeating` : "",
  ].filter(Boolean);
  const readOnly = bulk ? editable === 0 : event.readOnly === true;

  const clearPreview = () => {
    restore.current?.();
    restore.current = null;
  };
  useEffect(
    () => () => {
      restore.current?.();
      restore.current = null;
    },
    [],
  );

  const preview = (color: EventColor) => {
    setActive(color);
    clearPreview();
    const node = findNode(host.current, event.id);
    if (node) restore.current = paintColor(node, event.color, color);
  };

  const commitColor = (color: EventColor) => {
    if (readOnly) return close();
    // keep the painted classes: the re-render owns className from here
    restore.current = null;
    if (bulk) bulk.recolor(color);
    else if (color !== event.color) store.update(event.source.id, { color });
    close();
  };

  const duplicate = () => {
    if (!bulk) return onDuplicate();
    bulk.duplicate();
    close();
  };

  // the selection if we're in it, else the right-clicked block
  const targets = bulk ? undefined : [event.id];
  const copy = () => {
    selection?.copy(targets);
    close();
  };
  const cut = () => {
    selection?.cut(targets);
    close();
  };

  const remove = () => {
    if (readOnly) return close();
    if (bulk) {
      bulk.remove();
      close();
      return;
    }
    const node = findNode(host.current, event.id);
    const drop = () => {
      if (selected) onSelect?.(null);
      store.remove(event.source.id);
    };

    // a recurring instance asks the scope question first; that dialog outlives this menu
    const occurrence = (event as Partial<PlacedOccurrence>).occurrence;
    if (occurrence && askScope) {
      const master = event.source;
      close();
      void askScope({ action: "delete", event: master, occurrence }).then((scope) => {
        if (!scope) return;
        if (selected) onSelect?.(null);
        applyPlan(store, deleteOccurrence(master, occurrence, scope));
      });
      return;
    }

    if (!node || prefersReducedMotion()) {
      drop();
      return;
    }
    // removal must land whether the fade finishes or is cancelled
    const animation = node.animate(
      [
        { opacity: 1, transform: "none" },
        { opacity: 0, transform: "scale(0.96)" },
      ],
      { duration: ms(OVERLAY_EXIT_MS), easing: EASE_OUT, fill: "forwards" },
    );
    let dropped = false;
    const commitDrop = () => {
      if (dropped) return;
      dropped = true;
      drop();
    };
    animation.finished.then(commitDrop, commitDrop);
  };

  const duplicateItem = (
    <ContextMenuItem onClick={duplicate} disabled={bulk ? editable === 0 : false}>
      <CopyPlus />
      {bulk ? `Duplicate ${count(editable)}` : "Duplicate"}
      {bulk ? <Hint keys={["⌘", "D"]} /> : duplicateHint ? <Hint keys={duplicateHint} /> : null}
    </ContextMenuItem>
  );

  return (
    <>
      {bulk ? (
        <ContextMenuGroup>
          <ContextMenuGroupLabel>
            {count(n)} selected
            {skips.length ? ` · skips ${skips.join(", ")}` : ""}
          </ContextMenuGroupLabel>
          {duplicateItem}
        </ContextMenuGroup>
      ) : (
        <>
          <ContextMenuItem onClick={() => onSelect?.(event.id)} disabled={!onSelect}>
            <Pencil />
            Edit
          </ContextMenuItem>
          {duplicateItem}
        </>
      )}

      <ContextMenuSeparator />

      <ContextMenuItem onClick={copy} disabled={!selection}>
        <Clipboard />
        {bulk ? `Copy ${count(n)}` : "Copy"}
        <Hint keys={["⌘", "C"]} />
      </ContextMenuItem>
      <ContextMenuItem onClick={cut} disabled={!selection || readOnly}>
        <Scissors />
        {bulk ? `Cut ${count(editable)}` : "Cut"}
        <Hint keys={["⌘", "X"]} />
      </ContextMenuItem>

      <ContextMenuSeparator />

      {/* one menuitem: interactive descendants inside a menuitem are invalid ARIA */}
      <ContextMenuItem
        className="gap-3"
        aria-label={`Event color — ${active}`}
        disabled={readOnly}
        onClick={() => commitColor(active)}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            clearPreview();
            setActive(event.color);
            return;
          }
          if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
          e.preventDefault();
          e.stopPropagation();
          const i = COLOR_KEYS.indexOf(active);
          preview(
            COLOR_KEYS[
              (i + (e.key === "ArrowRight" ? 1 : COLOR_KEYS.length - 1)) % COLOR_KEYS.length
            ],
          );
        }}
        onMouseLeave={() => {
          clearPreview();
          setActive(event.color);
        }}
      >
        <span aria-hidden className="-mx-1 flex items-center">
          {COLOR_KEYS.map((key) => (
            <span
              key={key}
              data-color-swatch={key}
              onMouseEnter={() => preview(key)}
              onClick={(e) => {
                e.stopPropagation();
                commitColor(key);
              }}
              className="group/swatch grid size-6 cursor-pointer place-items-center"
            >
              <SwatchDot color={key} on={active === key} surface="popover" />
            </span>
          ))}
        </span>
        {selected ? <Hint keys={["1", "–", "5"]} /> : null}
      </ContextMenuItem>

      {bulk ? null : (
        <>
          <ContextMenuSeparator />
          <ContextMenuItem
            onClick={() => {
              void navigator.clipboard?.writeText(toICS(event)).catch(() => {});
            }}
          >
            <CalendarArrowDown />
            Copy as ICS
          </ContextMenuItem>
        </>
      )}

      <ContextMenuSeparator />

      <ContextMenuItem variant="destructive" onClick={remove} disabled={readOnly}>
        <Trash2 />
        {bulk ? `Delete ${count(editable)}` : "Delete"}
        <Hint keys={["⌫"]} />
      </ContextMenuItem>
    </>
  );
}
