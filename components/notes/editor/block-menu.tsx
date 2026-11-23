import type { IconSvgElement } from "@hugeicons/react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/icon";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

/**
 * The menu the block handle opens: blocks to add (from `+` or `/`), or a
 * block's actions (from `⋮⋮`). It filters as you type, moves with the arrow
 * keys, and shows a preview of the highlighted block beside it.
 */
export interface MenuEntry {
  id: string;
  group: string;
  label: string;
  icon: IconSvgElement;
  hint?: string;
  keywords?: string;
  preview?: ReactNode;
  destructive?: boolean;
  run: () => void;
}

export function BlockMenu({
  anchor,
  entries,
  groups,
  onClose,
}: {
  /** Where it opens: the left and bottom of what it belongs to, in the viewport. */
  anchor: { x: number; y: number; top: number };
  entries: MenuEntry[];
  /** Group ids in order, with their titles. */
  groups: { id: string; title: string }[];
  onClose: () => void;
}) {
  const { t } = useTranslation("notes");
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const filter = useRef<HTMLInputElement>(null);
  const [place, setPlace] = useState<{ left: number; top: number; up: boolean } | null>(null);

  const shown = useMemo(() => {
    // Letters and digits only, so "todo" finds "To-do list".
    const plain = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N} ]/gu, "");
    const words = plain(query.trim());
    const matches = words
      ? entries.filter((entry) => plain(`${entry.label} ${entry.keywords ?? ""}`).includes(words))
      : entries;
    // Keep the groups' order, so the arrow keys follow what is on screen.
    return groups.flatMap((group) => matches.filter((entry) => entry.group === group.id));
  }, [entries, groups, query]);
  const current = shown[Math.min(active, shown.length - 1)];

  // Open below the anchor, or above it when there is no room.
  useLayoutEffect(() => {
    const height = box.current?.offsetHeight ?? 360;
    const width = box.current?.offsetWidth ?? 288;
    const up = anchor.y + height + 12 > window.innerHeight && anchor.top - height - 8 > 0;
    setPlace({
      left: Math.max(8, Math.min(anchor.x, window.innerWidth - width - 8)),
      top: up ? anchor.top - height - 6 : anchor.y + 6,
      up,
    });
  }, [anchor]);

  // Take the keyboard from the editor once open, so typing filters the menu.
  useEffect(() => {
    const frame = requestAnimationFrame(() => filter.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (!box.current?.contains(event.target as Node)) onClose();
    };
    document.addEventListener("pointerdown", outside, true);
    return () => document.removeEventListener("pointerdown", outside, true);
  }, [onClose]);

  useEffect(() => {
    box.current
      ?.querySelector(`[data-entry="${current?.id}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [current?.id]);

  const choose = (entry: MenuEntry | undefined) => {
    if (!entry) return;
    onClose();
    entry.run();
  };

  return createPortal(
    <div
      ref={box}
      role="dialog"
      aria-label={t("blocks.menu")}
      className="fixed z-50 flex w-72 animate-in flex-col overflow-visible rounded-2xl bg-popover text-popover-foreground shadow-lg ring-1 ring-border fade-in-0 zoom-in-95"
      style={{
        left: place?.left ?? anchor.x,
        top: place?.top ?? anchor.y,
        visibility: place ? "visible" : "hidden",
      }}
    >
      <ScrollArea className="max-h-80" viewportClassName="max-h-80">
        <div role="listbox" aria-label={t("blocks.menu")} className="flex flex-col p-1.5">
          {shown.length === 0 ? (
            <p className="px-2.5 py-6 text-center text-sm text-muted-foreground">
              {t("blocks.noResults")}
            </p>
          ) : null}
          {groups.map((group) => {
            const inGroup = shown.filter((entry) => entry.group === group.id);
            if (inGroup.length === 0) return null;
            return (
              <div key={group.id} role="group" aria-label={group.title} className="flex flex-col">
                <p className="px-2.5 pt-2 pb-1 text-xs font-medium text-muted-foreground">
                  {group.title}
                </p>
                {inGroup.map((entry) => {
                  const selected = entry === current;
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      data-entry={entry.id}
                      onPointerMove={() => setActive(shown.indexOf(entry))}
                      onClick={() => choose(entry)}
                      className={cn(
                        "flex h-9 cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-start text-sm outline-none",
                        selected && "bg-accent",
                        entry.destructive && "text-destructive",
                      )}
                    >
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-background ring-1 ring-border">
                        <Icon icon={entry.icon} size={14} />
                      </span>
                      <span className="min-w-0 flex-1 truncate">{entry.label}</span>
                      {entry.hint ? (
                        <span className="font-mono text-xs text-muted-foreground">
                          {entry.hint}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </ScrollArea>
      <div className="flex items-center gap-2 border-t px-3 py-2">
        <input
          ref={filter}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              const step = event.key === "ArrowDown" ? 1 : -1;
              setActive((at) => (at + step + shown.length) % Math.max(shown.length, 1));
            } else if (event.key === "Enter") {
              event.preventDefault();
              choose(current);
            } else if (event.key === "Escape") {
              event.preventDefault();
              onClose();
            }
          }}
          placeholder={t("blocks.filter")}
          aria-label={t("blocks.filter")}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        <kbd className="font-mono text-[11px] text-muted-foreground">esc</kbd>
      </div>
      {current?.preview ? (
        <div className="pointer-events-none absolute start-full top-0 ms-2 hidden w-56 flex-col gap-2 rounded-2xl bg-popover p-3 shadow-lg ring-1 ring-border md:flex">
          <div className="flex min-h-24 items-center justify-center overflow-hidden rounded-xl bg-background p-3 ring-1 ring-border">
            {current.preview}
          </div>
        </div>
      ) : null}
    </div>,
    document.body,
  );
}
