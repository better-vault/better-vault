import { useSyncExternalStore } from "react";
import { cn } from "../lib/utils";
import { Kbd, KbdGroup } from "../ui/kbd";

// gestures and joiners are words, not keys
const WORDS = new Set(["drag", "click", "dbl-click", "arrows", "–", "/", "or"]);
const OFF_APPLE: Record<string, string> = { "⌘": "Ctrl", "⌥": "Alt" };

const subscribe = () => () => {};
const isApple = () => /Mac|iPhone|iPad|iPod/.test(navigator.platform);

/**
 * One chip per key, modifiers first in ⌃ ⌥ ⇧ ⌘ order; gestures read as plain text.
 * ⌘ and ⌥ become Ctrl and Alt off Apple platforms, resolved after mount so hydration matches.
 */
export function KbdKeys({ keys, className }: { keys: readonly string[]; className?: string }) {
  const apple = useSyncExternalStore(subscribe, isApple, () => true);
  return (
    <KbdGroup className={cn("shrink-0", className)}>
      {keys.map((k, i) =>
        WORDS.has(k) ? (
          <span key={i} data-slot="kbd-word" className="font-sans text-muted-foreground text-xs">
            {k}
          </span>
        ) : (
          <Kbd key={i}>{apple ? k : (OFF_APPLE[k] ?? k)}</Kbd>
        ),
      )}
    </KbdGroup>
  );
}
