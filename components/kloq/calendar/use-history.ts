"use client";

/**
 * use-history — bounded snapshot undo/redo over the store; replays via
 * `replaceAll` (never re-records) and FLIPs the affected blocks.
 */

import { useCallback, useEffect, useRef } from "react";
import { flushSync } from "react-dom";
import { isHistoryCapable, type KloqChange, type KloqStore } from "../lib/calendar-store";
import type { CalEvent } from "../lib/calendar-types";
import { entriesFor } from "../lib/recurrence";
import { EASE_OUT, ms, prefersReducedMotion, SPRING } from "../lib/springs";

const LIMIT = 100;
/** Keystrokes in one text field closer together than this share an undo step. */
const TYPING_WINDOW_MS = 1000;
const TEXT_FIELDS = new Set(["title", "description", "location", "meetingUrl"]);

interface Entry {
  before: CalEvent[];
  after: CalEvent[];
  ids: string[];
}

function idsOf(change: KloqChange): string[] {
  switch (change.type) {
    case "add":
    case "remove":
      return [change.event.id];
    case "update":
      return [change.id];
    case "reset":
      return [];
    case "batch":
      return change.changes.flatMap(idsOf);
  }
}

interface Typing {
  id: string;
  fields: string;
  at: number;
}

function typingOf(change: KloqChange, at: number): Typing | null {
  if (change.type !== "update") return null;
  const keys = Object.keys(change.patch);
  if (keys.length === 0 || !keys.every((k) => TEXT_FIELDS.has(k))) return null;
  return { id: change.id, fields: keys.sort().join(), at };
}

interface HistoryHandle {
  undo(): void;
  redo(): void;
}

export function useHistory(store: KloqStore, registry: Map<string, HTMLElement>): HistoryHandle {
  const past = useRef<Entry[]>([]).current;
  const future = useRef<Entry[]>([]).current;
  // the open typing run, always describing the newest `past` entry
  const typing = useRef<Typing | null>(null);

  useEffect(() => {
    past.length = 0;
    future.length = 0;
    typing.current = null;
    if (!isHistoryCapable(store)) return;
    store.setChangeListener((change, before, after) => {
      const next = typingOf(change, Date.now());
      const open = typing.current;
      const last = past[past.length - 1];
      if (
        next &&
        open &&
        last?.after === before &&
        open.id === next.id &&
        open.fields === next.fields &&
        next.at - open.at <= TYPING_WINDOW_MS
      ) {
        last.after = after;
      } else {
        past.push({ before, after, ids: idsOf(change) });
        if (past.length > LIMIT) past.shift();
      }
      typing.current = next;
      future.length = 0;
    });
    return () => store.setChangeListener(null);
  }, [store, past, future]);

  const replay = useCallback(
    (entry: Entry, events: CalEvent[]) => {
      if (!isHistoryCapable(store)) return;
      const reduced = prefersReducedMotion();
      // beforeLead (by store id) is the fallback for a placement id that changed across the replay
      const beforeRects = new Map<string, DOMRect>();
      const beforeLead = new Map<string, DOMRect>();
      if (!reduced)
        for (const id of entry.ids) {
          for (const [key, node] of entriesFor(registry, id)) {
            const rect = node.getBoundingClientRect();
            beforeRects.set(key, rect);
            if (!beforeLead.has(id)) beforeLead.set(id, rect);
          }
        }
      flushSync(() => store.replaceAll(events));
      if (reduced) return;
      for (const id of entry.ids)
        for (const [key, node] of entriesFor(registry, id)) {
          const old = beforeRects.get(key) ?? beforeLead.get(id);
          const now = node.getBoundingClientRect();
          if (!old) {
            node.animate(
              [
                { opacity: 0, transform: "scale(0.94)" },
                { opacity: 1, transform: "none" },
              ],
              { duration: ms(180), easing: EASE_OUT },
            );
            continue;
          }
          const dx = old.left - now.left;
          const dy = old.top - now.top;
          const sy = now.height > 0 ? old.height / now.height : 1;
          if (Math.abs(dx) < 1 && Math.abs(dy) < 1 && Math.abs(sy - 1) < 0.01) continue;
          node.animate(
            [
              {
                transform: `translate(${dx}px, ${dy}px) scaleY(${sy})`,
                transformOrigin: "top left",
              },
              { transform: "none", transformOrigin: "top left" },
            ],
            { duration: ms(200), easing: SPRING },
          );
        }
    },
    [store, registry],
  );

  const undo = useCallback(() => {
    const entry = past.pop();
    if (!entry) return;
    typing.current = null;
    future.push(entry);
    replay(entry, entry.before);
  }, [past, future, replay]);

  const redo = useCallback(() => {
    const entry = future.pop();
    if (!entry) return;
    typing.current = null;
    past.push(entry);
    replay(entry, entry.after);
  }, [past, future, replay]);

  return { undo, redo };
}
