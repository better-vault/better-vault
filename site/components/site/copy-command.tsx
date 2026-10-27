"use client";

import { useState } from "react";
import { Copy01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

/**
 * A shell command with a copy button. A long command scrolls sideways on a
 * narrow screen instead of being cut off, so what was copied can be read back.
 */
export function CopyCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: the command is still on screen to select by hand.
    }
  };

  return (
    <div className="flex w-full max-w-xl items-center gap-2 rounded-xl bg-muted p-1 ps-4">
      <code className="flex-1 overflow-x-auto whitespace-nowrap text-start font-mono text-sm text-muted-foreground [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {command}
      </code>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? "Copied" : "Copy command"}
        className="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted-foreground outline-none transition-[background-color,color,box-shadow] duration-200 hover:bg-background hover:text-foreground hover:shadow-sm focus-visible:ring-2 focus-visible:ring-ring dark:hover:bg-input"
      >
        <HugeiconsIcon icon={copied ? Tick02Icon : Copy01Icon} className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
